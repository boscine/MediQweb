/**
 * Admin area domain shapes.
 *
 * These describe what the Admin screens display. They deliberately carry no
 * persistence or business rules — every screen is static until a real service
 * replaces the mock session store.
 */

/**
 * An account is either usable or not.
 *
 * Declared in `shared/domain` rather than here because staff and patient
 * accounts carry the same status in every role area, and Admin has no business
 * being the one place that says what an inactive account means. Re-exported so
 * the existing `admin.models` import sites keep working unchanged.
 */
export type { AccountStatus } from '../shared/domain/account-status';
/**
 * Re-exported for the same reason as `AccountStatus`: the Secretary and Doctor
 * areas already agree on what a lifecycle stage means, and the Admin area
 * reading it any other way would be a second definition of the same five.
 */
export type { AppointmentStatus } from '../shared/domain/appointment-status';

import type { AccountStatus } from '../shared/domain/account-status';
import type { AppointmentStatus } from '../shared/domain/appointment-status';

export interface StaffAccount {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  /** What they type at sign-in, alongside their email. */
  readonly username: string;
  readonly status: AccountStatus;
  /** Doctors only. */
  readonly specializationId: string | null;
  /** Doctors only. */
  readonly licenseNumber: string | null;
  /**
   * Secretaries only. The doctor whose desk this secretary works, and the whole
   * limit on what they can see: the Secretary area reads its appointments,
   * patients and schedules through this one doctor and nothing else.
   *
   * Null rather than absent because an unassigned secretary is a real state an
   * admin can create (there may be no active doctor to give them yet), and the
   * screens that would show it need to be able to say so rather than guess.
   */
  readonly assignedDoctorId: string | null;
  /** ISO date, e.g. `2026-04-18`. */
  readonly joinedOn: string;
  /** ISO date, or null when the account has never signed in. */
  readonly lastActiveOn: string | null;
}

export interface PatientAccount {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  /** ISO date, e.g. `1991-02-11`. */
  readonly dateOfBirth: string;
  readonly status: AccountStatus;
  /** ISO date. */
  readonly registeredOn: string;
}

export interface Specialization {
  readonly id: string;
  readonly name: string;
  readonly description: string;
}

/** How much attention an audit entry deserves. Drives the row's badge tone. */
export type AuditSeverity = 'info' | 'warning' | 'danger';

/**
 * A clinic appointment as the Admin area sees it.
 *
 * Read-only: the Admin reads the clinic's shape but does not book, confirm or
 * cancel anything, so this carries no actions — only the fields the dashboard
 * needs to describe what is happening across the clinic. The ids point at this
 * area's own patient and staff fixtures, not at the Secretary's cohort, for the
 * same reason `MOCK_PATIENTS` does.
 */
export interface Appointment {
  readonly id: string;
  readonly patientId: string;
  readonly doctorId: string;
  /**
   * Local timestamp without a zone, e.g. `2026-10-07T09:00:00`.
   *
   * Deliberately not a UTC instant: a clinic's 09:00 is the clinic's 09:00,
   * and `Date` parses a zone-less string in local time, so the two agree
   * without a timezone conversion.
   */
  readonly startsAt: string;
  readonly durationMinutes: number;
  readonly status: AppointmentStatus;
  /** Why the patient is coming in. Administrative, not clinical. */
  readonly reason: string;
}

export interface AuditEntry {
  readonly id: string;
  /** Who performed the action. */
  readonly actor: string;
  /** What they did, in the past tense, e.g. "Deactivated account". */
  readonly action: string;
  /** What they did it to, e.g. "Dr. Elena Vargas". */
  readonly target: string;
  /** ISO date and time. */
  readonly at: string;
  readonly severity: AuditSeverity;
}

/**
 * Role-specific extras collected by the create-account form.
 *
 * Deliberately carries no password. The form collects a temporary one so the
 * flow can be demonstrated end to end, but a credential has no business being
 * modelled, let alone held in a mock store, so it is validated and dropped at
 * the edge. When the API branch lands this is where the hash would be produced
 * and sent, never stored here.
 */
export interface StaffDraft {
  readonly name: string;
  readonly email: string;
  readonly username: string;
  readonly status: AccountStatus;
  /** Doctors only. */
  readonly specializationId?: string | null;
  /** Doctors only. */
  readonly licenseNumber?: string | null;
  /**
   * Secretaries only. Optional on the draft because the form collects one field
   * for each role and the other role's field is simply left out; `addStaffAccount`
   * is what decides which of them survives onto the account.
   */
  readonly assignedDoctorId?: string | null;
}
