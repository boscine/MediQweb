/**
 * Where an appointment is in its lifecycle.
 *
 * Shared because both staff areas that show appointments have to agree on it:
 * the Secretary confirms and calls off; the Doctor completes and records a
 * no-show. `shared-appointment-status` maps these to badge tones, so a type per
 * area would mean a `no-show` rendering in a different colour depending on which
 * side of the desk you were sitting on.
 *
 * The two roles meet at `confirmed`, and that is load-bearing rather than
 * incidental: it is the state the Secretary hands over in, and the precondition
 * for a doctor recording anything. `DoctorSession.recordOutcome` refuses
 * anything not `confirmed`, so a doctor cannot skip the approval by closing a
 * booking the front desk never approved.
 *
 * Note who is *not* here: nothing in the app creates an appointment. The patient
 * asks for a visit and the appointment arrives `booked`, which is what the
 * Secretary then confirms. Booking and moving a booked visit are therefore not
 * actions any role offers, rather than being an action this area forgot to
 * implement — see `SecretarySession.bookingRefusal` for the rules whoever does
 * create one has to satisfy.
 *
 * Each area re-exports this from its own models file, so pages keep importing
 * `AppointmentStatus` from where they always have.
 */
export type AppointmentStatus = 'booked' | 'confirmed' | 'completed' | 'cancelled' | 'no-show';

/** Statuses that mean the patient is expected to turn up. */
export const LIVE_STATUSES: readonly AppointmentStatus[] = ['booked', 'confirmed'];

/** Statuses that end an appointment's life, so it can no longer be acted on. */
export const CLOSED_STATUSES: readonly AppointmentStatus[] = ['completed', 'cancelled', 'no-show'];
