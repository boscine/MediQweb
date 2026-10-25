import { Injectable, computed, signal, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  blockMinutes,
  dayKey,
  isSameDay,
  minutesOfDay,
  parseDayKey,
  startOfDay,
  usableBlocks,
} from './doctor.dates';
import type {
  Appointment,
  AppointmentStatus,
  DatedAvailability,
  DoctorProfile,
  Patient,
  PatientSummary,
  ProfileDraft,
  ScheduleBlock,
  ScheduleDay,
  VisitOutcome,
} from './doctor.models';
import type { AccountStatus } from '../shared/domain/account-status';
import { HttpDoctorGateway } from '../core/api/http-doctor-gateway';
import type { Doctor, ScheduleSlot, UserProfile } from '../core/api/models';

const CLOSED_STATUSES: readonly AppointmentStatus[] = ['completed', 'cancelled', 'no-show'];

/** Statuses that mean the patient is expected to turn up. */
const LIVE_STATUSES: readonly AppointmentStatus[] = ['booked', 'confirmed'];

/**
 * Why a dated override was not published, or `null` when it was.
 *
 * A reason rather than a boolean, for the same reason `BookingRefusal` is: the
 * page has to say *why* nothing was saved, and "no" is not a sentence. Kept as
 * data so the wording lives with the rule and a new refusal cannot be added
 * without the page being forced to handle it.
 */
export type DatedAvailabilityRefusal =
  'invalid-date' | 'in-the-past' | 'bad-session' | 'overlapping-sessions';

const byStart = (a: Appointment, b: Appointment): number => a.startsAt.localeCompare(b.startsAt);

/** Most recent first, for a record of what has already happened. */
const byStartNewest = (a: Appointment, b: Appointment): number => byStart(b, a);

/** Minutes across a set of sessions, ignoring any block that cannot be used. */
function sumMinutes(blocks: readonly ScheduleBlock[]): number {
  return blocks.reduce((total, block) => total + (blockMinutes(block) ?? 0), 0);
}

/**
 * Whether two sessions in a day claim the same time.
 *
 * Half-open, so a session ending at 12:00 and one starting at 12:00 do not
 * overlap — they are the two halves of a split day, and treating them as a clash
 * would make the ordinary case unsavable.
 *
 * Only worth asking once there is more than one session per day, which is exactly
 * what the split-day shape introduced.
 */
function sessionsOverlap(sessions: readonly ScheduleBlock[]): boolean {
  return sessions.some((block, i) =>
    sessions.slice(i + 1).some((other) => {
      const aStart = minutesOfDay(block.startTime)!;
      const aEnd = minutesOfDay(block.endTime)!;
      const bStart = minutesOfDay(other.startTime)!;
      const bEnd = minutesOfDay(other.endTime)!;
      return aStart < bEnd && bStart < aEnd;
    }),
  );
}

const EMPTY_PROFILE: DoctorProfile = {
  id: '',
  name: '',
  email: '',
  specialization: '',
  licenseNumber: '',
  joinedOn: '',
  bio: '',
};

/**
 * Doctor area session state, now backed by the real HTTP API.
 *
 * Every screen in the Doctor area reads from here. The store scopes data to the
 * signed-in doctor: appointments are filtered to `doctorId` on load, and patients
 * are derived from appointments so an unrelated patient can never leak in.
 *
 * Signals start empty and are populated as HTTP responses arrive. Mutations are
 * applied optimistically and reverted if the gateway call fails.
 */
@Injectable()
export class DoctorSession {
  private readonly gateway = inject(HttpDoctorGateway);

  /** The signed-in doctor. Fixed until authentication exists. */
  readonly doctorId = 'doc-001';

  /**
   * The area's single clock.
   *
   * A signal rather than `new Date()` inside the computeds: a `computed` that
   * read the wall clock would be correct only for the first read and cached
   * forever after, so an app left open across midnight would keep showing
   * yesterday. Exposed so tests can pin it.
   */
  readonly now = signal(new Date());

