import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Avatar, Card, MockNotice, StatusBadge, type BadgeTone } from '../../../shared/components';
import { DAY_NAMES, formatDuration } from '../../secretary.dates';
import { SecretarySession } from '../../secretary-session';
import type { DoctorSummary, ScheduleDay } from '../../secretary.models';

/**
 * The assigned doctor's published week.
 *
 * This page used to lay every doctor's week out side by side, because a Secretary's
 * real question was "who is free on Thursday?" — a question only a clinic-wide desk
 * has to ask. A Secretary assigned to one doctor has one week to book inside, so the
 * page is that week, and the "who else is free" question is somebody else's.
 *
 * Read-only on purpose: a doctor publishes their own hours from the Doctor area,
 * and a Secretary editing them would make the published week depend on who last
 * touched the booking screen. Changing a doctor's availability is the Doctor's
 * action; an Administrator can still take a doctor off the roster entirely.
 */
@Component({
  selector: 'app-secretary-schedules',
  imports: [Avatar, Card, MockNotice, StatusBadge],
  templateUrl: './secretary-schedules.html',
  styleUrl: './secretary-schedules.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecretarySchedules {
  private readonly session = inject(SecretarySession);

  protected readonly dayNames = DAY_NAMES;

  /** The one doctor on this desk, so an empty list means unassigned. */
  protected readonly doctors = computed<DoctorSummary[]>(() => this.session.doctors());

  protected readonly unassignedMessage = this.session.unassignedMessage;

  /** A doctor's week, sorted Sunday-first, ready for the grid. */
  protected daysFor(summary: DoctorSummary): ScheduleDay[] {
    return this.session.scheduleFor(summary.doctor.id);
  }

  protected isEnabled(day: ScheduleDay): boolean {
    return day.enabled;
  }

  /** `09:00 – 12:00`, or an em dash for a closed day. */
  protected window(day: ScheduleDay): string {
    if (!day.enabled) return '—';
    return `${day.startTime} – ${day.endTime}`;
  }

  /** The summary line above the week's hours. */
  protected publishedFor(summary: DoctorSummary): string {
    const days = this.daysFor(summary);
    const open = days.filter((day) => day.enabled).length;
    const minutes = this.session.weeklyMinutes(summary.doctor.id);
    if (!open) return 'Not publishing any hours';

    return `${open} ${open === 1 ? 'day' : 'days'} · ${formatDuration(minutes)} a week`;
  }

  protected statusTone(summary: DoctorSummary): BadgeTone {
    return summary.doctor.status === 'active' ? 'success' : 'neutral';
  }

  /** Appointments this doctor has left to come, for the "how busy" footnote. */
  protected bookedFor(summary: DoctorSummary): number {
    const now = this.session.now().getTime();
    return this.session
      .appointmentsForDoctor(summary.doctor.id)
      .filter(
        (appointment) =>
          (appointment.status === 'booked' || appointment.status === 'confirmed') &&
          new Date(appointment.startsAt).getTime() >= now,
      ).length;
  }
}
