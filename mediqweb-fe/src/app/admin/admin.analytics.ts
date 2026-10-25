import type { ChartBar } from '../shared/components/charts/bar-chart/bar-chart';
import type { HeatmapMatrix } from '../shared/components/charts/heatmap/heatmap';
import type { LinePoint } from '../shared/components/charts/line-chart/line-chart';
import {
  addDays,
  addMonths,
  dayKey,
  dayLabel,
  hourLabel,
  monthKey,
  monthLabel,
  parseDayKey,
  startOfDay,
  startOfMonth,
  WEEKDAYS,
  weekdayIndex,
} from './admin.dates';
import type { Appointment, AppointmentStatus, PatientAccount, StaffAccount } from './admin.models';

/**
 * The aggregations behind the dashboard's charts.
 *
 * Pure functions over the same fixtures the rest of the Admin area reads, so
 * what a chart shows can be checked against the records it was built from
 * without rendering anything. Nothing here formats for display beyond a label:
 * the components own their own axes and tooltips.
 *
 * Every chart on the page is drawn from mock data, exactly as the rest of the
 * area is. The page's sample-data notice is the one place that says so; the
 * charts do not each repeat it.
 */

/**
 * The statuses every chart on the dashboard counts.
 *
 * `cancelled` and `no-show` are outcomes rather than stages, which is why the
 * pie chart already leaves them out. Counting them in one chart and not another
 * would put two different totals for the same fortnight on one screen, so the
 * whole page uses this one list.
 */
export const CHARTED_STATUSES: readonly AppointmentStatus[] = ['booked', 'confirmed', 'completed'];

/**
 * How many days the appointment charts report over.
 *
 * Fourteen, so each weekday falls in the window exactly twice. A day-of-week
 * heatmap over a shorter window would be comparing a Monday against however
 * many Tuesdays happened to fit, which is not a comparison.
 */
export const REPORT_WINDOW_DAYS = 14;

/** The fortnight a chart is reporting on, by calendar day. */
export interface ReportWindow {
  readonly from: Date;
  readonly to: Date;
}

/** The `REPORT_WINDOW_DAYS` days ending on `now`, inclusive at both ends. */
export function reportWindow(now: Date): ReportWindow {
  const to = startOfDay(now);
  return { from: addDays(to, -(REPORT_WINDOW_DAYS - 1)), to };
}

/** Whether a zone-less timestamp falls in the window, by calendar day. */
export function withinWindow(startsAt: string, window: ReportWindow): boolean {
  const day = startsAt.slice(0, 10);
  return day >= dayKey(window.from) && day <= dayKey(window.to);
}

/**
 * The appointments a chart counts: the charted statuses, inside the window.
 *
 * A `startsAt` with no usable date is left out rather than guessed at. The
 * fixtures all carry one, and a test pins that, so a record that lost its date
 * fails loudly instead of silently changing a chart's total.
 */
function charted(appointments: readonly Appointment[], window: ReportWindow): Appointment[] {
  return appointments.filter(
    (appointment) =>
      CHARTED_STATUSES.includes(appointment.status) && withinWindow(appointment.startsAt, window),
  );
}

/**
 * New patient registrations, one bar per calendar month.
 *
 * The span runs from the earliest registration on record to the month `now`
 * falls in, and every month between is drawn — including the months with
 * nothing in them. A chart that showed only the months that had a registration
 * would turn six registrations spread unevenly across a year into a tidy,
 * continuous climb, which is the opposite of what the data says.
 *
 * Counts registrations, not patients: it reads `registeredOn`, so an account
 * disabled since still belongs to the month it was created in.
 *
 * A registration dated after `now` is ignored, which cannot happen with the
 * fixture but would otherwise be a bar in a month the loop has already passed.
 */
