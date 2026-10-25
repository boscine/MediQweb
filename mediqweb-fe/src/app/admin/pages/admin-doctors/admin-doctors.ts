import { ChangeDetectionStrategy, Component } from '@angular/core';
import { StaffDirectory } from '../../components/staff-directory/staff-directory';

/**
 * Doctors. All of the behaviour lives in `admin-staff-directory`; this page
 * only declares which role the directory is showing.
 */
@Component({
  selector: 'app-admin-doctors',
  imports: [StaffDirectory],
  template: `<admin-staff-directory kind="doctor" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDoctors {}
