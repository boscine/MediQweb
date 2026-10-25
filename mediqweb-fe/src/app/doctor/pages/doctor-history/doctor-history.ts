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
import { formatDuration } from '../../doctor.dates';
import { DoctorSession } from '../../doctor-session';
import type { AppointmentStatus } from '../../doctor.models';

type OutcomeFilter = 'all' | Extract<AppointmentStatus, 'completed' | 'no-show'>;

const OUTCOME_ITEMS: DropdownItem[] = [
  { id: 'all', label: 'All outcomes' },
  { id: 'completed', label: 'Completed' },
  { id: 'no-show', label: 'No-show' },
];

/**
 * A display row, flattened from `Appointment`.
 *
 * `ui-table` sorts by comparing the raw value under a column key, so a column
 * holding an `Appointment` would compare `"[object Object]"` with itself and
 * silently never reorder. Flattening to primitives makes every sortable column
 * real. The status is narrowed to the two outcomes that reach this page, so the
 * cell cannot be handed a status that has nothing to do with a visit record.
 */
interface HistoryRow {
  readonly id: string;
  readonly startsAt: string;
  readonly patientId: string;
  readonly patientName: string;
  readonly reason: string;
  readonly length: string;
  readonly outcome: Extract<AppointmentStatus, 'completed' | 'no-show'>;
}

/**
 * The record of visits this doctor has seen through.
 *
 * Everything the doctor closed on the Appointments page lands here the moment it
 * is recorded, because that is the only thing in this area the doctor decides
 * for themselves and cannot undo: a completed visit or a missed one is a fact
 * about the clinic's day, and it should be somewhere a colleague or a locum can
 * read rather than scattered through a working list that is about to be cleared.
 *
 * Read newest first, because the question being asked of a history is nearly
 * always "what happened most recently", and the table's own sortable header
 * offers the other order.
 */
@Component({
  selector: 'app-doctor-history',
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
  templateUrl: './doctor-history.html',
  styleUrl: './doctor-history.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DoctorHistory {
  private readonly session = inject(DoctorSession);

  protected readonly query = signal('');
  protected readonly outcomeFilter = signal<OutcomeFilter>('all');

  protected readonly outcomeOptions = OUTCOME_ITEMS;

  protected readonly columns: TableColumn<HistoryRow>[] = [
    { key: 'startsAt', header: 'When', sortable: true },
    { key: 'patientName', header: 'Patient', sortable: true },
    { key: 'reason', header: 'Reason', hideBelow: 'md' },
    { key: 'length', header: 'Length', hideBelow: 'lg' },
    { key: 'outcome', header: 'Outcome', sortable: true },
    { key: 'actions', header: 'Actions', align: 'end' },
  ];

  protected readonly rows = computed<HistoryRow[]>(() => {
    const term = this.query().trim().toLowerCase();
    const outcome = this.outcomeFilter();

    return this.session
      .visitHistory()
      .filter((appointment) => {
        if (outcome !== 'all' && appointment.status !== outcome) return false;
        if (!term) return true;
        // By the patient's name as well as the reason, otherwise typing "Juan"
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
        reason: appointment.reason,
        length: formatDuration(appointment.durationMinutes),
        // Narrowed rather than cast: `visitHistory` cannot return anything
        // else, so this is where that is asserted at compile time.
        outcome: appointment.status as HistoryRow['outcome'],
      }));
  });

  /**
   * Counts for what is on screen, not for the whole record.
   *
   * The caption sits directly above the table it describes, so a filter that
   * matched nothing still read "5 completed · 1 no-show · 6 visits recorded"
   * above an empty table. It is not a header for the record — it is a summary of
   * the rows below it, and has to stay true when the rows change.
   */
  protected readonly completedCount = computed(
    () => this.rows().filter((row) => row.outcome === 'completed').length,
  );

  protected readonly noShowCount = computed(
    () => this.rows().filter((row) => row.outcome === 'no-show').length,
  );

  /**
   * One line describing the rows on screen.
   *
   * Switches from "recorded" to "shown" once a filter is in play, so the wording
   * says which of the two it is counting rather than implying the whole history
   * has shrunk to one visit.
   */
  protected readonly caption = computed(() => {
    const completed = this.completedCount();
    const noShows = this.noShowCount();
    const total = completed + noShows;
    const filtered = this.query().trim() !== '' || this.outcomeFilter() !== 'all';
    return (
      `${completed} completed · ${noShows} no-show${noShows === 1 ? '' : 's'}` +
      ` · ${total} ${total === 1 ? 'visit' : 'visits'} ${filtered ? 'shown' : 'recorded'}`
    );
  });

  protected onOutcomeChange(item: DropdownItem): void {
    this.outcomeFilter.set(item.id as OutcomeFilter);
  }
}
