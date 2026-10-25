import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  Avatar,
  Button,
  Card,
  Dropdown,
  FormField,
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
import { AdminSession, type StaffKind } from '../../admin-session';
import { ToastService } from '../../../core/services/toast.service';
import type { AccountStatus, StaffAccount } from '../../admin.models';

type StatusFilter = 'all' | AccountStatus;

const STATUS_FILTER_ITEMS: DropdownItem[] = [
  { id: 'all', label: 'All statuses' },
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive' },
];

/**
 * Account directory for doctors and secretaries.
 *
 * Both roles need the same thing — a searchable list, a way to enable or
 * disable an account, and a form to add one — and differ only in a couple of
 * columns, so they share this component and pass a `kind`. Splitting them into
 * two near-identical pages would guarantee the two drift apart.
 *
 * UI only: "adding" an account appends to the in-memory `AdminSession`.
 */
@Component({
  selector: 'admin-staff-directory',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    Avatar,
    Button,
    Card,
    Dropdown,
    FormField,
    Modal,
    StatusBadge,
    Table,
    TableCell,
    FilterBar,
    MockNotice,
  ],
  templateUrl: './staff-directory.html',
  styleUrl: './staff-directory.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StaffDirectory {
  private readonly fb = inject(FormBuilder);
  protected readonly session = inject(AdminSession);
  private readonly toasts = inject(ToastService);

  readonly kind = input.required<StaffKind>();

  protected readonly query = signal('');
  protected readonly statusFilter = signal<StatusFilter>('all');
  protected readonly createOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly confirmDisableFor = signal<StaffAccount | null>(null);

  // ---------------------------------------------------------------------------
  // Wording — everything role-specific is derived from `kind`
  // ---------------------------------------------------------------------------
  protected readonly singular = computed(() => (this.kind() === 'doctor' ? 'doctor' : 'secretary'));
  protected readonly plural = computed(() =>
    this.kind() === 'doctor' ? 'Doctors' : 'Secretaries',
  );
  /** Capitalised, for the dialog title and the create button's label. */
  protected readonly roleLabel = computed(() =>
    this.kind() === 'doctor' ? 'Doctor' : 'Secretary',
  );
  protected readonly statusOptions = STATUS_FILTER_ITEMS;

  protected readonly columns = computed<TableColumn<StaffAccount>[]>(() => {
    const base: TableColumn<StaffAccount>[] = [
      { key: 'name', header: 'Name', sortable: true },
      { key: 'email', header: 'Email', sortable: true, hideBelow: 'lg' },
    ];
    if (this.kind() === 'doctor') {
      base.push(
        { key: 'specialization', header: 'Specialization', hideBelow: 'md' },
        { key: 'licenseNumber', header: 'License', hideBelow: 'lg' },
      );
    }
    base.push(
      { key: 'status', header: 'Status', sortable: true },
      { key: 'joinedOn', header: 'Joined', sortable: true, hideBelow: 'md' },
      { key: 'actions', header: 'Actions', align: 'end' },
    );
    return base;
  });

  // ---------------------------------------------------------------------------
  // Rows
  // ---------------------------------------------------------------------------
  protected readonly accounts = computed(() => {
    const term = this.query().trim().toLowerCase();
    const status = this.statusFilter();
    return this.session
      .staffOf(this.kind())
      .filter((account) => status === 'all' || account.status === status)
      .filter((account) => {
        if (!term) return true;
        return [account.name, account.email, account.licenseNumber ?? ''].some((field) =>
          field.toLowerCase().includes(term),
        );
      })
      .map((account) => ({
        ...account,
        // Denormalised for the table so the default cell renderer can read them.
        specialization: this.session.specializationName(account.specializationId),
      }));
  });

  protected readonly activeCount = computed(
    () => this.session.staffOf(this.kind()).filter((a) => a.status === 'active').length,
  );
  protected readonly totalCount = computed(() => this.session.staffOf(this.kind()).length);

  // ---------------------------------------------------------------------------
  // Create form
  // ---------------------------------------------------------------------------
  /**
   * `name` is one field rather than first and last: the account is displayed by
   * full name everywhere, and splitting the input only to rejoin it on save
   * invited the two halves to disagree with what the table shows.
   *
   * The two password controls exist so the flow can be demonstrated end to end.
   * Nothing keeps the value -- see `StaffDraft`, which deliberately models no
   * credential -- so this is validated and then dropped.
   */
  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    username: ['', [Validators.required]],
    temporaryPassword: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]],
    status: ['active' as AccountStatus],
    // Both of these are doctor-only fields, so they carry no static validator:
    // a `required` on a control that is hidden for secretaries would make the
    // form unsaveable for them. `submit` checks them by role instead. The
    // assigned doctor is the mirror image — secretary-only, and checked the same
    // way for the same reason.
    specializationId: [''],
    licenseNumber: [''],
    assignedDoctorId: [''],
  });

  protected readonly specializationItems = computed(() =>
    this.session.specializationOptions().map((o) => ({ id: o.id, label: o.label })),
  );

  protected readonly assignedDoctorItems = computed(() =>
    this.session.activeDoctorOptions().map((o) => ({ id: o.id, label: o.label })),
  );

  /** Status is chosen here rather than left implicit, so a new hire can start disabled. */
  protected readonly accountStatusItems: DropdownItem[] = [
    { id: 'active', label: 'Active' },
    { id: 'inactive', label: 'Inactive' },
  ];

  protected errorFor(control: 'name' | 'email' | 'username' | 'temporaryPassword'): string | null {
    const field = this.form.controls[control];
    if (!field.touched) return null;
    if (field.hasError('required')) return 'This field is required.';
    if (field.hasError('email')) return 'Enter a valid email address.';
    if (field.hasError('minlength')) return 'Use at least 8 characters.';
    return null;
  }

  /**
   * Reports a confirmation that does not match the password above it.
   *
   * A method rather than a group validator for the same reason as
   * `specializationError`: it reads `touched`, which `markAllAsTouched()` mutates
   * without notifying a signal.
   */
  protected confirmPasswordError(): string | null {
    const field = this.form.controls.confirmPassword;
    if (!field.touched) return null;
    if (field.hasError('required')) return 'This field is required.';
    if (field.value !== this.form.controls.temporaryPassword.value)
      return 'Passwords do not match.';
    return null;
  }

  /**
   * Required for doctors, irrelevant for secretaries, so it is checked by role.
   *
   * A method rather than a `computed`: it reads `control.touched`, which a
   * `markAsTouched()` call mutates without notifying any signal, so a computed
   * would keep returning its first result and the error would never appear.
   */
  protected specializationError(): string | null {
    if (this.kind() !== 'doctor') return null;
    const field = this.form.controls.specializationId;
    if (!field.touched) return null;
    return field.value ? null : 'Choose a specialization.';
  }

  /** Doctor-only, and the reference form marks it required. */
  protected licenseError(): string | null {
    if (this.kind() !== 'doctor') return null;
    const field = this.form.controls.licenseNumber;
    if (!field.touched) return null;
    return field.value.trim() ? null : 'This field is required.';
  }

  /**
   * Required for secretaries, irrelevant for doctors, so it is checked by role —
   * and for a method rather than a `computed` for the reason given above.
   */
  protected assignedDoctorError(): string | null {
    if (this.kind() !== 'secretary') return null;
    const field = this.form.controls.assignedDoctorId;
    if (!field.touched) return null;
    return field.value ? null : 'Choose a doctor to assign them to.';
  }

  /**
   * Whether the form could be saved at all.
   *
   * A clinic with no active doctor has nobody to hand a new secretary to, and
   * the field would then offer an empty dropdown with nothing to pick.
   */
  protected readonly noDoctorToAssign = computed(
    () => this.kind() === 'secretary' && this.assignedDoctorItems().length === 0,
  );

  /**
   * The field's help text, which has to change when there is nothing to pick:
   * an empty dropdown still carrying the usual explanation reads as a broken
   * control rather than as a clinic with no active doctor.
   */
  protected readonly assignedDoctorHint = computed(() =>
    this.noDoctorToAssign()
      ? 'No active doctor to assign. Enable a doctor account first.'
      : 'They will see only this doctor: their appointments, patients and schedules.',
  );

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  protected openCreate(): void {
    this.form.reset();
    this.createOpen.set(true);
  }

  protected closeCreate(): void {
    this.createOpen.set(false);
  }

  protected onStatusFilterChange(item: DropdownItem): void {
    this.statusFilter.set(item.id as StatusFilter);
  }

  protected statusTone(status: AccountStatus): BadgeTone {
    return status === 'active' ? 'success' : 'neutral';
  }

  protected onSpecializationChange(item: DropdownItem): void {
    this.form.controls.specializationId.setValue(item.id);
    this.form.controls.specializationId.markAsTouched();
  }

  protected onAssignedDoctorChange(item: DropdownItem): void {
    this.form.controls.assignedDoctorId.setValue(item.id);
    this.form.controls.assignedDoctorId.markAsTouched();
  }

  protected onStatusChange(item: DropdownItem): void {
    this.form.controls.status.setValue(item.id as AccountStatus);
    this.form.controls.status.markAsTouched();
  }

  protected submit(): void {
    const missingSpecialization =
      this.kind() === 'doctor' && !this.form.controls.specializationId.value;
    const missingLicense =
      this.kind() === 'doctor' && !this.form.controls.licenseNumber.value.trim();
    // A secretary with no doctor is not a secretary yet: signing in would show
    // them an empty area, so the assignment is a condition of creating them
    // rather than something to fill in later.
    const missingDoctor = this.kind() === 'secretary' && !this.form.controls.assignedDoctorId.value;
    const mismatched =
      this.form.controls.confirmPassword.value !== this.form.controls.temporaryPassword.value;

    if (
      this.form.invalid ||
      missingSpecialization ||
      missingLicense ||
      missingDoctor ||
      mismatched
    ) {
      this.form.markAllAsTouched();
      // A warning rather than an error: nothing was attempted and nothing failed,
      // the form was not filled in. The field-level messages say which fields.
      this.toasts.warning(
        'Check the form',
        `${this.singular() === 'doctor' ? 'A doctor' : 'A secretary'} account needs the highlighted fields before it can be created.`,
      );
      return;
    }

    this.saving.set(true);
    const { name, email, username, status, specializationId, licenseNumber, assignedDoctorId } =
      this.form.getRawValue();

    const created = this.session.addStaffAccount(this.kind(), {
      name,
      email,
      username,
      status,
      // Secretaries have no specialization, and doctors have no desk, so each
      // role's field is dropped for the other.
      specializationId: this.kind() === 'doctor' ? specializationId : null,
      licenseNumber: this.kind() === 'doctor' ? licenseNumber : null,
      assignedDoctorId: this.kind() === 'secretary' ? assignedDoctorId : null,
    });

    this.saving.set(false);
    this.createOpen.set(false);
    // Announced after the dialog closes, so the toast is not behind a modal
    // backdrop while it is still on screen.
    this.toasts.success(
      `Account created`,
      `${created.name} was added as a ${this.singular()}. Returning to the list.`,
    );
  }

  protected requestDisable(account: StaffAccount): void {
    this.confirmDisableFor.set(account);
  }

  protected cancelDisable(): void {
    this.confirmDisableFor.set(null);
  }

  protected confirmDisable(): void {
    const account = this.confirmDisableFor();
    if (!account) return;
    const changed = this.session.setStaffStatus(this.kind(), account.id, 'inactive');
    this.confirmDisableFor.set(null);

    // The store's answer decides the tone. Telling somebody an account is locked
    // when it is not would be the worst thing this screen could say.
    if (changed) {
      this.toasts.warning(`${account.name} was disabled`, 'They can no longer sign in.');
    } else {
      this.toasts.error('Not disabled', `${account.name} could not be updated.`);
    }
  }

  protected enable(account: StaffAccount): void {
    const changed = this.session.setStaffStatus(this.kind(), account.id, 'active');
    if (changed) {
      this.toasts.success(`${account.name} was re-enabled`, 'They can sign in again.');
    } else {
      this.toasts.error('Not re-enabled', `${account.name} could not be updated.`);
    }
  }
}
