import { Injectable, computed, signal, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { isSameDay, localIso, minutesOfDay, shortDate, startOfDay } from './secretary.dates';
import type { AccountStatus } from '../shared/domain/account-status';
import type {
  Appointment,
  AppointmentStatus,
  Conversation,
  ConversationMessage,
  ConversationSummary,
  Doctor,
  DoctorSummary,
  Patient,
  PatientSummary,
  ProfileDraft,
  ScheduleDay,
  SecretaryProfile,
} from './secretary.models';
import type {
  Appointment as ApiAppointment,
  UserProfile,
  MessageThread,
} from '../core/api/models';
import { HttpSecretaryGateway } from '../core/api/http-secretary-gateway';
import { HttpAuthGateway } from '../core/api/http-auth-gateway';

export const SIGNED_IN_SECRETARY_ID = 'sec-001';

export const CLOSED_STATUSES: readonly AppointmentStatus[] = ['completed', 'cancelled', 'no-show'];

const LIVE_STATUSES: readonly AppointmentStatus[] = ['booked', 'confirmed'];

const byStart = (a: Appointment, b: Appointment): number => a.startsAt.localeCompare(b.startsAt);

const byStartNewest = (a: Appointment, b: Appointment): number => byStart(b, a);

export interface BookingDraft {
  readonly patientId: string;
  readonly doctorId: string;
  readonly startsAt: string;
  readonly durationMinutes: number;
  readonly reason: string;
}

export type BookingRefusal =
  | 'no-patient'
  | 'no-doctor'
  | 'not-your-doctor'
  | 'inactive-doctor'
  | 'day-closed'
  | 'outside-hours'
  | 'ends-after-close'
  | 'doctor-busy'
  | 'not-in-the-future';

@Injectable()
export class SecretarySession {
  private readonly gateway = inject(HttpSecretaryGateway);
  private readonly authGateway = inject(HttpAuthGateway);

  private readonly appointmentState = signal<Appointment[]>([]);
  private readonly patientState = signal<Patient[]>([]);
  private readonly doctorState = signal<Doctor[]>([]);
  private readonly scheduleState = signal<Record<string, ScheduleDay[]>>({});
  private readonly profileState = signal<SecretaryProfile>({
    id: SIGNED_IN_SECRETARY_ID,
    name: '',
    email: '',
    phone: '',
    joinedOn: '',
    assignedDoctorId: null,
  });
  private readonly conversationState = signal<Conversation[]>([]);
  private readonly messageState = signal<ConversationMessage[]>([]);

  readonly now = signal(new Date());

  readonly secretaryId = SIGNED_IN_SECRETARY_ID;

  readonly profile = computed(() => this.profileState());

  readonly assignedDoctor = computed<Doctor | null>(() => {
    const id = this.profileState().assignedDoctorId;
    return id ? this.doctorById(id) : null;
  });

  readonly unassignedMessage =
    'You are not assigned to a doctor yet. Ask an administrator to assign you to one.';

  private isOnDesk(doctorId: string): boolean {
    return this.profileState().assignedDoctorId === doctorId;
  }

  private isConversationOnDesk(conversation: Conversation): boolean {
    if (conversation.party === 'doctor') return this.isOnDesk(conversation.partyId);
    const patient = this.patientState().find((candidate) => candidate.id === conversation.partyId);
    return !!patient && this.isOnDesk(patient.doctorId);
  }

  readonly appointments = computed(() =>
    this.appointmentState()
      .filter((appointment) => this.isOnDesk(appointment.doctorId))
      .sort(byStart),
  );

  readonly todaysAppointments = computed(() => {
    const now = this.now();
    return this.appointments().filter(
      (appointment) =>
        isSameDay(new Date(appointment.startsAt), now) &&
        !CLOSED_STATUSES.includes(appointment.status),
    );
  });

  readonly nextAppointment = computed(() => {
    const now = this.now().getTime();
    return (
      this.appointments().find(
        (appointment) =>
          LIVE_STATUSES.includes(appointment.status) &&
          new Date(appointment.startsAt).getTime() >= now,
      ) ?? null
    );
  });

  readonly awaitingConfirmation = computed(() =>
    this.appointments().filter((appointment) => appointment.status === 'booked'),
  );

  readonly completedThisWeek = computed(() => {
    const since = startOfDay(this.now()).getTime() - 6 * 24 * 60 * 60 * 1000;
    return this.appointments().filter(
      (appointment) =>
        appointment.status === 'completed' && new Date(appointment.startsAt).getTime() >= since,
    );
  });

  readonly deskHistory = computed(() =>
    this.appointments()
      .filter((appointment) => CLOSED_STATUSES.includes(appointment.status))
      .sort(byStartNewest),
  );

  readonly patients = computed<PatientSummary[]>(() => {
    const all = this.appointments();
    const now = this.now().getTime();
    return this.patientState()
      .filter((patient) => this.isOnDesk(patient.doctorId))
      .map((patient): PatientSummary => {
        const history = all
          .filter((appointment) => appointment.patientId === patient.id)
          .sort(byStart);
        const past = history.filter(
          (appointment) => new Date(appointment.startsAt).getTime() < now,
        );
        const future = history.filter(
          (appointment) =>
            new Date(appointment.startsAt).getTime() >= now &&
            !CLOSED_STATUSES.includes(appointment.status),
        );
        return {
          patient,
          lastVisit: past.length ? past[past.length - 1] : null,
          nextVisit: future.length ? future[0] : null,
          visitCount: history.filter(
            (appointment) => appointment.status === 'completed' || appointment.status === 'no-show',
          ).length,
        };
      });
  });

  readonly doctors = computed<DoctorSummary[]>(() => {
    const now = this.now().getTime();
    return this.doctorState()
      .filter((doctor) => this.isOnDesk(doctor.id))
      .map((doctor) => {
        const days = this.schedule()[doctor.id] ?? [];
        const weekly = days.reduce((total, day) => total + this.dayMinutes(day), 0);
        const nextLive = this.appointments()
          .filter(
            (appointment) =>
              LIVE_STATUSES.includes(appointment.status) &&
              new Date(appointment.startsAt).getTime() >= now,
          )
          .sort(byStart)[0];
        return {
          doctor,
          weeklyHours: weekly ? formatWeekHours(weekly) : 'Not taking bookings',
          nextAvailable: nextLive?.startsAt ?? null,
        };
      });
  });

  readonly activeDoctorCount = computed(
    () => this.doctors().filter((summary) => summary.doctor.status === 'active').length,
  );

  readonly schedule = computed(() =>
    Object.fromEntries(
      Object.entries(this.scheduleState())
        .filter(([id]) => this.isOnDesk(id))
        .map(([id, days]) => [id, [...days].sort((a, b) => a.dayOfWeek - b.dayOfWeek)]),
    ),
  );

  readonly conversations = computed<ConversationSummary[]>(() => {
    const messages = this.messageState();
    return this.conversationState()
      .filter((conversation) => this.isConversationOnDesk(conversation))
      .map((conversation): ConversationSummary => {
        const thread = messages
          .filter((message) => message.conversationId === conversation.id)
          .sort((a, b) => a.sentAt.localeCompare(b.sentAt));
        const newest = thread[thread.length - 1];
        return {
          conversation,
          name: this.partyName(conversation),
          messages: thread,
          unreadCount: thread.filter((m) => !m.fromSecretary && m.readAt === null).length,
          lastSentAt: newest?.sentAt ?? '',
          preview: newest ? oneline(newest.body) : '',
          lastFromSecretary: newest?.fromSecretary ?? true,
        };
      })
      .sort((a, b) => b.lastSentAt.localeCompare(a.lastSentAt));
  });

  readonly unreadMessageCount = computed(() =>
    this.conversations().reduce((total, summary) => total + summary.unreadCount, 0),
  );

  readonly awaitingActionCount = computed(
    () => this.conversations().filter((summary) => summary.conversation.awaitingAction).length,
  );

  constructor() {
    this.loadData();
  }

  private async loadData(): Promise<void> {
    await Promise.allSettled([
      this.loadProfile(),
      this.loadPatients(),
      this.loadMessages(),
    ]);
    await this.loadAppointments();
  }

  private async loadProfile(): Promise<void> {
    try {
      const user = await firstValueFrom(this.authGateway.getProfile());
      this.profileState.set(mapProfile(user));
    } catch {
      // Keep default empty profile
    }
  }

  private async loadPatients(): Promise<void> {
    try {
      const users = await firstValueFrom(this.gateway.getPatients());
      this.patientState.set(users.map((u) => mapPatient(u)));
    } catch {
      this.patientState.set([]);
    }
  }

  private async loadMessages(): Promise<void> {
    try {
      const threads = await firstValueFrom(this.gateway.getMessages());
      this.conversationState.set(threads.map((t) => mapConversation(t)));
    } catch {
      this.conversationState.set([]);
    }
  }

  private async loadAppointments(): Promise<void> {
    try {
      const assignedDoctorId = this.profileState().assignedDoctorId;
      const filter = assignedDoctorId ? { doctorId: assignedDoctorId } : undefined;
      const paged = await firstValueFrom(this.gateway.getAppointments(filter));
      this.appointmentState.set(paged.items.map((a) => mapAppointment(a)));
    } catch {
      this.appointmentState.set([]);
    }
  }

  conversationById(id: string): ConversationSummary | null {
    return this.conversations().find((summary) => summary.conversation.id === id) ?? null;
  }

  conversationSubtitle(conversation: Conversation): string {
    if (conversation.party === 'doctor') {
      const doctor = this.doctorById(conversation.partyId);
      return doctor ? `Doctor · ${doctor.specialization}` : 'Doctor';
    }
    const summary = this.patients().find((entry) => entry.patient.id === conversation.partyId);
    if (!summary) return 'Patient';
    if (summary.nextVisit) {
      return `Patient · Next visit ${shortDate(new Date(summary.nextVisit.startsAt))}`;
    }
    return summary.visitCount
      ? `Patient · ${summary.visitCount} visit${summary.visitCount === 1 ? '' : 's'}`
      : 'Patient · Not yet seen';
  }

  markConversationRead(conversationId: string): boolean {
    if (!this.conversations().some((summary) => summary.conversation.id === conversationId)) {
      return false;
    }
    const at = localIso(this.now());
    let changed = false;
    this.messageState.update((messages) =>
      messages.map((message) => {
        if (message.conversationId !== conversationId) return message;
        if (message.fromSecretary || message.readAt !== null) return message;
        changed = true;
        return { ...message, readAt: at };
      }),
    );
    return changed;
  }

  sendMessage(conversationId: string, body: string): ConversationMessage | null {
    const text = body.trim();
    if (!text) return null;
    if (!this.conversations().some((summary) => summary.conversation.id === conversationId)) {
      return null;
    }
    const message: ConversationMessage = {
      id: this.nextMessageId(),
      conversationId,
      sentAt: localIso(this.now()),
      body: text,
      fromSecretary: true,
      readAt: localIso(this.now()),
    };
    this.messageState.update((messages) => [...messages, message]);
    return message;
  }

  private nextMessageId(): string {
    const used = this.messageState().map((message) => message.id);
    let highest = 0;
    for (const id of used) {
      const parsed = Number(id.replace('msg-', ''));
      if (Number.isFinite(parsed) && parsed > highest) highest = parsed;
    }
    return `msg-${String(highest + 1).padStart(4, '0')}`;
  }

  private partyName(conversation: Conversation): string {
    return conversation.party === 'doctor'
      ? (this.doctorById(conversation.partyId)?.name ?? 'Unknown doctor')
      : (this.patientById(conversation.partyId)?.name ?? 'Unknown patient');
  }

  patientById(id: string): Patient | null {
    const patient = this.patientState().find((candidate) => candidate.id === id);
    return patient && this.isOnDesk(patient.doctorId) ? patient : null;
  }

  doctorById(id: string): Doctor | null {
    return this.doctorState().find((doctor) => doctor.id === id) ?? null;
  }

  appointmentsForPatient(patientId: string): Appointment[] {
    return this.appointments().filter((appointment) => appointment.patientId === patientId);
  }

  appointmentsForDoctor(doctorId: string): Appointment[] {
    return this.appointments().filter((appointment) => appointment.doctorId === doctorId);
  }

  patientName(patientId: string): string {
    return this.patientById(patientId)?.name ?? 'Unknown patient';
  }

  doctorName(doctorId: string): string {
    return this.doctorById(doctorId)?.name ?? 'Unknown doctor';
  }

  scheduleFor(doctorId: string): ScheduleDay[] {
    return this.schedule()[doctorId] ?? [];
  }

  dayMinutes(day: ScheduleDay): number {
    if (!day.enabled) return 0;
    const start = minutesOfDay(day.startTime);
    const end = minutesOfDay(day.endTime);
    if (start === null || end === null || end <= start) return 0;
    return end - start;
  }

  weeklyMinutes(doctorId: string): number {
    return this.scheduleFor(doctorId).reduce((total, day) => total + this.dayMinutes(day), 0);
  }

  bookingRefusal(draft: BookingDraft, ignoreId?: string): BookingRefusal | null {
    if (!draft.patientId || !this.patientById(draft.patientId)) return 'no-patient';
    const doctor = this.doctorById(draft.doctorId);
    if (!doctor) return 'no-doctor';
    if (!this.isOnDesk(draft.doctorId)) return 'not-your-doctor';
    if (doctor.status !== 'active') return 'inactive-doctor';
    const startsAt = new Date(draft.startsAt);
    if (Number.isNaN(startsAt.getTime())) return 'not-in-the-future';
    if (startsAt.getTime() < this.now().getTime()) return 'not-in-the-future';
    const day = this.scheduleFor(draft.doctorId).find((d) => d.dayOfWeek === startsAt.getDay());
    if (!day?.enabled) return 'day-closed';
    const open = minutesOfDay(day.startTime);
    const close = minutesOfDay(day.endTime);
    const startMinutes = startsAt.getHours() * 60 + startsAt.getMinutes();
    if (open === null || close === null || startMinutes < open) return 'outside-hours';
    if (startMinutes + draft.durationMinutes > close) return 'ends-after-close';
    const clash = this.appointments().some((appointment) => {
      if (appointment.id === ignoreId) return false;
      if (appointment.doctorId !== draft.doctorId) return false;
      if (CLOSED_STATUSES.includes(appointment.status)) return false;
      const existingStart = new Date(appointment.startsAt).getTime();
      const existingEnd = existingStart + appointment.durationMinutes * 60_000;
      const proposedStart = startsAt.getTime();
      const proposedEnd = proposedStart + draft.durationMinutes * 60_000;
      return proposedStart < existingEnd && existingStart < proposedEnd;
    });
    if (clash) return 'doctor-busy';
    return null;
  }

  confirm(id: string): boolean {
    const current = this.appointmentState().find((appointment) => appointment.id === id);
    if (!current || !this.isOnDesk(current.doctorId)) return false;
    if (current.status !== 'booked') return false;
    const previous = this.appointmentState();
    this.appointmentState.update((appointments) =>
      appointments.map((appointment) =>
        appointment.id === id ? { ...appointment, status: 'confirmed' as const } : appointment,
      ),
    );
    this.gateway.confirmAppointment(id).subscribe({
      error: () => this.appointmentState.set(previous),
    });
    return true;
  }

  cancel(id: string): boolean {
    const current = this.appointmentState().find((appointment) => appointment.id === id);
    if (!current || !this.isOnDesk(current.doctorId)) return false;
    if (CLOSED_STATUSES.includes(current.status)) return false;
    const previous = this.appointmentState();
    this.appointmentState.update((appointments) =>
      appointments.map((appointment) =>
        appointment.id === id ? { ...appointment, status: 'cancelled' as const } : appointment,
      ),
    );
    this.gateway.cancelAppointment(id).subscribe({
      error: () => this.appointmentState.set(previous),
    });
    return true;
  }

  updateProfile(draft: ProfileDraft): void {
    this.profileState.update((profile) => ({
      ...profile,
      name: draft.name,
      email: draft.email,
      phone: draft.phone,
    }));
  }
}

function formatWeekHours(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (!hours) return `${mins}m a week`;
  return mins ? `${hours}h ${mins}m a week` : `${hours}h a week`;
}

function oneline(body: string, limit = 110): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  return flat.length > limit ? `${flat.slice(0, limit - 1).trimEnd()}…` : flat;
}

