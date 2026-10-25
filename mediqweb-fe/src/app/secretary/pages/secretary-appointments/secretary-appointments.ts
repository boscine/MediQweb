import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AppointmentStatusBadge,
  Avatar,
  Button,
  Card,
  Dropdown,
  FilterBar,
  MockNotice,
  Modal,
  Table,
  TableCell,
  type DropdownItem,
  type TableColumn,
} from '../../../shared/components';
import { formatDuration } from '../../secretary.dates';
import { SecretarySession } from '../../secretary-session';
import { ToastService } from '../../../core/services/toast.service';
import type { Appointment, AppointmentStatus } from '../../secretary.models';

type StatusFilter = 'all' | AppointmentStatus;

const STATUS_ITEMS: DropdownItem[] = [
  { id: 'all', label: 'All statuses' },
  { id: 'booked', label: 'Booked' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'no-show', label: 'No-show' },
];

/** An appointment can still be called off while the patient is expected. */
const LIVE: readonly AppointmentStatus[] = ['booked', 'confirmed'];

/**
 * Appointment management: the Secretary's main screen.
 *
 * Two actions, and the page is built around that rather than around what it used
 * to offer. A visit arrives `booked` — the patient asked for it — and the desk
 * either confirms it or calls it off. Creating an appointment and moving a booked
 * one to a different time are not actions here at all, so there is no form, no
 * dialog and no state for either; `SecretarySession` does not expose the methods
 * that would perform them, so the absence is enforced below the view rather than
 * by it.
 *
 * Confirming is the Secretary's because it means "the patient said they are
 * coming", which is a phone call. Marking a visit complete and recording a no-show
 * stay the doctor's, so the two roles cover the lifecycle without both being able
 * to do the same thing.
 *
 * Scoped to the assigned doctor, so the page carries no doctor filter and no
 * doctor column: every row would say the same name.
 */
@Component({
  selector: 'app-secretary-appointments',
  imports: [
    DatePipe,
    RouterLink,
    AppointmentStatusBadge,
    Avatar,
    Button,
    Card,
    Dropdown,
    FilterBar,
    MockNotice,
    Modal,
    Table,
    TableCell,
  ],
  templateUrl: './secretary-appointments.html',
  styleUrl: './secretary-appointments.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecretaryAppointments {
  private readonly session = inject(SecretarySession);
  private readonly toasts = inject(ToastService);

  protected readonly query = signal('');
  protected readonly statusFilter = signal<StatusFilter>('all');
  protected readonly confirmCancelFor = signal<Appointment | null>(null);

  protected readonly statusOptions = STATUS_ITEMS;

  protected readonly columns: TableColumn<Appointment>[] = [
    { key: 'startsAt', header: 'When', sortable: true },
    { key: 'patientId', header: 'Patient' },
    { key: 'reason', header: 'Reason', hideBelow: 'lg' },
    { key: 'durationMinutes', header: 'Length', hideBelow: 'lg' },
    { key: 'status', header: 'Status', sortable: true },
    { key: 'actions', header: 'Actions', align: 'end' },
  ];

  protected readonly appointments = computed(() => {
    const term = this.query().trim().toLowerCase();
    const status = this.statusFilter();

    return this.session.appointments().filter((appointment) => {
      if (status !== 'all' && appointment.status !== status) return false;
      if (!term) return true;
      // The patient's name as well as the reason: the doctor is the same on every
      // row, so searching for one would only ever match everything.
      return (
        this.session.patientName(appointment.patientId).toLowerCase().includes(term) ||
        appointment.reason.toLowerCase().includes(term)
      );
    });
  });

  protected readonly totalCount = computed(() => this.session.appointments().length);

  /** Still expected to happen: booked or confirmed, cancelled ones excluded. */
  protected readonly openCount = computed(
    () =>
      this.session.appointments().filter((a) => a.status === 'booked' || a.status === 'confirmed')
        .length,
  );

  /**
   * How many are waiting on this desk.
   *
   * Read from the store rather than counted here, so this page and the dashboard's
   * "Awaiting confirmation" tile cannot drift apart — and so it is desk-scoped the
   * same way the list is. The booking form used to open the page with a paragraph
   * about what a booking had to satisfy; with the form gone, this is the one fact
   * the page exists to act on, and it is the first thing on screen.
   */
  protected readonly awaitingConfirmationCount = computed(
    () => this.session.awaitingConfirmation().length,
  );

  protected onStatusFilterChange(item: DropdownItem): void {
    this.statusFilter.set(item.id as StatusFilter);
  }

  protected patientName(appointment: Appointment): string {
    return this.session.patientName(appointment.patientId);
  }

  protected length(appointment: Appointment): string {
    return formatDuration(appointment.durationMinutes);
  }

  /**
   * Whether Confirm is offered.
   *
   * `booked` only. An appointment that is already confirmed has nothing left to
   * confirm, so showing the button there would offer an action that does nothing
   * and report itself as successful.
   */
  protected canConfirm(appointment: Appointment): boolean {
    return appointment.status === 'booked';
  }

  /** Cancel is offered for as long as the patient is still expected. */
  protected canCancel(appointment: Appointment): boolean {
    return LIVE.includes(appointment.status);
  }

  /**
   * Confirms a booked appointment.
   *
   * Taken straight from the store's answer rather than assumed: a `false` here means
   * the appointment was not `booked` when the store looked, and saying "confirmed"
   * anyway would be a lie on screen. The store refusing is also what keeps this
   * honest if the rules are ever tightened.
   *
   * The two refusals are reported differently, because they are not the same
   * problem. A double-click on Confirm is the ordinary way this happens — the row
   * the handler was given is already stale by the second click — and answering
   * "it may have changed" for that would send a Secretary looking for a problem
   * they caused by being impatient. Only an appointment that is now something
   * *other* than confirmed is genuinely a change worth reporting.
   */
  protected confirm(appointment: Appointment): void {
    const name = this.patientName(appointment);
    if (!this.session.confirm(appointment.id)) {
      const current = this.session.appointments().find((a) => a.id === appointment.id);
      if (current?.status === 'confirmed') {
        // A double-click, the ordinary way this happens: not an error.
        this.toasts.info('Already confirmed', `${name} was confirmed a moment ago.`);
      } else {
        this.toasts.error(
          'Not confirmed',
          `That appointment is now ${current?.status ?? 'gone'}, so it cannot be confirmed.`,
        );
      }
      return;
    }
    this.toasts.success('Appointment confirmed', `${name} is expected.`);
  }

  protected requestCancel(appointment: Appointment): void {
    this.confirmCancelFor.set(appointment);
  }

  protected cancelCancel(): void {
    this.confirmCancelFor.set(null);
  }

  protected confirmCancel(): void {
    const appointment = this.confirmCancelFor();
    if (!appointment) return;
    const changed = this.session.cancel(appointment.id);
    this.confirmCancelFor.set(null);

    if (changed) {
      this.toasts.warning(
        'Appointment cancelled',
        `${this.patientName(appointment)} will not be seen. The visit stays in the history.`,
      );
    } else {
      this.toasts.error('Not cancelled', 'That appointment could not be updated.');
    }
  }
}
