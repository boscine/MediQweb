import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AppointmentStatusBadge,
  Avatar,
  Card,
  Dropdown,
  FilterBar,
  MockNotice,
  Table,
  TableCell,
  type DropdownItem,
  type TableColumn,
} from '../../../shared/components';
import { formatDuration } from '../../secretary.dates';
import { SecretarySession } from '../../secretary-session';
import type { AppointmentStatus } from '../../secretary.models';

type ClosedStatus = Extract<AppointmentStatus, 'completed' | 'cancelled' | 'no-show'>;

type OutcomeFilter = 'all' | ClosedStatus;

const OUTCOME_ITEMS: DropdownItem[] = [
  { id: 'all', label: 'All outcomes' },
  { id: 'completed', label: 'Completed' },
  { id: 'no-show', label: 'No-show' },
  { id: 'cancelled', label: 'Cancelled' },
];

/**
 * A display row, flattened from `Appointment`.
 *
 * `ui-table` sorts by comparing the raw value under a column key, so a column
 * holding an `Appointment` would compare `"[object Object]"` with itself and a
 * sortable header would silently never reorder. Flattening to primitives makes
 * every sortable column real.
 */
interface HistoryRow {
  readonly id: string;
  readonly startsAt: string;
  readonly patientId: string;
  readonly patientName: string;
  readonly doctorName: string;
  readonly reason: string;
  readonly length: string;
  readonly outcome: ClosedStatus;
}

/**
 * Everything this desk has closed on the assigned doctor's book.
 *
 * Three outcomes, because they are the same kind of fact from here: a decision
 * the desk took, a visit that went ahead, and a visit that did not. A patient
 * turned away, a patient seen, and a patient who never arrived are all answers
 * this desk has to be able to give, and a front desk that could only recall the
 * middle one would be unable to explain the other two.
 *
 * Which is why this is not the Doctor area's visit history with a different
 * label: that one leaves cancellations out on purpose, because nobody was seen.
 * See `SecretarySession.deskHistory` for why the two records differ.
 */
@Component({
  selector: 'app-secretary-history',
  imports: [
    DatePipe,
    RouterLink,
    AppointmentStatusBadge,
    Avatar,
    Card,
    Dropdown,
    FilterBar,
    MockNotice,
    Table,
    TableCell,
  ],
  templateUrl: './secretary-history.html',
  styleUrl: './secretary-history.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecretaryHistory {
  private readonly session = inject(SecretarySession);

  protected readonly query = signal('');
  protected readonly outcomeFilter = signal<OutcomeFilter>('all');

  protected readonly outcomeOptions = OUTCOME_ITEMS;

  protected readonly columns: TableColumn<HistoryRow>[] = [
    { key: 'startsAt', header: 'When', sortable: true },
    { key: 'patientName', header: 'Patient', sortable: true },
    { key: 'reason', header: 'Reason', hideBelow: 'md' },
    { key: 'doctorName', header: 'Doctor', hideBelow: 'lg' },
    { key: 'outcome', header: 'Outcome', sortable: true },
    { key: 'actions', header: 'Actions', align: 'end' },
  ];

  protected readonly rows = computed<HistoryRow[]>(() => {
    const term = this.query().trim().toLowerCase();
    const outcome = this.outcomeFilter();

    return this.session
      .deskHistory()
      .filter((appointment) => {
        if (outcome !== 'all' && appointment.status !== outcome) return false;
        if (!term) return true;
        // By the patient's name as well as the reason, otherwise typing "Maria"
        // finds nothing and the box looks broken.
        return (
          this.session.patientName(appointment.patientId).toLowerCase().includes(term) ||
          appointment.reason.toLowerCase().includes(term)
        );
      })
      .map((appointment): HistoryRow => ({
        id: appointment.id,
        startsAt: appointment.startsAt,
        patientId: appointment.patientId,
        patientName: this.session.patientName(appointment.patientId),
        doctorName: this.session.doctorName(appointment.doctorId),
        reason: appointment.reason,
        length: formatDuration(appointment.durationMinutes),
        // Narrowed rather than cast: `deskHistory` cannot return anything else,
        // so this is where that is asserted at compile time.
        outcome: appointment.status as HistoryRow['outcome'],
      }));
  });

  /**
   * Counts for what is on screen, not for the whole record.
   *
   * The caption sits directly above the table it describes, so a filter that
   * matched nothing still read "12 completed · 3 cancelled" above an empty
   * table. It is a summary of the rows below it and has to stay true when they
   * change.
   */
  protected readonly completedCount = computed(
    () => this.rows().filter((row) => row.outcome === 'completed').length,
  );

  protected readonly cancelledCount = computed(
    () => this.rows().filter((row) => row.outcome === 'cancelled').length,
  );

  protected readonly noShowCount = computed(
    () => this.rows().filter((row) => row.outcome === 'no-show').length,
  );

  /**
   * One line describing the rows on screen.
   *
   * Switches from "recorded" to "shown" once a filter is in play, so the wording
   * says which of the two it is counting rather than implying the whole record
   * has shrunk to one appointment.
   *
   * The three-way split is the point of the line: a desk where most appointments
   * were cancelled reads very differently from one where most went ahead, and
   * the bare total hides that.
   */
  protected readonly caption = computed(() => {
    const completed = this.completedCount();
    const cancelled = this.cancelledCount();
    const noShows = this.noShowCount();
    const total = completed + cancelled + noShows;
    const filtered = this.query().trim() !== '' || this.outcomeFilter() !== 'all';
    return (
      `${completed} completed · ${noShows} no-show${noShows === 1 ? '' : 's'}` +
      ` · ${cancelled} cancelled` +
      ` · ${total} ${total === 1 ? 'appointment' : 'appointments'} ${filtered ? 'shown' : 'recorded'}`
    );
  });

  protected onOutcomeChange(item: DropdownItem): void {
    this.outcomeFilter.set(item.id as OutcomeFilter);
  }
}