export function registrationSeries(patients: readonly PatientAccount[], now: Date): ChartBar[] {
  const dated = patients
    .map((patient) => parseDayKey(patient.registeredOn))
    .filter((date): date is Date => date !== null);
  if (dated.length === 0) return [];

  const counts = new Map<string, number>();
  for (const date of dated) {
    const key = monthKey(date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const earliest = dated.reduce((min, date) => (date < min ? date : min));
  const last = startOfMonth(now);

  const series: ChartBar[] = [];
  for (let cursor = startOfMonth(earliest); cursor <= last; cursor = addMonths(cursor, 1)) {
    series.push({ label: monthLabel(cursor), value: counts.get(monthKey(cursor)) ?? 0 });
  }
  return series;
}

/**
 * Appointments per day across the reporting window, oldest first.
 *
 * Zero-filled: a day the clinic booked nothing is part of the trend, and a line
 * joining one appointment to the next across a silent week would draw a rise
 * that never happened.
 */
export function appointmentTrendSeries(
  appointments: readonly Appointment[],
  now: Date,
): LinePoint[] {
  const window = reportWindow(now);
  const counts = new Map<string, number>();
  for (const appointment of charted(appointments, window)) {
    const key = appointment.startsAt.slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const points: LinePoint[] = [];
  for (let day = window.from; day <= window.to; day = addDays(day, 1)) {
    points.push({ label: dayLabel(day), value: counts.get(dayKey(day)) ?? 0 });
  }
  return points;
}

/**
 * When the clinic is busiest: appointments per weekday per booked hour.
 *
 * One row per weekday, Monday first, and one column per hour. The hours run
 * from the earliest to the latest appointment actually booked, rather than from
 * a configured opening time, because no operating-hours setting is wired to the
 * Admin area — the Settings screen that claimed to hold booking windows was
 * removed rather than left to look load-bearing. Deriving the range means no
 * appointment is dropped for falling outside a window this area cannot know,
 * and the hours with nothing booked still appear because they sit between two
 * that have something.
 *
 * Every appointment that counts is placed somewhere in the grid, so `total`
 * reconciles with the trend chart's sum over the same window.
 *
 * How a cell is shaded is the component's business, not this one's — see
 * `heatLevel`. Nothing here knows what "busy" looks like.
 */
export function clinicHeatmap(appointments: readonly Appointment[], now: Date): HeatmapMatrix {
  const window = reportWindow(now);

  const dated = charted(appointments, window)
    .map((appointment) => new Date(appointment.startsAt))
    .filter((date) => !Number.isNaN(date.getTime()));

  if (dated.length === 0) {
    return { days: WEEKDAYS, slots: [], cells: [], total: 0 };
  }

  const hours = dated.map((date) => date.getHours());
  const firstHour = Math.min(...hours);
  const lastHour = Math.max(...hours);

  const slots: string[] = [];
  for (let hour = firstHour; hour <= lastHour; hour += 1) slots.push(hourLabel(hour));

  const counts = new Map<string, number>();
  for (const date of dated) {
    const key = `${weekdayIndex(date)}:${date.getHours()}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const cells = [];
  let total = 0;
  for (let dayIndex = 0; dayIndex < WEEKDAYS.length; dayIndex += 1) {
    for (let hour = firstHour; hour <= lastHour; hour += 1) {
      const count = counts.get(`${dayIndex}:${hour}`) ?? 0;
      cells.push({ dayIndex, slotIndex: hour - firstHour, count });
      total += count;
    }
  }

  return { days: WEEKDAYS, slots, cells, total };
}

/**
 * One doctor's workload, for the horizontal bars.
 *
 * Extends the bar shape rather than restating it, so the same value can be
 * handed straight to a chart. `label` is the doctor's name — the axis label is
 * what `label` means to a chart — and `doctorId` is kept alongside it so a bar
 * can be traced back to the account it came from.
 */
export interface WorkloadBar extends ChartBar {
  readonly doctorId: string;
}

/**
 * Completed consultations per doctor in the window, busiest first.
 *
 * `completed` and nothing else. A booked appointment has not happened, and a
 * confirmed one has not either; counting them would report work as done that
 * nobody has done yet. Cancelled and no-show are excluded for the same reason
 * they are excluded everywhere else on the page — they are outcomes, not
 * consultations.
 *
 * Every doctor in the staff list is listed, including those with none and those
 * whose account is inactive. A workload chart is also a chart of who is not
 * working, and leaving people out of it would make the chart's own totals
 * disagree with the pie chart's Finished slice without saying why. An inactive
 * doctor's zero is not filtered out, because "inactive" does not mean "had no
 * appointments in this window" — it is a separate fact, and the two should not
 * be conflated in a chart that is only about the window.
 *
 * Sorted by count descending, then by name so the order is stable between two
 * doctors on the same count.
 */
export function doctorWorkload(
  appointments: readonly Appointment[],
  doctors: readonly StaffAccount[],
  now: Date,
): WorkloadBar[] {
  const window = reportWindow(now);

  const counts = new Map<string, number>();
  for (const appointment of appointments) {
    if (appointment.status !== 'completed' || !withinWindow(appointment.startsAt, window)) continue;
    counts.set(appointment.doctorId, (counts.get(appointment.doctorId) ?? 0) + 1);
  }

  return doctors
    .map((doctor) => ({
      doctorId: doctor.id,
      label: doctor.name,
      value: counts.get(doctor.id) ?? 0,
    }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}
