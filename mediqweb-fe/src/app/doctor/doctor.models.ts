import type { AccountStatus } from '../shared/domain/account-status';

/**
 * Doctor area domain shapes.
 *
 * These describe what the Doctor screens display. They carry no persistence or
 * business rules — every screen is static until a real service replaces
 * `DoctorSession`.
 *
 * Deliberately absent: diagnoses, clinical notes, prescriptions and vitals.
 * Patient records are a separate milestone with their own access rules, and
 * inventing clinical content here would look like it had been reviewed.
 */

/**
 * Where an appointment is in its lifecycle.
 *
 * A doctor moves an appointment forward; a Secretary creates it. There is no
 * `booked` -> `cancelled` rule enforced here beyond what the buttons offer,
 * because the API's rules are not written yet.
 *
 * Re-exported from `shared/domain` rather than declared here, because the
 * Secretary area works with the same lifecycle and the shared
 * `ui-appointment-status` renders both. Existing imports keep working.
 */
export type { AppointmentStatus } from '../shared/domain/appointment-status';

import type { AppointmentStatus } from '../shared/domain/appointment-status';

/**
 * The two things a doctor can say about a visit that has now happened.
 *
 * The whole of the Doctor area's authority over an appointment. A doctor cannot
 * approve one — that is the front desk's, and it means the patient has said they
 * are coming — and cannot call one off, which is an administrative decision about
 * a booking rather than a record of a consultation. What only the doctor can say
 * is whether the patient was seen or did not turn up.
 *
 * Deliberately a closed union rather than `AppointmentStatus`: naming the two
 * outcomes is what stops a handler from being handed `cancelled` and passing it
 * straight through.
 */
export type VisitOutcome = Extract<AppointmentStatus, 'completed' | 'no-show'>;

export interface Appointment {
  readonly id: string;
  readonly patientId: string;
  readonly doctorId: string;
  /**
   * Local timestamp without a zone, e.g. `2026-04-18T09:00:00`.
   *
   * Deliberately not a UTC instant: a clinic's 09:00 is the clinic's 09:00, and
   * `Date` parses a zone-less string in local time, so `new Date(...)` and the
   * `date` pipe agree without a timezone conversion.
   */
  readonly startsAt: string;
  readonly durationMinutes: number;
  readonly status: AppointmentStatus;
  /** Why the patient is coming in. Administrative, not clinical. */
  readonly reason: string;
}

/**
 * A patient as the Doctor area sees them: enough to identify and contact the
 * person, and nothing about their health.
 */
export interface Patient {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  /** ISO date, e.g. `1986-03-14`. */
  readonly dateOfBirth: string;
  readonly address: string;
  /** ISO date. */
  readonly registeredOn: string;
  readonly status: AccountStatus;
}

/** A patient plus the visit figures the list and dashboard need. */
export interface PatientSummary {
  readonly patient: Patient;
  /** Most recent past appointment with the signed-in doctor, cancelled excluded. */
  readonly lastVisit: Appointment | null;
  /** Next appointment that has not been cancelled, ignoring `no-show`. */
  readonly nextVisit: Appointment | null;
  /** Appointments that reached a consultation, i.e. `completed` or `no-show`. */
  readonly visitCount: number;
}

export interface DoctorProfile {
  readonly id: string;
  readonly name: string;
  /**
   * How the clinic reaches this doctor.
   *
   * The only channel, and deliberately the only one: a published email address is
   * the address a patient already has for their appointments, and a second
   * contact route for a clinician is a number on a website that is out of date.
   */
  readonly email: string;
  readonly specialization: string;
  /** Issued by the regulator, not editable here — the Admin owns it. */
  readonly licenseNumber: string;
  /** ISO date. */
  readonly joinedOn: string;
  /** Short introduction shown to patients when they book. */
  readonly bio: string;
}

/**
 * One continuous run of consulting hours within a day.
 *
 * A range, not an hour count, because a booking has to fall entirely inside one
 * of these — a 14:00 appointment that straddles the end of a morning session is
 * not bookable, and no amount of counting makes it so.
 */
export interface ScheduleBlock {
  /** `HH:MM` on a 24-hour clock, e.g. `09:00`. */
  readonly startTime: string;
  readonly endTime: string;
}

/**
 * The sessions a doctor works in a day, and the most any day may hold.
 *
 * Named rather than an open list because the form is a fixed pair, and a fixed
 * pair is the right amount of structure here: a clinic day is a morning and an
 * afternoon, and letting a doctor add a third block would mean inventing rules
 * for a shape nobody has asked for.
 */
export const SESSION_LABELS = ['Morning', 'Afternoon'] as const;

/** How many sessions a day may carry. Enforced by the form, not the type. */
export const MAX_SESSIONS_PER_DAY = SESSION_LABELS.length;

/**
 * One day of the repeating weekly availability a doctor publishes.
 *
 * A *list* of sessions rather than one open/close pair, because most doctors
 * work a split day and one pair cannot express it. That was not only a display
 * limitation: with a single `close` time, every afternoon booking on a split day
 * was refused as outside-hours, because 14:00 is past the end of the morning.
 *
 * A day with no sessions is closed, so there is no separate `enabled` flag that
 * could disagree with the sessions it claims to switch on.
 */
export interface ScheduleDay {
  /** 0 = Sunday … 6 = Saturday, matching `Date.prototype.getDay()`. */
  readonly dayOfWeek: number;
  /** In clock order. Empty means the doctor does not work that day. */
  readonly sessions: readonly ScheduleBlock[];
}

/**
 * Availability for one specific calendar date.
 *
 * An *override*, not an addition. It replaces the repeating weekly pattern for
 * that one date and leaves every other date alone, which is what a single
 * exception actually needs to say: a Christmas closure, a one-off evening clinic,
 * a half-day for a conference. Adding hours to the week instead would produce a
 * doctor who is open on Christmas because he is open on Thursdays, and a booking
 * that has to consult two records to know whether it may happen.
 *
 * Carries sessions for the same reason `ScheduleDay` does, so a split week and a
 * split exception are described in the same words and cannot drift apart.
 *
 * Deliberately free of any restriction drawn from the week. An override that
 * could only narrow the pattern could not open a day the week has closed, which
 * is half of what these are for.
 */
export interface DatedAvailability {
  /** `YYYY-MM-DD` in local time — the same key `dayKey` produces. */
  readonly date: string;
  /** In clock order. Empty means the doctor does not work that date at all. */
  readonly sessions: readonly ScheduleBlock[];
}

/**
 * Fields the Profile page is allowed to change.
 *
 * Three, and the type says which: specialization, licence number and the joined
 * date are not in it, so a caller cannot hand them over and be believed.
 */
export type ProfileDraft = Pick<DoctorProfile, 'name' | 'email' | 'bio'>;
