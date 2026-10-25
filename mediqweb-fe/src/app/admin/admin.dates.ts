/**
 * Date helpers for the Admin area's analytics.
 *
 * A local copy rather than an import from the Doctor or Secretary area. Those
 * two already duplicate each other's helpers on purpose, and the duplicate is
 * what stops the admin charts from moving the day another area's date handling
 * changes.
 *
 * Timestamps are zone-less local strings (see `Appointment.startsAt`), so
 * everything here works on local parts. No `toISOString()` anywhere: it
 * converts to UTC and would move an appointment to the wrong day for anyone
 * east or west of Greenwich.
 */

const pad = (value: number): string => String(value).padStart(2, '0');

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/**
 * Weekday names in the order a working week is read in: Monday first.
 *
 * Not `Date`'s own order, which starts on Sunday. A clinic's week starts when
 * it opens, and a heatmap that led with Sunday would put the two quietest days
 * of the week at the top of the grid.
 */
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** `YYYY-MM-DD` for a `Date`, in local time. */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Midnight on the day `date` falls in. */
export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/**
 * `date` moved by whole calendar days.
 *
 * `setDate` rather than adding 86,400,000 ms: across a daylight-saving boundary
 * a fixed millisecond step lands on the same clock time rather than the same
 * date, so it would put one day in a window twice and drop another.
 */
export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/**
 * The `count` calendar days ending on `end`, oldest first.
 *
 * Stepped one date at a time rather than by a fixed offset, for the reason
 * `addDays` gives.
 */
export function dayWindowEndingOn(end: Date, count: number): Date[] {
  const last = startOfDay(end);
  const days: Date[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) days.push(addDays(last, -offset));
  return days;
}

/**
 * A `Date` at local midnight on a `YYYY-MM-DD` day, or `null` if it is not one.
 *
 * Built from the parts rather than handed to `new Date(string)`: that parses a
 * bare `YYYY-MM-DD` as UTC, so a clinic east of Greenwich would read the 1st of
 * a month as the last day of the previous one. The round-trip is what rejects
 * an impossible day — `new Date(2026, 1, 31)` is not an error, it is 3 March.
 */
export function parseDayKey(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) || dayKey(date) !== key ? null : date;
}

/** `YYYY-MM` for the month `date` falls in. */
export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

/** The first of the month `date` falls in, at local midnight. */
export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * `date` moved by whole calendar months, landing on the first of the month.
 *
 * Clamped to the 1st because a month counter has no day of its own, and
 * `new Date(2026, 0, 31)` rolled forward is 3 March — a month step that skips
 * February entirely.
 */
export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

/** `Sep 25` — short month and two-digit year, which stays unambiguous. */
export function monthLabel(date: Date): string {
  return `${MONTH_NAMES[date.getMonth()]} ${String(date.getFullYear()).slice(2)}`;
}

/** `6 Oct` — short day and month, for a daily axis. */
export function dayLabel(date: Date): string {
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;
}

/** `08:00`, for an hour bucket on the heatmap's slot axis. */
export function hourLabel(hour: number): string {
  return `${pad(hour)}:00`;
}

/** 0 = Monday … 6 = Sunday, for indexing `WEEKDAYS`. */
export function weekdayIndex(date: Date): number {
  // `Date.getDay()` is 0 = Sunday, so Sunday has to be pushed to the end.
  return (date.getDay() + 6) % 7;
}
