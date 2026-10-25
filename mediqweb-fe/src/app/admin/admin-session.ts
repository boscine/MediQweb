import { Injectable, computed, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { HttpAdminGateway } from '../core/api/http-admin-gateway';
import { buildUrl } from '../core/api/api-constants';
import type {
  AccountStatus,
  Appointment,
  AppointmentStatus,
  AuditSeverity,
  PatientAccount,
  Specialization,
  StaffAccount,
  StaffDraft,
} from './admin.models';
import type { UserProfile, Doctor, Appointment as ApiAppointment, AuditEntry } from '../core/api/models';

/** Which staff list an operation applies to. Secretaries have no specialization. */
export type StaffKind = 'doctor' | 'secretary';

let sequence = 0;

/** Deterministic ids keep client-created accounts unique within the session. */
const nextId = (prefix: string) => `${prefix}-${String(++sequence).padStart(3, '0')}`;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function numericId(id: string): number {
  const n = Number.parseInt(id.replace(/^[a-z]+-/, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

@Injectable()
export class AdminSession {
  private readonly gateway = inject(HttpAdminGateway);
  private readonly http = inject(HttpClient);

  private readonly doctorsState = signal<StaffAccount[]>([]);
  private readonly secretariesState = signal<StaffAccount[]>([]);
  private readonly patientsState = signal<PatientAccount[]>([]);
  private readonly specializationsState = signal<Specialization[]>([]);
  private readonly auditState = signal<AuditEntry[]>([]);
  private readonly appointmentsState = signal<Appointment[]>([]);

  readonly doctors = this.doctorsState.asReadonly();
  readonly secretaries = this.secretariesState.asReadonly();
  readonly patients = this.patientsState.asReadonly();
  readonly specializations = this.specializationsState.asReadonly();
  readonly auditEntries = this.auditState.asReadonly();
  /**
   * Every appointment in the clinic.
   *
   * A signal, because this is the store's usual shape. The Admin reads the
   * clinic's appointments but does not book, confirm or cancel them.
   */
  readonly appointments = this.appointmentsState.asReadonly();

  // ---------------------------------------------------------------------------
  // Counts for the dashboard
  // ---------------------------------------------------------------------------
  readonly activeDoctorCount = computed(
    () => this.doctorsState().filter((d) => d.status === 'active').length,
  );
  readonly activeSecretaryCount = computed(
    () => this.secretariesState().filter((s) => s.status === 'active').length,
  );
  readonly activePatientCount = computed(
    () => this.patientsState().filter((p) => p.status === 'active').length,
  );
  /** Newest first, for the dashboard's activity list. */
  readonly recentActivity = computed(() => this.newestFirst(this.auditState()).slice(0, 6));

  constructor() {
    this.loadData();
  }

  private async loadData(): Promise<void> {
    let accounts: UserProfile[] = [];
    let doctors: Doctor[] = [];
    let specializations: Specialization[] = [];
    let appointments: Appointment[] = [];

    try {
      accounts = await firstValueFrom(this.gateway.getAccounts());
    } catch {
      // fall back to empty; screens render with no accounts until a reload
    }

    try {
      const paged = await firstValueFrom(this.gateway.getDoctors());
      doctors = paged.items;
    } catch {
      // fall back to empty; specialization/license lookups will be unavailable
    }

    try {
      const specs = await firstValueFrom(this.gateway.getSpecializations());
      specializations = specs.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
      }));
    } catch {
      // fall back to empty
    }

    try {
      const apiAppointments = await firstValueFrom(
        this.http.get<ApiAppointment[]>(buildUrl('/appointments')),
      );
      appointments = apiAppointments.map(
        ({ id, patientId, doctorId, startsAt, durationMinutes, status, reason }) => ({
          id,
          patientId,
          doctorId,
          startsAt,
          durationMinutes,
          status: status as AppointmentStatus,
          reason,
        }),
      );
    } catch {
      // fall back to empty
    }

    // Dashboard stats are loaded to warm the endpoint but are not exposed on
    // this session's public interface.
    try {
      await firstValueFrom(this.gateway.getDashboardStats());
    } catch {
      // no-op
    }

    try {
      const auditLogs = await firstValueFrom(this.gateway.getAuditLogs());
      this.auditState.set(auditLogs);
    } catch {
      // fall back to empty; recentActivity will show nothing until a reload
    }

    const doctorByUserId = new Map(doctors.map((d) => [d.userId, d]));

    const doctorStaff: StaffAccount[] = [];
    const secretaryStaff: StaffAccount[] = [];
    const patients: PatientAccount[] = [];

    for (const profile of accounts) {
      if (profile.role === 'doctor') {
        const doctor = doctorByUserId.get(profile.id);
        doctorStaff.push({
          id: profile.id,
          name: profile.fullName,
          email: profile.email ?? '',
          username: profile.username,
          status: profile.status as AccountStatus,
          specializationId: doctor?.specializationId ?? null,
          licenseNumber: doctor?.licenseNumber ?? null,
          assignedDoctorId: null,
          joinedOn: today(),
          lastActiveOn: null,
        });
      } else if (profile.role === 'secretary') {
        secretaryStaff.push({
          id: profile.id,
          name: profile.fullName,
          email: profile.email ?? '',
          username: profile.username,
          status: profile.status as AccountStatus,
          specializationId: null,
          licenseNumber: null,
          assignedDoctorId: profile.assignedDoctorId ?? null,
          joinedOn: today(),
          lastActiveOn: null,
        });
      } else if (profile.role === 'patient') {
        patients.push({
          id: profile.id,
          name: profile.fullName,
          email: profile.email ?? '',
          phone: profile.mobileNumber,
          dateOfBirth: profile.dateOfBirth,
          status: profile.status as AccountStatus,
          registeredOn: today(),
        });
      }
    }

    this.doctorsState.set(doctorStaff);
    this.secretariesState.set(secretaryStaff);
    this.patientsState.set(patients);
    this.specializationsState.set(specializations);
    this.appointmentsState.set(appointments);

    this.reseedSequence();
  }

  private reseedSequence(): void {
    sequence = Math.max(
      0,
      ...this.doctorsState().map((a) => numericId(a.id)),
      ...this.secretariesState().map((a) => numericId(a.id)),
      ...this.specializationsState().map((s) => numericId(s.id)),
      ...this.auditState().map((e) => numericId(e.id)),
    );
  }

  // ---------------------------------------------------------------------------
  // Lookups
  // ---------------------------------------------------------------------------
  staffOf(kind: StaffKind): readonly StaffAccount[] {
    return kind === 'doctor' ? this.doctorsState() : this.secretariesState();
  }

  specializationName(id: string | null): string {
    if (!id) return '—';
    return this.specializationsState().find((s) => s.id === id)?.name ?? 'Unknown';
  }

  /** Options for the create-account form's specialization field. */
  specializationOptions(): { id: string; label: string }[] {
    return this.specializationsState().map((s) => ({ id: s.id, label: s.name }));
  }

  /**
   * Options for the create-account form's assigned-doctor field.
   *
   * Active doctors only, because an inactive doctor cannot take bookings and
   * publishes no schedule.
   */
  activeDoctorOptions(): { id: string; label: string }[] {
    return this.doctorsState()
      .filter((d) => d.status === 'active')
      .map((d) => ({ id: d.id, label: d.name }));
  }

  // ---------------------------------------------------------------------------
  // Mutations — optimistic, with revert on HTTP failure
  // ---------------------------------------------------------------------------
  addStaffAccount(kind: StaffKind, draft: StaffDraft): StaffAccount {
    const account: StaffAccount = {
      id: nextId(kind === 'doctor' ? 'doc' : 'sec'),
      name: draft.name.trim(),
      email: draft.email.trim(),
      username: draft.username.trim(),
      status: draft.status,
      specializationId: kind === 'doctor' ? (draft.specializationId ?? null) : null,
      licenseNumber: kind === 'doctor' ? (draft.licenseNumber?.trim() || null) : null,
      assignedDoctorId: kind === 'secretary' ? (draft.assignedDoctorId?.trim() || null) : null,
      joinedOn: today(),
      lastActiveOn: null,
    };

    const target = kind === 'doctor' ? this.doctorsState : this.secretariesState;
    const previousList = target();
    const previousAudit = this.auditState();
    target.update((list) => [account, ...list]);
    this.record(`Created ${kind} account`, account.name, 'info');

    const profile: Partial<UserProfile> = {
      fullName: draft.name,
      email: draft.email,
      username: draft.username,
      role: kind,
      status: draft.status,
      assignedDoctorId: kind === 'secretary' ? (draft.assignedDoctorId ?? undefined) : undefined,
    };
    firstValueFrom(this.gateway.createAccount(profile)).catch(() => {
      target.set(previousList);
      this.auditState.set(previousAudit);
    });

    return account;
  }

  /**
   * Flips an account between usable and not, recording the change.
   *
   * Returns whether anything changed. An account that does not exist, or is
   * already in the state asked for, is a `false`.
   */
  setStaffStatus(kind: StaffKind, id: string, status: AccountStatus): boolean {
    const target = kind === 'doctor' ? this.doctorsState : this.secretariesState;
    const existing = target().find((a) => a.id === id);
    if (!existing || existing.status === status) return false;

    const previousList = target();
    const previousAudit = this.auditState();
    target.update((list) => list.map((a) => (a.id === id ? { ...a, status } : a)));
    this.record(
      status === 'active' ? 'Reactivated account' : 'Deactivated account',
      existing.name,
      status === 'active' ? 'info' : 'warning',
    );

    firstValueFrom(this.gateway.updateAccount(id, { status })).catch(() => {
      target.set(previousList);
      this.auditState.set(previousAudit);
    });
    return true;
  }

  /** Whether anything changed. See `setStaffStatus` for why this reports. */
  setPatientStatus(id: string, status: AccountStatus): boolean {
    const existing = this.patientsState().find((p) => p.id === id);
    if (!existing || existing.status === status) return false;

    const previousList = this.patientsState();
    const previousAudit = this.auditState();
    this.patientsState.update((list) => list.map((p) => (p.id === id ? { ...p, status } : p)));
    this.record(
      status === 'active' ? 'Reactivated patient' : 'Deactivated patient',
      existing.name,
      status === 'active' ? 'info' : 'warning',
    );

    firstValueFrom(this.gateway.updateAccount(id, { status })).catch(() => {
      this.patientsState.set(previousList);
      this.auditState.set(previousAudit);
    });
    return true;
  }

  addSpecialization(name: string, description: string): Specialization {
    const specialization: Specialization = {
      id: nextId('spec'),
      name: name.trim(),
      description: description.trim(),
    };
    const previousList = this.specializationsState();
    const previousAudit = this.auditState();
    this.specializationsState.update((list) => [...list, specialization]);
    this.record('Added specialization', specialization.name, 'info');

    firstValueFrom(
      this.gateway.createSpecialization({
        name: specialization.name,
        description: specialization.description,
      }),
    ).catch(() => {
      this.specializationsState.set(previousList);
      this.auditState.set(previousAudit);
    });

    return specialization;
  }

  /**
   * Renames a specialization in place.
   */
  updateSpecialization(id: string, name: string, description: string): void {
    const existing = this.specializationsState().find((s) => s.id === id);
    if (!existing) return;

    const previousList = this.specializationsState();
    const previousAudit = this.auditState();
    this.specializationsState.update((list) =>
      list.map((s) => (s.id === id ? { ...s, name: name.trim(), description: description.trim() } : s)),
    );
    this.record('Updated specialization', name.trim(), 'info');

    firstValueFrom(
      this.gateway.updateSpecialization(id, {
        name: name.trim(),
        description: description.trim(),
      }),
    ).catch(() => {
      this.specializationsState.set(previousList);
      this.auditState.set(previousAudit);
    });
  }

  private record(action: string, target: string, severity: AuditSeverity): void {
    const entry: AuditEntry = {
      id: nextId('log'),
      actor: 'Alex Rivera',
      action,
      target,
      at: new Date().toISOString(),
      severity,
    };
    this.auditState.update((list) => [entry, ...list]);
  }

  private newestFirst(entries: readonly AuditEntry[]): AuditEntry[] {
    return [...entries].sort((a, b) => b.at.localeCompare(a.at));
  }
}
