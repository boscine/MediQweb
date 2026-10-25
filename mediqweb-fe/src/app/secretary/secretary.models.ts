import type { AccountStatus } from '../shared/domain/account-status';

/**
 * Secretary area domain shapes.
 *
 * These describe what the Secretary screens display. They carry no persistence or
 * business rules — every screen is static until a real service replaces
 * `SecretarySession`.
 *
 * The Secretary works one doctor's desk: an administrator assigns them to a
 * doctor, and every appointment, patient and schedule here is that doctor's. The
 * records stay clinic-wide in the fixtures — there is one clinic — but nothing
 * below is reachable without going through the assignment first.
 */

/**
 * Where an appointment is in its lifecycle.
 *
 * A Secretary creates and manages appointments; doctors move them forward.
 * The Secretary can book, reschedule, and cancel — but not confirm/complete/no-show,
 * which are clinical decisions the doctor owns.
 *
 * Re-exported from `shared/domain` rather than declared here, because the Doctor
 * area works with the same lifecycle and the shared `ui-appointment-status`
 * renders both. Existing imports keep working.
 */
export type { AppointmentStatus } from '../shared/domain/appointment-status';

import type { AppointmentStatus } from '../shared/domain/appointment-status';

/**
 * The two things a Secretary can do to an existing appointment.
 *
 * Confirming moves a `booked` appointment to `confirmed`; cancelling closes it.
 * Both are administrative — they change whether the patient is expected, never
 * what happens clinically.
 *
 * Notably absent: `book` and `reschedule`. A Secretary does not create
 * appointments and does not move them; a visit arrives `booked` from the patient
 * and this desk either confirms it or calls it off. Marking a visit complete and
 * recording a no-show stay the doctor's, so the two roles between them cover the
 * whole lifecycle without both being able to do the same thing.
 */
export type SecretaryAppointmentAction = 'confirm' | 'cancel';

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
  /**
   * The doctor whose panel this patient is registered with.
   *
   * An attribute of the registration rather than something derived from
   * appointments, and that is the whole reason it is here: a patient who has
   * never had an appointment has no appointment to derive it from, so a panel
   * derived that way would make every walk-in invisible to the desk that has to
   * book them. It is a required id for the same reason `Appointment.doctorId` is
   * — a patient on the books belongs to somebody.
   */
  readonly doctorId: string;
}

/** A patient plus the visit figures the list and dashboard need. */
export interface PatientSummary {
  readonly patient: Patient;
  readonly lastVisit: Appointment | null;
  readonly nextVisit: Appointment | null;
  readonly visitCount: number;
}

export interface Doctor {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  readonly specialization: string;
  /** Issued by the regulator, not editable here — the Admin owns it. */
  readonly licenseNumber: string;
  /** ISO date. */
  readonly joinedOn: string;
  readonly status: AccountStatus;
}

/** A doctor plus availability summary for the list view. */
export interface DoctorSummary {
  readonly doctor: Doctor;
  readonly weeklyHours: string;
  readonly nextAvailable: string | null;
}

/** One day of the repeating weekly availability a doctor publishes. */
export interface ScheduleDay {
  /** 0 = Sunday … 6 = Saturday, matching `Date.prototype.getDay()`. */
  readonly dayOfWeek: number;
  readonly enabled: boolean;
  /** `HH:MM` on a 24-hour clock, e.g. `09:00`. */
  readonly startTime: string;
  readonly endTime: string;
}

export interface SecretaryProfile {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  /** ISO date. */
  readonly joinedOn: string;
  /**
   * The doctor whose desk this Secretary works, or null while unassigned.
   *
   * Set by an administrator, not by the Secretary: it arrives with the signed-in
   * user and is the one fact every screen in this area is scoped by. Null is a
   * real state rather than a placeholder — a desk with no doctor yet — so the
   * screens can say so instead of showing an empty list that looks like a quiet
   * day. With real authentication this field is a field on the current user.
   */
  readonly assignedDoctorId: string | null;
}

// ---------------------------------------------------------------------------
// Messaging
// ---------------------------------------------------------------------------

/**
 * Who a conversation is with.
 *
 * A Secretary's messages are with patients and with doctors, and the two want
 * different subtitles and different follow-up, so the party is tagged rather
 * than resolved by looking an id up in two lists where one id could match both.
 */
export type MessageParty = 'patient' | 'doctor';

/** One message in a thread. */
export interface ConversationMessage {
  readonly id: string;
  readonly conversationId: string;
  /** Zone-less local timestamp, as `Appointment.startsAt`. */
  readonly sentAt: string;
  readonly body: string;
  /**
   * Whether the signed-in Secretary wrote it.
   *
   * Part of the message rather than a comparison against the session's id, so a
   * thread still reads correctly when it is handed to somebody else — a real API
   * would send an author role per message and the screen would not change.
   */
  readonly fromSecretary: boolean;
  /**
   * When the thread was opened, or `null` while the message is still unread.
   *
   * A timestamp rather than a boolean so a real API can return a server-side
   * read receipt without this shape changing, and so "unread since" is available
   * for free if the list ever needs to say it.
   */
  readonly readAt: string | null;
}

/** A thread with one patient or one doctor. */
export interface Conversation {
  readonly id: string;
  readonly party: MessageParty;
  /** The `Patient.id` or `Doctor.id` this thread is with. */
  readonly partyId: string;
  /**
   * Whether the desk still owes something on this thread.
   *
   * Deliberately independent of the unread count: a thread can be read to the
   * last word and still need the Secretary to go and do the thing that was
   * asked for. Deriving one from the other would quietly lose that case.
   */
  readonly awaitingAction: boolean;
}

/** A conversation plus what the list row and the thread header need. */
export interface ConversationSummary {
  readonly conversation: Conversation;
  /** Resolved from `partyId`, so a person's name exists in exactly one fixture. */
  readonly name: string;
  readonly messages: readonly ConversationMessage[];
  readonly unreadCount: number;
  /** `sentAt` of the newest message. Also the list's sort key. */
  readonly lastSentAt: string;
  /** The newest message's text, trimmed onto one line for the list row. */
  readonly preview: string;
  /** The newest message's writer, so the row can say who spoke last. */
  readonly lastFromSecretary: boolean;
}

/** Fields the Profile page is allowed to change. */
export type ProfileDraft = Pick<SecretaryProfile, 'name' | 'email' | 'phone'>;
