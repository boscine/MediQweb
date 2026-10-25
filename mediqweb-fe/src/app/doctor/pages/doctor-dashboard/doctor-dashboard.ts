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
import { DoctorSession } from '../../doctor-session';
import type { Appointment, PatientSummary } from '../../doctor.models';

/**
 * Landing page for the Doctor area.
 *
 * Answers the two questions a doctor has on arrival: who am I seeing, and is
 * anything waiting on me. The counts come from the mock session, so they move
 * as appointments are confirmed elsewhere in the area.
 *
 * A doctor never creates an appointment — a Secretary books it — so there is no
 * "new appointment" action here, only the decisions a doctor can actually make.
 */
@Component({
  selector: 'app-doctor-dashboard',
  imports: [DatePipe, RouterLink, Avatar, Card, MockNotice, StatCard, AppointmentStatusBadge],
  templateUrl: './doctor-dashboard.html',
  styleUrl: './doctor-dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DoctorDashboard {
  private readonly session = inject(DoctorSession);

  protected readonly todayCount = computed(() => this.session.todaysAppointments().length);

  protected readonly awaitingCount = computed(
    () => this.session.appointments().filter((a) => a.status === 'booked').length,
  );

  protected readonly patientCount = computed(() => this.session.patients().length);

  protected readonly completedThisWeek = computed(() => this.session.completedThisWeek().length);

  protected readonly today = computed(() => this.session.todaysAppointments());

  protected readonly next = computed(() => this.session.nextAppointment());

  /**
   * The next few patients still to be seen, for the overview column.
   *
   * Sorted by appointment time rather than alphabetically, because the useful
   * order on a dashboard is the order the day will happen in.
   */
  protected readonly upcomingPatients = computed<PatientSummary[]>(() =>
    this.session
      .patients()
      .filter((summary) => summary.nextVisit !== null)
      .sort((a, b) => (a.nextVisit!.startsAt > b.nextVisit!.startsAt ? 1 : -1))
      .slice(0, 4),
  );

  protected patientName(appointment: Appointment): string {
    return this.session.patientName(appointment.patientId);
  }
}
