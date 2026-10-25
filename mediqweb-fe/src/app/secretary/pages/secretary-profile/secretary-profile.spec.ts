import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { clearToasts, latestToast } from '../../../core/services/toast.service.spec-helpers';
import { MOCK_SECRETARY_PROFILE } from '../../secretary.mock-data';
import { SecretarySession } from '../../secretary-session';
import { SecretaryProfilePage } from './secretary-profile';

describe('SecretaryProfilePage', () => {
  let fixture: ComponentFixture<SecretaryProfilePage>;
  let session: SecretarySession;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [SecretaryProfilePage],
      providers: [SecretarySession],
    });
    session = TestBed.inject(SecretarySession);
    fixture = TestBed.createComponent(SecretaryProfilePage);
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

  it('fills the form from the signed-in secretary', () => {
    const { name, email, phone } = session.profile();
    expect(page().form.getRawValue()).toEqual({ name, email, phone });
  });

  it('fills the form from the fixture, not from a blank form', () => {
    expect(page().form.getRawValue().name).toBe(MOCK_SECRETARY_PROFILE.name);
  });

  it('shows the desk summary beside the form', () => {
    expect(page().patientCount()).toBe(session.patients().length);
    expect(page().doctorCount()).toBe(session.activeDoctorCount());
    expect(text()).toContain(`${session.activeDoctorCount()} taking appointments`);
    expect(text()).toContain('Secretary');
  });

  it('saves an edited name into the session', () => {
    page().form.controls.name.setValue('Celine M. Villanueva');
    page().save();
    fixture.detectChanges();
    expect(session.profile().name).toBe('Celine M. Villanueva');
  });

  it('says the change is not persisted, rather than implying it was', () => {
    page().form.controls.phone.setValue('+63 917 555 9999');
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

    expect(session.profile().email).toBe(MOCK_SECRETARY_PROFILE.email);
    expect(text()).toContain('Enter a valid email address');
  });

  it('refuses an empty name', () => {
    page().form.controls.name.setValue('');
    page().save();
    fixture.detectChanges();
    expect(text()).toContain('Enter the name colleagues should see');
  });

  it('refuses an empty phone', () => {
    page().form.controls.phone.setValue('');
    page().save();
    fixture.detectChanges();
    expect(text()).toContain('Enter a contact number');
  });

  it('marks every field touched when saving an invalid form, so the messages show', () => {
    page().form.controls.email.setValue('');
    page().save();
    fixture.detectChanges();
    expect(page().emailError()).toBe('Enter an email address.');
  });

  it('does not show an error before the field has been touched', () => {
    expect(page().emailError()).toBeNull();
    expect(page().nameError()).toBeNull();
    expect(page().phoneError()).toBeNull();
  });

  it('restores the stored details on discard', () => {
    const before = session.profile().phone;
    page().form.controls.phone.setValue('+63 900 000 0000');
    page().resetForm();
    fixture.detectChanges();
    expect(page().form.controls.phone.value).toBe(before);
  });

  it('leaves the store alone when the form is discarded', () => {
    page().form.controls.name.setValue('Someone Else');
    page().resetForm();
    expect(session.profile().name).toBe(MOCK_SECRETARY_PROFILE.name);
  });

  it('keeps the role and clinic off the form, so the secretary cannot set them', () => {
    const ids = [...(fixture.nativeElement as HTMLElement).querySelectorAll('input')].map((el) =>
      el.getAttribute('id'),
    );
    expect(ids).toEqual(['profile-name', 'profile-email', 'profile-phone']);
    expect(page().form.contains('role')).toBe(false);
  });

  it('says the data is a sample, so a screenshot is not mistaken for a product', () => {
    expect(text()).toContain('Sample data');
  });
});
