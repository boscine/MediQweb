/**
 * Date helpers for the Secretary area.
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
  return age;
}

/** `HH:MM` string to minutes since midnight, or `null` if invalid. */
export function minutesOfDay(value: string): number | null {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Minutes to `HH:MM` on a 24-hour clock. */
export function formatMinutes(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/** Human-readable `Xh Ym` from minutes. */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0m';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours ? (mins ? `${hours}h ${mins}m` : `${hours}h`) : `${mins}m`;
}

/** Day index to name. 0 = Sunday. */
export const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/** Short month names, for the day separators in a message thread. */
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

/** Whole days between two instants, floored. */
function daysBetween(a: Date, b: Date): number {
  return Math.floor((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86_400_000);
}

/**
 * A timestamp phrased relative to now: "Just now", "12 min ago", "2:05 PM",
 * "Yesterday", "4 Mar".
 *
 * Used for the conversation list, where the useful question is "how stale is
 * this?" rather than "on what date?". The cut-off is deliberately a calendar-day
 * boundary rather than a fixed 24 hours, so something sent at 11pm reads as
 * "Yesterday" at 9am — which is what the sender meant — instead of for another
 * nine hours.
 */
export function relativeStamp(iso: string, now: Date): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';

  const minutes = Math.round((now.getTime() - at.getTime()) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;

  const days = daysBetween(now, at);
  if (days === 0) {
    const hours = at.getHours();
    const meridiem = hours < 12 ? 'AM' : 'PM';
    const twelve = hours % 12 === 0 ? 12 : hours % 12;
    return `${twelve}:${pad(at.getMinutes())} ${meridiem}`;
  }
  if (days === 1) return 'Yesterday';
  return shortDate(at);
}

/**
 * `Apr 18`, with no year.
 *
 * Past a certain age a date stops being ambiguous and a weekday name starts
 * being the wrong kind of answer: "Sunday" for a message from two days ago
 * could be either of the last two Sundays, and there is no way to tell which from
 * the word. So the conversation list says "Today", "Yesterday", and then a date —
 * never a weekday.
 *
 * The year is dropped only because every conversation in this area is about the
 * current clinic year; a list that could span one would need it back.
 */
export function shortDate(date: Date): string {
  return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;
}

/**
 * The heading above a run of messages: "Today", "Yesterday", or a date.
 *
 * Separate from `relativeStamp` because the two answer different questions and
 * collapse differently: a thread from last month is "Tuesday" in a list row but
 * "4 Mar" as a divider, since the divider has to stay unambiguous however far
 * back the thread goes.
 */
export function dayLabel(iso: string, now: Date): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';

  const days = daysBetween(now, at);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${MONTH_NAMES[at.getMonth()]} ${at.getDate()}`;
}
