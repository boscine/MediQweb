import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Avatar,
  Card,
  Dropdown,
  FilterBar,
  MockNotice,
  StatusBadge,
  Table,
  TableCell,
  type BadgeTone,
  type DropdownItem,
  type TableColumn,
} from '../../../shared/components';
import type { AccountStatus } from '../../../shared/domain/account-status';
import { DoctorSession } from '../../doctor-session';

type StatusFilter = 'all' | AccountStatus;

const STATUS_ITEMS: DropdownItem[] = [
  { id: 'all', label: 'All accounts' },
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive' },
];

/**
 * A display row, flattened from `PatientSummary`.
 *
 * `ui-table` sorts by comparing the raw value under a column key, so a column
 * holding an `Appointment` would compare `"[object Object]"` with itself and
 * silently never reorder — a sortable header that looks broken. Flattening to
 * primitives makes every sortable column real. `null` sorts to the end, which is
 * what the table's comparator already does.
 */
interface PatientRow {
  readonly id: string;
  readonly name: string;
  readonly phone: string;
  readonly email: string;
  readonly status: AccountStatus;
  /** ISO timestamp, or `null` when the patient has never been seen. */
  readonly lastVisitAt: string | null;
  /** ISO timestamp, or `null` when nothing is booked. */
  readonly nextVisitAt: string | null;
  readonly visitCount: number;
}

/**
 * The patients this doctor has a relationship with.
 *
 * The list is derived from appointments rather than from everyone who has ever
 * registered, which is both a privacy boundary and a much shorter list: a
 * clinic has thousands of patients and a doctor has dozens. An inactive account
 * is still listed, because the history stays with it — the filter is there to
 * find those quickly, not to hide them.
 */
@Component({
  selector: 'app-doctor-patients',
  imports: [
    DatePipe,
    RouterLink,
    Avatar,
    Card,
    Dropdown,
    FilterBar,
    MockNotice,
    StatusBadge,
    Table,
    TableCell,
  ],
  templateUrl: './doctor-patients.html',
  styleUrl: './doctor-patients.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DoctorPatients {
  private readonly session = inject(DoctorSession);

  protected readonly query = signal('');
  protected readonly statusFilter = signal<StatusFilter>('all');

  protected readonly statusOptions = STATUS_ITEMS;

  protected readonly columns: TableColumn<PatientRow>[] = [
    { key: 'name', header: 'Patient', sortable: true },
    { key: 'phone', header: 'Contact', hideBelow: 'md' },
    { key: 'lastVisitAt', header: 'Last visit', sortable: true },
    { key: 'nextVisitAt', header: 'Next appointment', sortable: true },
    { key: 'visitCount', header: 'Visits', align: 'end', sortable: true },
    { key: 'status', header: 'Account', sortable: true, hideBelow: 'lg' },
    { key: 'actions', header: 'Actions', align: 'end' },
  ];

  protected readonly rows = computed<PatientRow[]>(() => {
    const term = this.query().trim().toLowerCase();
    const status = this.statusFilter();
    return this.session
      .patients()
      .filter((summary) => {
        if (status !== 'all' && summary.patient.status !== status) return false;
        if (!term) return true;
        return [summary.patient.name, summary.patient.email, summary.patient.phone].some((field) =>
          field.toLowerCase().includes(term),
        );
      })
      .map((summary): PatientRow => ({
        id: summary.patient.id,
        name: summary.patient.name,
        phone: summary.patient.phone,
        email: summary.patient.email,
        status: summary.patient.status,
        lastVisitAt: summary.lastVisit?.startsAt ?? null,
        nextVisitAt: summary.nextVisit?.startsAt ?? null,
        visitCount: summary.visitCount,
      }));
  });

  protected readonly totalCount = computed(() => this.session.patients().length);

  /** How many have something booked — the number worth a follow-up call. */
  protected readonly dueBackCount = computed(
    () => this.session.patients().filter((summary) => summary.nextVisit !== null).length,
  );

  protected onStatusFilterChange(item: DropdownItem): void {
    this.statusFilter.set(item.id as StatusFilter);
  }

  protected statusTone(status: AccountStatus): BadgeTone {
    return status === 'active' ? 'success' : 'neutral';
  }
}
