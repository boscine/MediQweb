import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { clearToasts, latestToast } from '../../../core/services/toast.service.spec-helpers';
import { MOCK_APPOINTMENTS } from '../../doctor.mock-data';
import { DoctorSession } from '../../doctor-session';
import { DoctorProfilePage } from './doctor-profile';

describe('DoctorProfilePage', () => {
  let fixture: ComponentFixture<DoctorProfilePage>;
  let session: DoctorSession;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [DoctorProfilePage], providers: [DoctorSession] });
    session = TestBed.inject(DoctorSession);
    session.now.set(new Date(MOCK_APPOINTMENTS[0].startsAt));
    fixture = TestBed.createComponent(DoctorProfilePage);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  // Disarms the dismissal timers the toasts arm.
  afterEach(() => clearToasts());

  function page(): any {
    return fixture.componentInstance;
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('fills the form from the signed-in doctor', () => {
    const { name, email, bio } = session.profile();
    expect(page().form.getRawValue()).toEqual({ name, email, bio });
  });

  it('offers no contact number anywhere on the page', () => {
    // The whole point of the change, asserted where it would come back: not on the
    // form, not in the store's profile, and not in the wording of the form.
    const ids = [...(fixture.nativeElement as HTMLElement).querySelectorAll('input, textarea')].map(
      (el) => el.getAttribute('id'),
    );
    expect(ids).not.toContain('profile-phone');
    expect(page().form.contains('phone')).toBe(false);
    expect(text()).not.toContain('Contact number');

    // Nor on the record itself: a form-only removal would leave the value in the
    // store with nothing able to read or change it.
    expect(Object.keys(session.profile())).not.toContain('phone');
  });

  it('says how many fields the doctor can change, and counts them right', () => {
    // The lede says "three", so it has to stay true. If a field is added back
    // without the sentence being updated, this is what notices.
    expect(text()).toContain('These three fields');
    const editable = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('[formControlName]'),
    ]
      .map((el) => el.getAttribute('formControlName'))
      .filter((name): name is string => !!name);
    expect(editable).toEqual(['name', 'email', 'bio']);
  });

  it('shows the practice details the Admin owns', () => {
    expect(text()).toContain(session.profile().specialization);
    expect(text()).toContain(session.profile().licenseNumber);
  });

  it('keeps the licence number off the form, so a doctor cannot edit their own credential', () => {
    const ids = [...(fixture.nativeElement as HTMLElement).querySelectorAll('input, textarea')].map(
      (el) => el.getAttribute('id'),
    );
    expect(ids).not.toContain('profile-license');
    expect(page().form.contains('licenseNumber')).toBe(false);
  });

  it('saves an edited name into the session', () => {
    page().form.controls.name.setValue('Rafael M. Santos');
    page().save();
    fixture.detectChanges();
    expect(session.profile().name).toBe('Rafael M. Santos');
  });

  it('says the change is not persisted, rather than implying it was', () => {
    page().form.controls.name.setValue('Rafael M. Santos');
    page().save();
    fixture.detectChanges();
    // The store is a fixture, so "updated" has to carry the caveat. A toast
    // reading only "Saved" would be claiming a persistence that does not exist.
    expect(latestToast()?.tone).toBe('success');
    expect(latestToast()?.message).toContain('this session only');
  });

  it('refuses an invalid email and says so', () => {
    page().form.controls.email.setValue('not-an-email');
    page().save();
    fixture.detectChanges();

    expect(session.profile().email).toBe('rafael.santos@mediq.ph');
    expect(text()).toContain('Enter a valid email address');
  });

  it('refuses an empty name', () => {
    page().form.controls.name.setValue('');
    page().save();
    fixture.detectChanges();
    expect(text()).toContain('Enter the name patients should see');
  });

  it('does not show an error before the field has been touched', () => {
    expect(page().emailError()).toBeNull();
  });

  it('rejects a bio longer than the stated limit', () => {
    page().form.controls.bio.setValue('x'.repeat(281));
    page().save();
    fixture.detectChanges();
    expect(text()).toContain('280 characters or fewer');
  });

  it('restores the stored details on discard', () => {
    const before = session.profile().name;
    page().form.controls.name.setValue('Someone Else');
    page().resetForm();
    fixture.detectChanges();
    expect(page().form.controls.name.value).toBe(before);
  });

  it('leaves the store alone when the form is discarded', () => {
    page().form.controls.name.setValue('Someone Else');
    page().resetForm();
    expect(session.profile().name).toBe('Rafael Santos');
  });
});
