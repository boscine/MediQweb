import { ChangeDetectionStrategy, Component } from '@angular/core';
import { StaffDirectory } from '../../components/staff-directory/staff-directory';

/**
 * Secretaries. Shares `admin-staff-directory` with the Doctors page; the only
 * difference is the role, which also decides whether a specialization column
 * and field appear.
 */
@Component({
  selector: 'app-admin-secretaries',
  imports: [StaffDirectory],
  template: `<admin-staff-directory kind="secretary" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSecretaries {}
