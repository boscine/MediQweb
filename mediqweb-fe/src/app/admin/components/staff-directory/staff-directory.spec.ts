import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { clearToasts, latestToast } from '../../../core/services/toast.service.spec-helpers';
import { AdminSession } from '../../admin-session';
import { StaffDirectory } from './staff-directory';

describe('StaffDirectory', () => {
  let fixture: ComponentFixture<StaffDirectory>;
  let session: AdminSession;

  // Disarms the dismissal timers the toasts arm. Before every test rather than
  // after one, because `render` resets the TestBed and a toast raised under the
  // previous module's injector would otherwise still be on the stack.
  beforeEach(() => clearToasts());

  afterEach(() => clearToasts());

  async function render(kind: 'doctor' | 'secretary'): Promise<ComponentFixture<StaffDirectory>> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [StaffDirectory], providers: [AdminSession] });
    session = TestBed.inject(AdminSession);
    fixture = TestBed.createComponent(StaffDirectory);
    fixture.componentRef.setInput('kind', kind);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function button(label: string): HTMLButtonElement | undefined {
    const buttons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'),
    );
    return buttons.find((b) => b.textContent?.trim() === label);
  }

  describe('doctors', () => {
    beforeEach(async () => {
      await render('doctor');
    });

    it('shows a specialization column, which secretaries do not get', () => {
      expect(text()).toContain('Specialization');
    });

    it('names the role in the search label and the add button', () => {
      expect(text()).toContain('Search Doctors');
      expect(text()).toContain('Add doctor');
    });

    it('lists every doctor from the session', () => {
      const dir = fixture.componentInstance as any;
      expect(dir['accounts']().length).toBe(session.doctors().length);
    });

    it('filters by name', () => {
      const dir = fixture.componentInstance as any;
      const target = session.doctors()[0].name;
      dir['query'].set(target);
      fixture.detectChanges();
      expect(dir['accounts']().length).toBe(1);
      expect(text()).toContain(target);
    });

    it('filters by status', () => {
      const dir = fixture.componentInstance as any;
      dir['statusFilter'].set('inactive');
      fixture.detectChanges();
      const rows = dir['accounts']();
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r: any) => r.status === 'inactive')).toBe(true);
    });

    it('reports when filters exclude everything', () => {
      const dir = fixture.componentInstance as any;
      dir['query'].set('no-such-person');
      fixture.detectChanges();
      expect(text()).toContain('No doctors match your filters.');
    });
  });

  describe('secretaries', () => {
    beforeEach(async () => {
      await render('secretary');
    });

    it('hides the specialization column and field', () => {
      expect(text()).not.toContain('Specialization');
    });

    it('does not require a specialization, so a secretary can be created', () => {
      const dir = fixture.componentInstance as any;
      dir['form'].setValue({
        name: 'New Hire',
        email: 'new.hire@mediq.ph',
        username: 'newhire',
        temporaryPassword: 'longenough1',
        confirmPassword: 'longenough1',
        status: 'active',
        specializationId: '',
        licenseNumber: '',
        assignedDoctorId: session.activeDoctorOptions()[0].id,
      });
      dir['submit']();
      fixture.detectChanges();
      expect(session.secretaries().some((s) => s.email === 'new.hire@mediq.ph')).toBe(true);
    });

    it('offers only active doctors to assign, since an inactive one has no desk', () => {
      const dir = fixture.componentInstance as any;
      const offered = session.activeDoctorOptions().map((option) => option.id);
      const active = session.doctors().filter((d) => d.status === 'active');
      expect(offered).toEqual(active.map((d) => d.id));
      expect(offered.length).toBeGreaterThan(0);
      expect(dir['assignedDoctorItems']().length).toBe(active.length);
    });

    it('records the chosen doctor on the account it creates', () => {
      const dir = fixture.componentInstance as any;
      const doctor = session.activeDoctorOptions()[1];
      dir['form'].setValue({
        name: 'New Hire',
        email: 'new.hire@mediq.ph',
        username: 'newhire',
        temporaryPassword: 'longenough1',
        confirmPassword: 'longenough1',
        status: 'active',
        specializationId: '',
        licenseNumber: '',
        assignedDoctorId: doctor.id,
      });
      dir['submit']();
      fixture.detectChanges();
      const created = session.secretaries().find((s) => s.email === 'new.hire@mediq.ph');
      expect(created?.assignedDoctorId).toBe(doctor.id);
    });

    it('will not create a secretary with no doctor to assign them to', () => {
      // A desk with nobody on it is not a job, and the Secretary area would show
      // them an empty clinic for the reason.
      const dir = fixture.componentInstance as any;
      dir['form'].setValue({
        name: 'New Hire',
        email: 'new.hire@mediq.ph',
        username: 'newhire',
        temporaryPassword: 'longenough1',
        confirmPassword: 'longenough1',
        status: 'active',
        specializationId: '',
        licenseNumber: '',
        assignedDoctorId: '',
      });
      dir['submit']();
      fixture.detectChanges();
      expect(dir['assignedDoctorError']()).toBe('Choose a doctor to assign them to.');
      expect(session.secretaries().some((s) => s.email === 'new.hire@mediq.ph')).toBe(false);
    });
  });

  describe('create account', () => {
    /** A complete, valid doctor draft. Tests override one field at a time. */
    const validDoctor = {
      name: 'Ana Reyes',
      email: 'ana.reyes@mediq.ph',
      username: 'areyes',
      temporaryPassword: 'longenough1',
      confirmPassword: 'longenough1',
      status: 'active',
      specializationId: 'spec-cardio',
      licenseNumber: 'PRC-1',
    };

    beforeEach(async () => {
      await render('doctor');
    });

    it('refuses an empty form and marks the fields touched', () => {
      const dir = fixture.componentInstance as any;
      const before = session.doctors().length;
      dir['submit']();
      fixture.detectChanges();
      expect(session.doctors().length).toBe(before);
      expect(dir['errorFor']('name')).toBe('This field is required.');
    });

    it('rejects a malformed email', () => {
      const dir = fixture.componentInstance as any;
      dir['form'].patchValue({ ...validDoctor, email: 'not-an-email' });
      dir['submit']();
      fixture.detectChanges();
      expect(dir['errorFor']('email')).toBe('Enter a valid email address.');
    });

    it('requires a username, since staff sign in with one', () => {
      const dir = fixture.componentInstance as any;
      dir['form'].patchValue({ ...validDoctor, username: '' });
      dir['submit']();
      fixture.detectChanges();
      expect(dir['errorFor']('username')).toBe('This field is required.');
      expect(session.doctors().some((d) => d.email === 'ana.reyes@mediq.ph')).toBe(false);
    });

    it('requires a temporary password of at least eight characters', () => {
      const dir = fixture.componentInstance as any;
      dir['form'].patchValue({
        ...validDoctor,
        temporaryPassword: 'short',
        confirmPassword: 'short',
      });
      dir['submit']();
      fixture.detectChanges();
      expect(dir['errorFor']('temporaryPassword')).toBe('Use at least 8 characters.');
    });

    it('refuses a confirmation that does not match', () => {
      const dir = fixture.componentInstance as any;
      dir['form'].patchValue({ ...validDoctor, confirmPassword: 'somethingelse' });
      dir['submit']();
      fixture.detectChanges();
      expect(dir['confirmPasswordError']()).toBe('Passwords do not match.');
      expect(session.doctors().some((d) => d.email === 'ana.reyes@mediq.ph')).toBe(false);
    });

    it('keeps no copy of the password once the account exists', () => {
      // The form collects one so the flow can be walked, but a credential must
      // not survive into the mock store.
      const dir = fixture.componentInstance as any;
      dir['form'].patchValue(validDoctor);
      dir['submit']();
      fixture.detectChanges();
      const created = session.doctors().find((d) => d.email === 'ana.reyes@mediq.ph');
      expect(created).toBeTruthy();
      expect(JSON.stringify(created)).not.toContain('longenough1');
      expect(Object.keys(created ?? {})).not.toContain('password');
    });

    it('requires a specialization for a doctor', () => {
      const dir = fixture.componentInstance as any;
      dir['form'].patchValue({ ...validDoctor, specializationId: '' });
      dir['submit']();
      fixture.detectChanges();
      expect(dir['specializationError']()).toBe('Choose a specialization.');
      expect(session.doctors().some((d) => d.email === 'ana.reyes@mediq.ph')).toBe(false);
    });

    it('requires a license number for a doctor', () => {
      const dir = fixture.componentInstance as any;
      dir['form'].patchValue({ ...validDoctor, licenseNumber: '  ' });
      dir['submit']();
      fixture.detectChanges();
      expect(dir['licenseError']()).toBe('This field is required.');
      expect(session.doctors().some((d) => d.email === 'ana.reyes@mediq.ph')).toBe(false);
    });

    it('creates the account with the status chosen, and announces it', () => {
      const dir = fixture.componentInstance as any;
      dir['form'].patchValue({ ...validDoctor, status: 'inactive' });
      dir['submit']();
      fixture.detectChanges();
      const created = session.doctors().find((d) => d.email === 'ana.reyes@mediq.ph');
      expect(created?.status).toBe('inactive');
      expect(created?.username).toBe('areyes');
      expect(latestToast()?.tone).toBe('success');
      expect(latestToast()?.message).toContain('Ana Reyes');
      // Closed before the toast is raised, so it is not behind the dialog's
      // backdrop while it is on screen.
      expect(dir['createOpen']()).toBe(false);
    });

    it('warns rather than errors when the form is incomplete', () => {
      const dir = fixture.componentInstance as any;
      dir['form'].patchValue({ ...validDoctor, licenseNumber: '' });
      dir['submit']();
      fixture.detectChanges();

      // Nothing was attempted and nothing failed: the form was not filled in. The
      // field-level messages below say which fields.
      expect(latestToast()?.tone).toBe('warning');
      expect(session.doctors().some((d) => d.email === 'ana.reyes@mediq.ph')).toBe(false);
    });

    it('opens the dialog with a clean form, defaulting to active', () => {
      const dir = fixture.componentInstance as any;
      dir['form'].patchValue({ name: 'Stale', status: 'inactive' });
      dir['openCreate']();
      expect(dir['createOpen']()).toBe(true);
      expect(dir['form'].getRawValue().name).toBe('');
      expect(dir['form'].getRawValue().status).toBe('active');
    });

    it('drops the password when the dialog is reopened', () => {
      const dir = fixture.componentInstance as any;
      dir['form'].patchValue({ temporaryPassword: 'longenough1', confirmPassword: 'longenough1' });
      dir['openCreate']();
      expect(dir['form'].getRawValue().temporaryPassword).toBe('');
      expect(dir['form'].getRawValue().confirmPassword).toBe('');
    });

    it('labels the form in two sections, with the role detail one only for doctors', () => {
      const dir = fixture.componentInstance as any;
      dir['openCreate']();
      fixture.detectChanges();
      const sections = Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.form-section'),
      ).map((h) => h.textContent?.trim());
      expect(sections).toEqual(['Account information', 'Doctor details']);
      expect(dir['roleLabel']()).toBe('Doctor');
    });

    it('omits the doctor detail section for a secretary, and adds their own', async () => {
      // A doctor's specialty and licence have no secretary equivalent, so an
      // empty section heading would be worse than none — but a secretary has one
      // role field of their own, and it belongs in a section of its own.
      await render('secretary');
      const dir = fixture.componentInstance as any;
      dir['openCreate']();
      fixture.detectChanges();
      const sections = Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.form-section'),
      ).map((h) => h.textContent?.trim());
      expect(sections).toEqual(['Account information', 'Secretary details']);
      expect(text()).toContain('Assigned doctor');
      expect(dir['roleLabel']()).toBe('Secretary');
    });

    it('names the create button after the role', () => {
      const dir = fixture.componentInstance as any;
      dir['openCreate']();
      fixture.detectChanges();
      const footer = fixture.nativeElement.querySelector('dialog footer, [role="dialog"] footer');
      expect(footer?.textContent).toContain('Create Doctor Account');
    });
  });

  describe('enable and disable', () => {
    beforeEach(async () => {
      await render('doctor');
    });

    it('asks for confirmation before disabling', () => {
      const dir = fixture.componentInstance as any;
      const active = session.doctors().find((d) => d.status === 'active')!;
      dir['requestDisable'](active);
      fixture.detectChanges();
      expect(dir['confirmDisableFor']()).toEqual(active);
      // Nothing has changed yet.
      expect(session.doctors().find((d) => d.id === active.id)!.status).toBe('active');
    });

    it('disables only once confirmed', () => {
      const dir = fixture.componentInstance as any;
      const active = session.doctors().find((d) => d.status === 'active')!;
      dir['requestDisable'](active);
      dir['confirmDisable']();
      fixture.detectChanges();
      expect(session.doctors().find((d) => d.id === active.id)!.status).toBe('inactive');
    });

    it('leaves the account alone when the confirmation is cancelled', () => {
      const dir = fixture.componentInstance as any;
      const active = session.doctors().find((d) => d.status === 'active')!;
      dir['requestDisable'](active);
      dir['cancelDisable']();
      dir['confirmDisable']();
      expect(session.doctors().find((d) => d.id === active.id)!.status).toBe('active');
    });

    it('re-enables a disabled account', () => {
      const dir = fixture.componentInstance as any;
      const inactive = session.doctors().find((d) => d.status === 'inactive')!;
      dir['enable'](inactive);
      fixture.detectChanges();
      expect(session.doctors().find((d) => d.id === inactive.id)!.status).toBe('active');
    });
  });

  it('states plainly that the data is a sample', async () => {
    await render('doctor');
    expect(text()).toContain('Sample data.');
  });

  it('offers an add button that opens the create dialog', async () => {
    await render('doctor');
    const dir = fixture.componentInstance as any;
    expect(dir['createOpen']()).toBe(false);
    button('Add doctor')?.click();
    fixture.detectChanges();
    expect(dir['createOpen']()).toBe(true);
  });
});
