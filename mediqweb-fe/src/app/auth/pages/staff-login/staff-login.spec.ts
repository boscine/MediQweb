import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { StaffLogin } from './staff-login';
import { HttpAuthGateway } from '../../../core/api/http-auth-gateway';
import { AuthSession } from '../../../core/api/models';
import { emailOrUsername } from './staff-login.validators';

const GOOD = 'clinic-portal-2026';

const mockSession: AuthSession = {
  accessToken: 'access-token',
  expiresAt: '2026-01-01T00:00:00Z',
  refreshToken: 'refresh-token',
  refreshExpiresAt: '2027-01-01T00:00:00Z',
  profile: {
    id: 'doc-002',
    username: 'doctor',
    fullName: 'Dr. Smith',
    email: 'doctor@mediq.ph',
    mobileNumber: '+639123456789',
    dateOfBirth: '1980-01-01',
    role: 'doctor',
    status: 'active',
  },
};

class MockHttpAuthGateway {
  signIn = vi.fn().mockResolvedValue(mockSession);
}

describe('emailOrUsername', () => {
  const run = (value: string) => emailOrUsername({ value } as never);

  it('defers the empty case to required', () => {
    expect(run('')).toBeNull();
    expect(run('   ')).toBeNull();
  });

  it('accepts an email address', () => {
    expect(run('nurse@mediq.ph')).toBeNull();
  });

  it('accepts a username', () => {
    expect(run('j.delacruz')).toBeNull();
    expect(run('juan_dc-01')).toBeNull();
  });

  it('rejects malformed values', () => {
    expect(run('nurse@mediq')).not.toBeNull();
    expect(run('nurse @mediq.ph')).not.toBeNull();
    expect(run('ab')).not.toBeNull();
  });
});

describe('StaffLogin', () => {
  let fixture: ComponentFixture<StaffLogin>;
  let router: Router;
  let gateway: MockHttpAuthGateway;

  const host = () => fixture.nativeElement as HTMLElement;
  const form = () => fixture.componentInstance['form'];
  const query = <T extends HTMLElement>(selector: string) => host().querySelector<T>(selector)!;
  const queryAll = (selector: string) => Array.from(host().querySelectorAll<HTMLElement>(selector));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StaffLogin],
      providers: [
        provideRouter([]),
        { provide: HttpAuthGateway, useClass: MockHttpAuthGateway },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    gateway = TestBed.inject(HttpAuthGateway) as unknown as MockHttpAuthGateway;
    gateway.signIn.mockResolvedValue(mockSession);

    fixture = TestBed.createComponent(StaffLogin);
    fixture.detectChanges();
  });

  const type = (control: 'identifier' | 'password', value: string) => {
    const input = query<HTMLInputElement>(`[formcontrolname="${control}"]`);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  const submit = async () => {
    query<HTMLFormElement>('form').dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
  };

  const settle = async () => {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  };

  it('renders the MediQ brand and a single sign-in heading', () => {
    expect(query('ui-brand')).toBeTruthy();
    expect(query('h1').textContent?.trim()).toBe('Sign in');
  });

  it('offers no registration path', () => {
    const text = host().textContent?.toLowerCase() ?? '';
    expect(text).not.toContain('register');
    expect(text).not.toContain('sign up');
    expect(text).not.toContain('create an account');
  });

  it('starts with the password hidden and toggles it', () => {
    const input = query<HTMLInputElement>('#staff-password');
    expect(input.type).toBe('password');

    query<HTMLButtonElement>('.login__reveal').click();
    fixture.detectChanges();
    expect(query<HTMLInputElement>('#staff-password').type).toBe('text');

    query<HTMLButtonElement>('.login__reveal').click();
    fixture.detectChanges();
    expect(query<HTMLInputElement>('#staff-password').type).toBe('password');
  });

  it('does not submit an empty form and marks the fields touched', async () => {
    await submit();

    expect(gateway.signIn).not.toHaveBeenCalled();
    expect(form().touched).toBe(true);
    expect(query('.ui-form-field__help--error')?.textContent).toContain(
      'Enter your email or username.',
    );
    expect(query('.login__input').getAttribute('aria-invalid')).toBe('true');
  });

  it('rejects a malformed identifier without calling the gateway', async () => {
    type('identifier', 'nurse@mediq');
    type('password', 'correct-horse');
    await submit();

    expect(gateway.signIn).not.toHaveBeenCalled();
    expect(host().textContent).toContain('Enter a valid email address or username.');
  });

  it('submits the credentials and shows the loading state', async () => {
    type('identifier', 'nurse@mediq.ph');
    type('password', 'correct-horse');

    const formEl = query<HTMLFormElement>('form');
    formEl.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(gateway.signIn).toHaveBeenCalledWith('nurse@mediq.ph', 'correct-horse');

    const button = query<HTMLButtonElement>('ui-button button');
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(query('ui-button ui-spinner')).toBeTruthy();
  });

  it('surfaces a rejected sign-in and clears the loading state', async () => {
    type('identifier', 'nurse@mediq.ph');
    type('password', 'wrong');
    gateway.signIn.mockRejectedValueOnce(new Error('Email or password is incorrect.'));
    await submit();
    await fixture.whenStable();
    fixture.detectChanges();

    const alert = query('.login__alert');
    expect(alert.getAttribute('role')).toBe('alert');
    expect(alert.textContent).toContain('Email or password is incorrect.');
    expect(query<HTMLButtonElement>('ui-button button').disabled).toBe(false);
  });

  it('leaves the form usable after a failed attempt', async () => {
    type('identifier', 'nurse@mediq.ph');
    type('password', 'wrong');
    gateway.signIn.mockRejectedValueOnce(new Error('Email or password is incorrect.'));
    await submit();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(queryAll('.login__alert')).toHaveLength(1);

    await submit();
    expect(queryAll('.login__alert')).toHaveLength(0);
    expect(gateway.signIn).toHaveBeenCalledTimes(2);
  });

  it('sends a signed-in user to /doctor', async () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    type('identifier', 'doctor');
    type('password', GOOD);
    await submit();
    await fixture.whenStable();

    expect(gateway.signIn).toHaveBeenCalledWith('doctor', GOOD);
    expect(navigate).toHaveBeenCalledWith(['/doctor']);
  });

  it('does not navigate when the credentials are rejected', async () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    gateway.signIn.mockRejectedValueOnce(new Error('Email or password is incorrect.'));
    type('identifier', 'admin');
    type('password', 'wrong');
    await submit();
    await fixture.whenStable();

    expect(navigate).not.toHaveBeenCalled();
  });

  it('opens the forgot-password dialog as a reset flow', async () => {
    const link = queryAll('.login__link')[0];
    link.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const dialog = query<HTMLDialogElement>('dialog');
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(dialog.textContent).toContain('Forgot your password?');
    expect(dialog.textContent).toContain('receive a verification code');
    expect(dialog.textContent).toContain('Send verification code');
    expect(dialog.textContent).toContain('Back to sign in');
    expect(query<HTMLInputElement>('#forgot-password-email')).toBeTruthy();
  });

  it('assists the identifier and password fields', () => {
    expect(query<HTMLInputElement>('#staff-identifier').getAttribute('autocomplete')).toBe(
      'username',
    );
    expect(query<HTMLInputElement>('#staff-password').getAttribute('autocomplete')).toBe(
      'current-password',
    );
  });
});
