import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  Avatar,
  Button,
  Card,
  Dropdown,
  FilterBar,
  Modal,
  MockNotice,
  StatusBadge,
  Table,
  TableCell,
  type BadgeTone,
  type DropdownItem,
  type TableColumn,
} from '../../../shared/components';
import { AdminSession } from '../../admin-session';
import { ToastService } from '../../../core/services/toast.service';
import type { AccountStatus, PatientAccount } from '../../admin.models';

type StatusFilter = 'all' | AccountStatus;

const STATUS_FILTER_ITEMS: DropdownItem[] = [
  { id: 'all', label: 'All statuses' },
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive' },
];

/**
 * Patient accounts.
 *
 * Patients cannot be created here: a patient account is opened by a Secretary
 * at the front desk, so this page can only search, review and enable or disable
 * what already exists. That asymmetry with the staff directories is deliberate
 * and matches who is allowed to do what.
 */
@Component({
  selector: 'app-admin-patients',
  imports: [
    DatePipe,
    Avatar,
    Button,
    Card,
    Dropdown,
    Modal,
    StatusBadge,
    Table,
    TableCell,
    FilterBar,
    MockNotice,
  ],
  templateUrl: './admin-patients.html',
  styleUrl: './admin-patients.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPatients {
  private readonly session = inject(AdminSession);
  private readonly toasts = inject(ToastService);

  protected readonly query = signal('');
  protected readonly statusFilter = signal<StatusFilter>('all');
  protected readonly confirmDisableFor = signal<PatientAccount | null>(null);

  protected readonly statusOptions = STATUS_FILTER_ITEMS;

  protected readonly columns: TableColumn<PatientAccount>[] = [
    { key: 'name', header: 'Patient', sortable: true },
    { key: 'email', header: 'Email', sortable: true, hideBelow: 'lg' },
    { key: 'phone', header: 'Contact', hideBelow: 'md' },
    { key: 'dateOfBirth', header: 'Born', sortable: true, hideBelow: 'md' },
    { key: 'status', header: 'Status', sortable: true },
    { key: 'registeredOn', header: 'Registered', sortable: true, hideBelow: 'lg' },
    { key: 'actions', header: 'Actions', align: 'end' },
  ];

  protected readonly patients = computed(() => {
    const term = this.query().trim().toLowerCase();
    const status = this.statusFilter();
    return this.session
      .patients()
      .filter((patient) => status === 'all' || patient.status === status)
      .filter((patient) => {
        if (!term) return true;
        return [patient.name, patient.email, patient.phone].some((field) =>
          field.toLowerCase().includes(term),
        );
      });
  });

  protected readonly activeCount = computed(
    () => this.session.patients().filter((p) => p.status === 'active').length,
  );
  protected readonly totalCount = computed(() => this.session.patients().length);

  protected onStatusFilterChange(item: DropdownItem): void {
    this.statusFilter.set(item.id as StatusFilter);
  }

  protected statusTone(status: AccountStatus): BadgeTone {
    return status === 'active' ? 'success' : 'neutral';
  }

  protected requestDisable(patient: PatientAccount): void {
    this.confirmDisableFor.set(patient);
  }

  protected cancelDisable(): void {
    this.confirmDisableFor.set(null);
  }

  protected confirmDisable(): void {
    const patient = this.confirmDisableFor();
    if (!patient) return;
    const changed = this.session.setPatientStatus(patient.id, 'inactive');
    this.confirmDisableFor.set(null);

    if (changed) {
      this.toasts.warning(`${patient.name} was disabled`, 'They can no longer book appointments.');
    } else {
      this.toasts.error('Not disabled', `${patient.name} could not be updated.`);
    }
  }

  protected enable(patient: PatientAccount): void {
    if (this.session.setPatientStatus(patient.id, 'active')) {
      this.toasts.success(`${patient.name} was re-enabled`, 'They can book appointments again.');
    } else {
      this.toasts.error('Not re-enabled', `${patient.name} could not be updated.`);
    }
  }
}
