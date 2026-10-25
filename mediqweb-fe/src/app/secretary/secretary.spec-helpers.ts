import { CLOSED_STATUSES, SecretarySession } from './secretary-session';

/**
 * Puts the session clock on a day this desk actually has appointments for.
 *
 * `atOpen(doctorId, 0, …)` does not mean "today". It means the doctor's first
 * working day at or after today, because a booking cannot be placed on a day the
 * doctor is closed — and that closed Monday is deliberate, since it is what the
 * booking rules are demonstrated with.
 *
 * So the two disagree on Mondays. Every "today" fixture lands on Tuesday while
 * `todaysAppointments` stays scoped to the real today, and the desk comes back
 * empty. That emptiness is correct: a Secretary whose doctor is off today has
 * nothing to show today. It is the test that was wrong to assume otherwise, so
 * the clock moves to a day the desk has rows for rather than the fixtures being
 * bent until they agree with whichever weekday the suite happens to run on.
 *
 * Reads the store's own desk-scoped list rather than the fixtures, so it still
 * points somewhere real after a test has reassigned the desk.
 *
 * Throws when the desk has nothing open at all. Returning quietly would leave
 * the day-scoped tests to fail one at a time with an unrelated-looking message,
 * which is how the real cause stays hidden.
 */
export function pinToDeskDay(session: SecretarySession): void {
  const open = session.appointments().find((a) => !CLOSED_STATUSES.includes(a.status));
  if (!open) {
    throw new Error('This desk has no open appointments, so there is no day to pin the clock to.');
  }
  session.now.set(new Date(open.startsAt));
}
