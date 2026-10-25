import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import {
  AppointmentStatusBadge,
  Avatar,
  Card,
  DetailList,
  MockNotice,
  StatusBadge,
  Table,
  TableCell,
  type BadgeTone,
  type TableColumn,
} from '../../../shared/components';
import type { AccountStatus } from '../../../shared/domain/account-status';
import { ageFrom, formatDuration } from '../../secretary.dates';
import { SecretarySession } from '../../secretary-session';
import type { Appointment } from '../../secretary.models';

/**
 * A patient's file as the desk sees them: who they are, how to reach them, and
 * every appointment they have had on this desk.
 *
 * The route parameter is read as a signal rather than from a snapshot, so the
 * page updates when the router reuses this component for a different id instead
 * of showing the previous patient.
 *
 * The lookup goes through `patientById`, which only answers for the assigned
 * doctor's patients. That is what makes a hand-typed URL harmless: an id belonging
 * to another doctor's patient renders the same not-found card as an id nobody has,
 * so the address bar is not a way around the scoping the lists apply.
 *
 * A patient record — diagnoses, notes, prescriptions — is deliberately not here.
 * That is a separate milestone with its own access rules, and showing an empty
 * "Medical history" panel would imply a feature that does not exist. A secretary
 * needs the administrative history to answer the phone, which is what this shows.
 */
@Component({
  selector: 'app-secretary-patient-details',
  imports: [
    DatePipe,
    RouterLink,
    AppointmentStatusBadge,
    Avatar,
    Card,
    DetailList,
    MockNotice,
    StatusBadge,
    Table,
    TableCell,
  ],
  templateUrl: './secretary-patient-details.html',
  styleUrl: './secretary-patient-details.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecretaryPatientDetails {
  private readonly session = inject(SecretarySession);
  private readonly route = inject(ActivatedRoute);

  private readonly patientId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id'))),
    {
      initialValue: this.route.snapshot.paramMap.get('id'),
    },
  );

  /** `null` for an id that is not one of this desk's patients, which renders as a 404. */
  protected readonly patient = computed(() => {
    const id = this.patientId();
    return id ? this.session.patientById(id) : null;
  });

  protected readonly history = computed<Appointment[]>(() => {
    const patient = this.patient();
    return patient ? this.session.appointmentsForPatient(patient.id) : [];
  });

  /** Newest first: a history is read backwards, and so is this table. */
  protected readonly historyRows = computed(() => [...this.history()].reverse());

  // No Doctor column: every row on this desk is the assigned doctor, so the
  // column would repeat one name down the page.
  protected readonly columns: TableColumn<Appointment>[] = [
    { key: 'startsAt', header: 'When', sortable: true },
    { key: 'reason', header: 'Reason' },
    { key: 'durationMinutes', header: 'Length', hideBelow: 'md' },
    { key: 'status', header: 'Status', sortable: true },
  ];

  protected readonly now = this.session.now;

  protected age(): number {
    const patient = this.patient();
    return patient ? ageFrom(patient.dateOfBirth, this.now()) : 0;
  }

  protected length(appointment: Appointment): string {
    return formatDuration(appointment.durationMinutes);
  }

  protected statusTone(status: AccountStatus): BadgeTone {
    return status === 'active' ? 'success' : 'neutral';
  }
}