  private readonly profileState = signal<DoctorProfile>({ ...EMPTY_PROFILE });
  private readonly appointmentState = signal<Appointment[]>([]);
  private readonly patientState = signal<Patient[]>([]);
  private readonly scheduleState = signal<ScheduleDay[]>([]);
  private readonly datedAvailabilityState = signal<DatedAvailability[]>([]);

  constructor() {
    this.loadProfile();
    this.loadAppointments();
    this.loadPatients();
    this.loadSchedule();
  }

  private async loadProfile(): Promise<void> {
    try {
      const doctor = await firstValueFrom(this.gateway.getProfile());
      this.profileState.set({
        id: doctor.id,
        name: doctor.fullName,
        email: doctor.userId,
        specialization: doctor.specialty,
        licenseNumber: doctor.licenseNumber,
        joinedOn: '',
        bio: doctor.bio,
      });
    } catch {
      this.profileState.set({ ...EMPTY_PROFILE });
    }
  }

  private async loadAppointments(): Promise<void> {
    try {
      const paged = await firstValueFrom(this.gateway.getAppointments());
      const appointments: Appointment[] = paged.items
        .filter((a) => a.doctorId === this.doctorId)
        .map((a) => ({
          id: a.id,
          patientId: a.patientId,
          doctorId: a.doctorId,
          startsAt: a.startsAt,
          durationMinutes: a.durationMinutes,
          status: a.status as unknown as AppointmentStatus,
          reason: a.reason,
        }));
      this.appointmentState.set(appointments);
    } catch {
      this.appointmentState.set([]);
    }
  }

  private async loadPatients(): Promise<void> {
    try {
      const profiles = await firstValueFrom(this.gateway.getPatients());
      const patients: Patient[] = profiles.map((p) => ({
        id: p.id,
        name: p.fullName,
        email: p.email ?? '',
        phone: p.mobileNumber,
        dateOfBirth: p.dateOfBirth,
        address: '',
        registeredOn: '',
        status: p.status as AccountStatus,
      }));
      this.patientState.set(patients);
    } catch {
      this.patientState.set([]);
    }
  }

  private async loadSchedule(): Promise<void> {
    try {
      const today = dayKey(new Date());
      const schedule = await firstValueFrom(this.gateway.getSchedule(today));
      const byDay = new Map<number, ScheduleSlot[]>();
      for (const slot of schedule.slots) {
        const day = new Date(slot.startsAt).getDay();
        const list = byDay.get(day) ?? [];
        list.push(slot);
        byDay.set(day, list);
      }
      const days: ScheduleDay[] = [...byDay.entries()].map(([dayOfWeek, daySlots]) => ({
        dayOfWeek,
        sessions: daySlots.map((s) => ({
          startTime: this.slotTime(s.startsAt),
          endTime: this.slotTime(s.endsAt),
        })),
      }));
      this.scheduleState.set(days);
    } catch {
      this.scheduleState.set([]);
    }
  }

  readonly profile = computed(() => this.profileState());

  /** The signed-in doctor's appointments, soonest first. */
  readonly appointments = computed(() =>
    this.appointmentState()
      .filter((appointment) => appointment.doctorId === this.doctorId)
      .sort(byStart),
  );

  /**
   * The appointments still to happen: booked and confirmed, soonest first.
   */
  readonly openAppointments = computed(() =>
    this.appointments().filter((appointment) => LIVE_STATUSES.includes(appointment.status)),
  );

  /** Today's slice of the working list, so the day reads as a plan. */
  readonly todaysAppointments = computed(() => {
    const now = this.now();
    return this.openAppointments().filter((appointment) =>
      isSameDay(new Date(appointment.startsAt), now),
    );
  });

  /**
   * Visits this doctor has already recorded: completed and no-show, newest first.
   */
  readonly visitHistory = computed(() =>
    this.appointments()
      .filter(
        (appointment) => appointment.status === 'completed' || appointment.status === 'no-show',
      )
      .sort(byStartNewest),
  );

  /** The next appointment still to happen, or `null` when the list is clear. */
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

  /** Booked but not yet confirmed — the queue that needs a decision. */
  readonly awaitingConfirmation = computed(() =>
    this.appointments().filter((appointment) => appointment.status === 'booked'),
  );

