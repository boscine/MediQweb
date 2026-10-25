/**
 * Date helpers for the Doctor area.
 *
 * Timestamps are zone-less local strings (see `Appointment.startsAt`), so every
 * comparison here is a string comparison on `YYYY-MM-DD` or a `Date` built from
 * a local string. No `toISOString()` anywhere: it converts to UTC and would move
 * an appointment to the wrong day for anyone east or west of Greenwich.
 */

const pad = (value: number): string => String(value).padStart(2, '0');

/** `YYYY-MM-DD` for a `Date`, in local time. */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `YYYY-MM-DDTHH:MM:SS` for a `Date`, in local time. */
export function localIso(date: Date): string {
  return `${dayKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** Midnight on the day `date` falls in. */
export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** True when both timestamps fall on the same local calendar day. */
export function isSameDay(a: Date, b: Date): boolean {
  return dayKey(a) === dayKey(b);
}

/**
 * Whole years between a birth date and `now`, floored.
 *
 * Compares month and day before adjusting the year, so someone who has not had
 * their birthday yet this year is not counted as a year older.
 */
export function ageFrom(dateOfBirth: string, now: Date): number {
  const born = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(born.getTime())) return 0;
  let age = now.getFullYear() - born.getFullYear();
  const monthDiff = now.getMonth() - born.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < born.getDate())) age -= 1;
  return Math.max(0, age);
}

/** Minutes since midnight for an `HH:MM` string, or `null` if it is not one. */
export function minutesOfDay(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * A `Date` at local midnight on a `YYYY-MM-DD` day, or `null` if it is not one.
 *
 * Built from the parts rather than handed to `new Date(string)`: that parses a
 * bare `YYYY-MM-DD` as UTC, so a doctor east of Greenwich asking for the 1st
 * would get the 31st of the previous month. Same reason `dayKey` avoids
 * `toISOString()`.
 *
 * The round-trip is what rejects an impossible day. `new Date(2026, 1, 31)` is
 * not an error — it is 3 March — so a caller offering 31 February would otherwise
 * be given a date that quietly means something else.
 */
export function parseDayKey(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) || dayKey(date) !== key ? null : date;
}

/**
 * Minutes a block covers, or `null` when its hours do not make sense.
 *
 * `null` rather than zero for an invalid block, because zero is a real answer
 * — a day can be published with no hours at all — and folding "unusable" into
 * "empty" would let a broken block quietly shrink a doctor's published week.
 */
export function blockMinutes(block: { startTime: string; endTime: string }): number | null {
  const start = minutesOfDay(block.startTime);
  const end = minutesOfDay(block.endTime);
  if (start === null || end === null || end <= start) return null;
  return end - start;
}

/**
 * The blocks that describe real, usable hours, in clock order.
 *
 * Used wherever hours are counted or displayed, so a malformed block is dropped
 * in exactly the same way by the weekly total, a dated entry and the booking
 * rules. Accepts the two shapes that carry blocks — a week and a single date —
 * which is why it is keyed structurally rather than on `ScheduleBlock[]`.
 */
export function usableBlocks(
  blocks: readonly { startTime: string; endTime: string }[],
): { startTime: string; endTime: string }[] {
  return blocks
    .filter((block) => blockMinutes(block) !== null)
    .sort((a, b) => minutesOfDay(a.startTime)! - minutesOfDay(b.startTime)!);
}

/** `150` -> `2h 30m`. Used for durations and for weekly availability totals. */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}m`;
  if (!rest) return `${hours}h`;
  return `${hours}h ${rest}m`;
}

/**
 * `(1, 'appointment')` -> `'1 appointment'`. `(0, ...)` pluralises, because
 * "0 appointments" is right and "0 appointment" reads as a missing count.
 */
export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
