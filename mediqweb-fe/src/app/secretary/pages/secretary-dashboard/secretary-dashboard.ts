import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AppointmentStatusBadge,
  Avatar,
  Card,
  MockNotice,
  StatCard,
} from '../../../shared/components';
import { SecretarySession } from '../../secretary-session';
import type { Appointment } from '../../secretary.models';

/**
 * Landing page for the Secretary area.
 *
 * Answers the three questions a secretary has on arrival: what is happening
 * today, who is still to be seen, and what is outstanding. The counts come from
 * the mock session, so they move as appointments are booked and cancelled
 * elsewhere in the area.
 *
 * Everything here is one doctor's day, not the clinic's: a Secretary is assigned
 * to a doctor and sees that doctor's appointments, patients and schedule. So
 * there is no "N doctors available" stat and no available-doctors list to scan —
 * with one doctor on the roster both would be a list of one saying what the page
 * heading could say instead.
 *
 * The booking action is a link rather than a form on this page: booking needs a
 * patient, a time and a reason, which is a screen of its own. Opening the list
 * with the form ready is one click and no lost context.
 */
@Component({
  selector: 'app-secretary-dashboard',
  imports: [DatePipe, RouterLink, AppointmentStatusBadge, Avatar, Card, MockNotice, StatCard],
  templateUrl: './secretary-dashboard.html',
  styleUrl: './secretary-dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecretaryDashboard {
  private readonly session = inject(SecretarySession);

  /** The doctor whose desk this is, or `null` while unassigned. */
  protected readonly assignedDoctor = computed(() => this.session.assignedDoctor());

  protected readonly unassignedMessage = this.session.unassignedMessage;

  protected readonly todayCount = computed(() => this.session.todaysAppointments().length);

  protected readonly awaitingCount = computed(() => this.session.awaitingConfirmation().length);

  protected readonly patientCount = computed(() => this.session.patients().length);

  protected readonly completedCount = computed(() => this.session.completedThisWeek().length);

  protected readonly today = computed(() => this.session.todaysAppointments());

  protected readonly next = computed(() => this.session.nextAppointment());

  protected patientName(appointment: Appointment): string {
    return this.session.patientName(appointment.patientId);
  }

  protected doctorName(appointment: Appointment): string {
    return this.session.doctorName(appointment.doctorId);
  }
}