function mapProfile(api: UserProfile): SecretaryProfile {
  return {
    id: api.id,
    name: api.fullName,
    email: api.email ?? '',
    phone: api.mobileNumber,
    joinedOn: '',
    assignedDoctorId: api.assignedDoctorId ?? null,
  };
}

function mapPatient(api: UserProfile): Patient {
  return {
    id: api.id,
    name: api.fullName,
    email: api.email ?? '',
    phone: api.mobileNumber,
    dateOfBirth: api.dateOfBirth,
    address: '',
    registeredOn: '',
    status: api.status as AccountStatus,
    doctorId: api.assignedDoctorId ?? '',
  };
}

function mapAppointment(api: ApiAppointment): Appointment {
  return {
    id: api.id,
    patientId: api.patientId,
    doctorId: api.doctorId,
    startsAt: api.startsAt,
    durationMinutes: api.durationMinutes,
    status: (api.status === 'pending' ? 'booked' : api.status) as AppointmentStatus,
    reason: api.reason,
  };
}

function mapConversation(api: MessageThread): Conversation {
  const partyId = api.patientId || api.doctorId;
  const party: 'patient' | 'doctor' = api.patientId ? 'patient' : 'doctor';
  return {
    id: api.id,
    party,
    partyId,
    awaitingAction: api.awaitingAction,
  };
}