  /** Consultations that happened in the seven days up to `now`. */
  readonly completedThisWeek = computed(() => {
    const since = startOfDay(this.now()).getTime() - 6 * 24 * 60 * 60 * 1000;
    return this.appointments().filter(
      (appointment) =>
        appointment.status === 'completed' && new Date(appointment.startsAt).getTime() >= since,
    );
  });

  /**
   * Patients this doctor has seen or is due to see.
   *
   * Derived from the appointments rather than read from `patientState`
   * directly, which is what keeps an unrelated patient out of the list.
   */
  readonly patients = computed<PatientSummary[]>(() => {
    const mine = this.appointments();
    const now = this.now().getTime();

    return this.patientState()
      .map((patient): PatientSummary | null => {
        const history = mine
          .filter((appointment) => appointment.patientId === patient.id)
          .sort(byStart);
        if (!history.length) return null;

        const past = history.filter(
          (appointment) =>
            appointment.status !== 'cancelled' && new Date(appointment.startsAt).getTime() < now,
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
      })
      .filter((summary): summary is PatientSummary => summary !== null);
  });

  readonly schedule = computed(() =>
    [...this.scheduleState()].sort((a, b) => a.dayOfWeek - b.dayOfWeek),
  );

  /** Days the doctor publishes any hours for, for the schedule summary. */
  readonly workingDayCount = computed(
    () => this.scheduleState().filter((day) => day.sessions.length > 0).length,
  );

  /**
   * Minutes the doctor publishes per week, for the schedule summary.
   *
   * Sums every session, so a split day contributes both of its halves. A day
   * that is closed contributes nothing, which is now simply what an empty
   * session list means.
   */
  readonly weeklyMinutes = computed(() =>
    this.scheduleState().reduce((total, day) => total + sumMinutes(day.sessions), 0),
  );

  /** Dated overrides, soonest first. */
  readonly datedAvailability = computed(() =>
    [...this.datedAvailabilityState()].sort((a, b) => a.date.localeCompare(b.date)),
  );

  /** Patient lookup that tolerates a bad route param instead of throwing. */
  patientById(id: string): Patient | null {
    return this.patientState().find((patient) => patient.id === id) ?? null;
  }

  /**
   * A patient, but only once this doctor has a relationship with them.
   */
  patientForDoctor(id: string): Patient | null {
    if (!id) return null;
    const known = this.appointments().some((appointment) => appointment.patientId === id);
    return known ? this.patientById(id) : null;
  }

  /**
   * A patient's appointments with this doctor, soonest first.
   *
   * Cancellations are dropped, on the same rule as the working list.
   */
  appointmentsForPatient(patientId: string): Appointment[] {
    return this.appointments().filter(
      (appointment) => appointment.patientId === patientId && appointment.status !== 'cancelled',
    );
  }

  /** Name for a table cell, so a missing patient never renders as `undefined`. */
  patientName(patientId: string): string {
    return this.patientById(patientId)?.name ?? 'Unknown patient';
  }

  /**
   * Records what happened at a visit the doctor has now seen.
   *
   * Calls the gateway first, applies the outcome optimistically, and reverts
   * if the HTTP call fails. Returns whether anything changed.
   */
  recordOutcome(id: string, outcome: VisitOutcome): boolean {
    const current = this.appointmentState().find(
      (appointment) => appointment.id === id && appointment.doctorId === this.doctorId,
    );
    if (!current || current.status !== 'confirmed') return false;

    const previous = this.appointmentState();
    firstValueFrom(this.gateway.updateAppointmentStatus(id, outcome)).catch(() => {
      this.appointmentState.set(previous);
    });

    this.appointmentState.update((appointments) =>
      appointments.map((appointment) =>
        appointment.id === id ? { ...appointment, status: outcome } : appointment,
      ),
    );
    return true;
  }

  /**
   * Replaces the published availability with a saved week.
   *
   * Drops any session that cannot be used. Persists slots through the gateway
   * and reverts if any creation fails.
   */
  saveSchedule(days: readonly ScheduleDay[]): void {
    const previous = this.scheduleState();
    const saved = days.map((day) => ({
      dayOfWeek: day.dayOfWeek,
      sessions: usableBlocks(day.sessions),
    }));
    this.scheduleState.set(saved);

    const today = dayKey(new Date());
    const promises = saved.flatMap((day) =>
      day.sessions.map((block) =>
        firstValueFrom(
          this.gateway.createSlot({
            doctorId: this.doctorId,
            startsAt: `${today}T${block.startTime}:00`,
            endsAt: `${today}T${block.endTime}:00`,
          }),
        ),
      ),
    );
    Promise.all(promises).catch(() => {
      this.scheduleState.set(previous);
    });
  }

  /**
   * The sessions in force on one date, in clock order.
   *
   * A dated entry wins over the weekly pattern for its own date and no other.
   * Falls back to the week's entry.
   */
  sessionsOn(date: Date): readonly ScheduleBlock[] {
    const key = dayKey(date);
    const override = this.datedAvailabilityState().find((entry) => entry.date === key);
    const weekly = this.scheduleState().find((day) => day.dayOfWeek === date.getDay());
    return usableBlocks(override ? override.sessions : (weekly?.sessions ?? []));
  }

  /**
   * Whether an appointment may be booked into a session.
   */
  fitsInSession(date: Date, startMinutes: number, durationMinutes: number): boolean {
    const endMinutes = startMinutes + durationMinutes;
    return this.sessionsOn(date).some((block) => {
      const open = minutesOfDay(block.startTime);
      const close = minutesOfDay(block.endTime);
      if (open === null || close === null) return false;
      return startMinutes >= open && endMinutes <= close;
    });
  }

  /**
   * Publishes one dated override.
   *
   * Rejects a date that has already passed, and an entry whose sessions overlap
   * or run backwards, reporting which rather than returning a bare false.
   */
  saveDatedAvailability(entry: DatedAvailability): DatedAvailabilityRefusal | null {
    const date = parseDayKey(entry.date);
    if (!date) return 'invalid-date';
    if (date.getTime() < startOfDay(this.now()).getTime()) return 'in-the-past';

    const sessions = usableBlocks(entry.sessions);
    if (sessions.length !== entry.sessions.length) return 'bad-session';
    if (sessionsOverlap(sessions)) return 'overlapping-sessions';

    const key = dayKey(date);
    const previous = this.datedAvailabilityState();
    this.datedAvailabilityState.update((entries) => [
      ...entries.filter((existing) => existing.date !== key),
      { date: key, sessions },
    ]);
    return null;
  }

  /**
   * Withdraws a dated override, putting that date back on the weekly pattern.
   *
   * Reports whether one was removed.
   */
  clearDatedAvailability(date: string): boolean {
    const before = this.datedAvailabilityState().length;
    this.datedAvailabilityState.update((entries) => entries.filter((e) => e.date !== date));
    return this.datedAvailabilityState().length !== before;
  }

  /**
   * Applies the fields the Profile page is allowed to change.
   *
   * Calls the gateway first, applies the draft optimistically, and reverts if
   * the HTTP call fails. On success the profile is refreshed from the response.
   */
  updateProfile(draft: ProfileDraft): void {
    const current = this.profileState();
    const previous = { ...current };
    firstValueFrom(
      this.gateway.updateProfile({
        id: current.id,
        fullName: draft.name,
        email: draft.email,
        bio: draft.bio,
      } as Partial<Doctor>),
    ).then((updated) => {
      this.profileState.set({
        id: updated.id,
        name: updated.fullName,
        email: updated.userId,
        specialization: updated.specialty,
        licenseNumber: updated.licenseNumber,
        joinedOn: '',
        bio: updated.bio,
      });
    }).catch(() => {
      this.profileState.set(previous);
    });

    this.profileState.update((profile) => ({
      ...profile,
      name: draft.name,
      email: draft.email,
      bio: draft.bio,
    }));
  }

  /** Extract `HH:MM` from a slot timestamp. */
  private slotTime(ts: string): string {
    const match = /T(\d{2}:\d{2})/.exec(ts);
    return match ? match[1] : ts;
  }
}
