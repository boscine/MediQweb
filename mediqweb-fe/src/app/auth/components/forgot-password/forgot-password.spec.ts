import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { CLOCK } from '../../../core/services/clock';
import {
  DEV_MODE,
  DEV_MOCK_OTP,
  OTP_EXPIRY_MS,
  OTP_RESEND_COOLDOWN_MS,
  PasswordManagementService,
} from '../../../core/services/password-management.service';
import { resetStoredPasswords, storedPassword } from '../../../core/services/password-store';
import { ForgotPassword } from './forgot-password';

const REGISTERED = 'rafael.santos@mediq.ph';
const UNKNOWN = 'nobody@mediq.ph';
const GOOD = 'clinic-portal-2026';

/** A clock the test advances by hand, so nothing waits on real time. */
class FakeClock {
  private value = Date.parse('2026-10-18T09:00:00Z');
  readonly read = () => this.value;
  advance(ms: number): void {
    this.value += ms;
  }
}

/** The sentence the flow owes every address, known or not. */
const GENERIC = 'If an account exists for this email, a verification code can be requested.';

/**
 * Mirrors how the login page wires this component.
 *
 * The bug this guards against lived in the seam between the two: the component
 * owns the flow, the page owns the `open` flag, and the dialog can only close if
 * the component emits. A spec that sets `open` directly cannot see a missing
 * emit, because it is playing the part of the parent itself.
 */
@Component({
  imports: [ForgotPassword],
  template: `
    <a href="/login">Sign in</a>
    <app-forgot-password [open]="open()" (closed)="open.set(false)" />
  `,
})
class PageHost {
  readonly open = signal(false);
}

describe('ForgotPassword', () => {
  let fixture: ComponentFixture<ForgotPassword>;
  let service: PasswordManagementService;
  let clock: FakeClock;

  beforeEach(async () => {
    clock = new FakeClock();
    resetStoredPasswords();
    TestBed.configureTestingModule({ providers: [{ provide: CLOCK, useValue: clock.read }] });
    service = TestBed.inject(PasswordManagementService);

    fixture = TestBed.createComponent(ForgotPassword);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  function page(): any {
    return fixture.componentInstance;
  }

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function dialog(): HTMLDialogElement {
    return host().querySelector('dialog') as HTMLDialogElement;
  }

  function text(): string {
    return dialog().textContent ?? '';
  }

  function button(label: string): HTMLButtonElement | undefined {
    return [...host().querySelectorAll('button')]
      .map((el) => el as HTMLButtonElement)
      .find((el) => (el.textContent ?? '').trim().includes(label));
  }

  function click(label: string): void {
    const target = button(label);
    expect(target, `no button labelled "${label}"`).toBeTruthy();
    target!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** Returns the dialog to step one, as closing and reopening it would. */
  async function restart(): Promise<void> {
    page().onDialogClosed();
    await settle();
  }

  /** Types an address and asks for a code. */
  async function request(email: string): Promise<void> {
    page().emailForm.controls.email.setValue(email);
    page().emailForm.controls.email.markAsTouched();
    await settle();
    click('Send verification code');
    await settle();
  }

  /** Walks to the password step for a registered address. */
  async function reachPasswordStep(): Promise<void> {
    await request(REGISTERED);
    page().verifyCode(service.peekIssuedCode(page().challenge().challengeId) as string);
    await settle();
  }

  describe('step 1 — the address', () => {
    it('asks for the address and offers a way back', () => {
      expect(text()).toContain('Forgot your password?');
      expect(text()).toContain('Enter the email address associated with your MediQ account');
      expect(text()).toContain('Send verification code');
      expect(text()).toContain('Back to sign in');
    });

    it('rejects a malformed address', async () => {
      await request('not-an-email');

      expect(page().step()).toBe('email');
      expect(text()).toContain('Enter a valid email address.');
    });

    it('asks for an address when the field is empty', async () => {
      await request('');

      expect(page().step()).toBe('email');
      expect(text()).toContain('Enter your email address.');
    });

    it('trims whitespace and ignores case when matching', async () => {
      await request('  RAFAEL.SANTOS@MEDIQ.PH  ');

      expect(page().step()).toBe('code');
      expect(page().challenge()?.accountId).toBe('doc-002');
    });

    it('shows the registered address rather than the one typed', async () => {
      // Recovery must send to the address on the account, so a stray second
      // address in the field cannot redirect the code.
      await request('  Rafael.Santos@Mediq.PH  ');

      expect(text()).toContain('ra***********@mediq.ph');
      expect(text()).not.toContain('Rafael.Santos@Mediq.PH');
    });
  });

  describe('not revealing whether an account exists', () => {
    it('gives an unknown address exactly the same sentence', async () => {
      await request(UNKNOWN);
      const unknownText = text();

      await restart();
      await request(REGISTERED);
      const knownText = text();

      expect(unknownText).toContain(GENERIC);
      expect(knownText).toContain(GENERIC);
    });

    it('reaches the same step for both', async () => {
      await request(UNKNOWN);
      expect(page().step()).toBe('code');
      // Same controls on screen: the code field and both actions are present
      // whether or not an account was found.
      expect(text()).toContain('Verification code');
      expect(button('Verify code')).toBeTruthy();
      expect(button('Resend code')).toBeTruthy();
      expect(button('Change email')).toBeTruthy();
    });

    it('never says an address is unknown', async () => {
      await request(UNKNOWN);
      expect(text()).not.toMatch(/not found|unknown|no account|does not exist|unregistered/i);
    });

    it('shows the resend countdown for an unknown address too', async () => {
      // Showing the button enabled for one address and counting down for the
      // other would be the same leak in the shape of a timer.
      await request(UNKNOWN);
      expect(page().coolingDown()).toBe(true);
      expect(button('Resend code')?.textContent).toContain('Resend code in');
    });

    it('can never be verified for an unknown address', async () => {
      await request(UNKNOWN);

      page().verifyCode('000000');
      await settle();

      expect(page().step()).toBe('code');
      expect(page().verified()).toBe(false);
      expect(storedPassword('doc-002', 'original')).toBe('original');
    });

    it('reports a wrong code for an unknown address in the same words', async () => {
      // `888888` and not the development mock: in a dev build the mock is
      // accepted for a known address and not for an unknown one, which makes it
      // an account oracle. See the limitation asserted below.
      await request(UNKNOWN);
      page().verifyCode('888888');
      await settle();
      const unknownMessage = text();

      await restart();
      await request(REGISTERED);
      page().verifyCode('888888');
      await settle();

      // Identical wording: the number of attempts left is the only thing shared,
      // and it counts down the same way for both.
      expect(unknownMessage).toContain('That code is not right.');
      expect(text()).toContain('That code is not right.');
      expect(unknownMessage).toContain('4 attempts left');
    });

    it('gives the development mock away as an account oracle', async () => {
      // A known limitation, pinned so it is not discovered by accident. With the
      // dev mock enabled, `000000` verifies for a registered address and not for
      // an unregistered one — so in a development build the two are finally
      // distinguishable, which is exactly what the wording above hides. This is
      // inert in production, where the mock does not exist, and it is the price
      // of a fixed code that can be typed without reading a mailbox.
      await request(UNKNOWN);
      page().verifyCode(DEV_MOCK_OTP);
      await settle();
      expect(page().step()).toBe('code');

      await restart();
      await request(REGISTERED);
      page().verifyCode(DEV_MOCK_OTP);
      await settle();
      expect(page().step()).toBe('password');
    });
  });

  describe('step 2 — the code', () => {
    it('shows a six-digit code field', async () => {
      await request(REGISTERED);

      const input = dialog().querySelector('.ui-otp-input__field') as HTMLInputElement;
      expect(input.getAttribute('inputmode')).toBe('numeric');
      expect(input.getAttribute('maxlength')).toBe('6');
    });

    it('shows the code only through the development panel', async () => {
      await request(REGISTERED);

      const code = service.peekIssuedCode(page().challenge().challengeId) as string;

      // The flow's own copy must never contain it. Not even the generic notice
      // can be allowed to leak the second factor.
      const flowOnly = host().cloneNode(true) as HTMLElement;
      flowOnly.querySelectorAll('dev-otp-hint').forEach((node) => node.remove());
      expect(flowOnly.textContent).not.toContain(code);

      // It reaches the screen only through the panel, which is gated on
      // `isDevMode()` and renders nothing in a production build.
      expect(host().querySelector('dev-otp-hint')?.textContent).toContain(code);
    });

    it('refuses an incomplete code', async () => {
      await request(REGISTERED);
      page().verifyCode('123');
      await settle();

      expect(page().step()).toBe('code');
      expect(text()).toContain('Enter all six digits');
    });

    it('reports an expired code', async () => {
      await request(REGISTERED);
      const code = service.peekIssuedCode(page().challenge().challengeId) as string;

      clock.advance(OTP_EXPIRY_MS + 1);
      page().verifyCode(code);
      await settle();

      expect(text()).toContain('expired');
      expect(page().step()).toBe('code');
    });

    it('refuses a code superseded by a resend', async () => {
      await request(REGISTERED);
      const stale = service.peekIssuedCode(page().challenge().challengeId) as string;

      clock.advance(OTP_RESEND_COOLDOWN_MS);
      await page().resend();
      await settle();
      page().verifyCode(stale);
      await settle();

      expect(page().step()).toBe('code');
    });

    it('will not let a change-password code authorise a reset', async () => {
      // A code obtained from the signed-in "change password" dialog must not
      // reset an account named in a recovery request.
      const doctor = service.findByEmail(REGISTERED)!;
      const changeChallenge = await service.requestChangePasswordOtp(doctor);
      const changeCode = service.peekIssuedCode(changeChallenge.challengeId) as string;

      await request(REGISTERED);
      // The reset request replaced the change challenge, and even so the
      // change-password code is not what the reset challenge answers to.
      expect(service.verifyOtp(page().challenge().challengeId, changeCode)).toEqual({
        ok: false,
        reason: 'invalid',
      });
      expect(page().step()).toBe('code');
    });

    it('will not let one address code reset another account', async () => {
      const secretary = service.findByEmail('celine.villanueva@mediq.ph')!;
      const secretaryChallenge = await service.requestChangePasswordOtp(secretary);
      const secretaryCode = service.peekIssuedCode(secretaryChallenge.challengeId) as string;

      await request(REGISTERED);
      expect(service.verifyOtp(page().challenge().challengeId, secretaryCode)).toEqual({
        ok: false,
        reason: 'invalid',
      });
      expect(storedPassword('sec-001', 'original')).toBe('original');
    });

    it('advances on the right code', async () => {
      await request(REGISTERED);
      page().verifyCode(service.peekIssuedCode(page().challenge().challengeId) as string);
      await settle();

      expect(page().step()).toBe('password');
      expect(page().verified()).toBe(true);
    });

    it('cancels the native submit on the code form', async () => {
      // Ungrouped form, so nothing else cancels the browser's submission: without
      // this the page navigates on "Verify code" and the flow is lost. jsdom does
      // not navigate, so this has to be asserted rather than discovered.
      await request(REGISTERED);

      const form = dialog().querySelector('#forgot-password-code-form') as HTMLFormElement;
      const event = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);
      await settle();

      expect(event.defaultPrevented).toBe(true);
    });
  });

  describe('changing the address', () => {
    it('goes back to step one with an empty field', async () => {
      await request(REGISTERED);
      click('Change email');
      await settle();

      expect(page().step()).toBe('email');
      expect(page().emailForm.getRawValue().email).toBe('');
      expect(page().challenge()).toBeNull();
    });

    it('drops the code issued for the address left behind', async () => {
      await request(REGISTERED);
      const id = page().challenge().challengeId as string;

      click('Change email');
      await settle();

      expect(service.getChallenge(id)).toBeNull();
    });
  });

  describe('step 3 — the new password', () => {
    it('will not submit without a verified code', async () => {
      await request(REGISTERED);
      page().passwordForm.setValue({ newPassword: GOOD, confirmPassword: GOOD });
      await settle();

      expect(page().canSubmit()).toBe(false);
    });

    it('disables submit until the fields match the policy', async () => {
      await reachPasswordStep();
      expect(button('Reset password')?.disabled).toBe(true);

      page().passwordForm.setValue({ newPassword: GOOD, confirmPassword: 'other-pass-1' });
      await settle();
      expect(button('Reset password')?.disabled).toBe(true);

      page().passwordForm.setValue({ newPassword: GOOD, confirmPassword: GOOD });
      await settle();
      expect(button('Reset password')?.disabled).toBe(false);
    });

    it('reports a mismatch', async () => {
      await reachPasswordStep();
      page().passwordForm.setValue({ newPassword: GOOD, confirmPassword: 'other-pass-1' });
      page().passwordForm.controls.confirmPassword.markAsTouched();
      await settle();

      expect(text()).toContain('The two passwords do not match.');
    });

    it('rejects a password that breaks the policy', async () => {
      await reachPasswordStep();
      page().passwordForm.setValue({ newPassword: 'short1', confirmPassword: 'short1' });
      await settle();

      expect(page().canSubmit()).toBe(false);
    });

    it('renders a visible icon in each reveal control', async () => {
      // The bug this guards was invisible to a toggling test: the global
      // `button { padding: 0 var(--space-4) }` baseline left a 32px control with
      // a zero-width content box, and the global `svg { max-width: 100% }` then
      // collapsed the eye icon to nothing. The button still worked, so nothing
      // about the behaviour changed — only that no icon was drawn.
      await reachPasswordStep();

      const reveals = host().querySelectorAll<HTMLButtonElement>('.password-fields__reveal');
      expect(reveals.length).toBe(2);

      for (const reveal of reveals) {
        const style = getComputedStyle(reveal);
        expect(style.paddingLeft).toBe('0px');
        expect(style.paddingRight).toBe('0px');
        expect(style.minHeight).toBe('0px');
        expect(reveal.querySelector('svg')).toBeTruthy();
        expect(getComputedStyle(reveal.querySelector('svg')!).flex).toContain('0 0 auto');
      }
    });

    it('reveals each field independently', async () => {
      await reachPasswordStep();
      const reveals = host().querySelectorAll('.password-fields__reveal');
      const newField = () => host().querySelector<HTMLInputElement>('#forgot-password-new')!;
      const confirmField = () =>
        host().querySelector<HTMLInputElement>('#forgot-password-confirm')!;

      expect([newField().type, confirmField().type]).toEqual(['password', 'password']);

      reveals[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle();
      expect([newField().type, confirmField().type]).toEqual(['text', 'password']);

      reveals[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle();
      expect([newField().type, confirmField().type]).toEqual(['text', 'text']);

      reveals[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle();
      expect([newField().type, confirmField().type]).toEqual(['password', 'text']);
    });

    it('resets the password and offers a way back to sign in', async () => {
      await reachPasswordStep();
      page().passwordForm.setValue({ newPassword: GOOD, confirmPassword: GOOD });
      await settle();
      await page().resetPassword();
      await settle();

      expect(page().step()).toBe('done');
      expect(storedPassword('doc-002', 'original')).toBe(GOOD);
      expect(text()).toContain('Return to sign in');
    });

    it('does not sign the user in', async () => {
      await reachPasswordStep();
      page().passwordForm.setValue({ newPassword: GOOD, confirmPassword: GOOD });
      await settle();
      await page().resetPassword();
      await settle();

      // Nothing here creates a session; the user goes back to the form to use
      // the password they just set.
      expect(text()).toContain('Sign in with your new password');
      expect(text()).toContain('no server was contacted');
    });

    it('consumes the challenge so it cannot be replayed', async () => {
      await reachPasswordStep();
      page().passwordForm.setValue({ newPassword: GOOD, confirmPassword: GOOD });
      await settle();
      await page().resetPassword();
      await settle();

      expect(page().challenge()).toBeNull();
      expect(page().canSubmit()).toBe(false);
    });
  });

  describe('closing', () => {
    it('emits so the login page can close its own state', async () => {
      let closed = 0;
      fixture.componentInstance.closed.subscribe(() => closed++);

      click('Back to sign in');
      await settle();

      expect(closed).toBe(1);
    });

    it('clears the address, the code and the passwords', async () => {
      await reachPasswordStep();
      page().passwordForm.setValue({ newPassword: GOOD, confirmPassword: GOOD });
      await settle();

      page().onDialogClosed();
      await settle();

      expect(page().step()).toBe('email');
      expect(page().emailForm.getRawValue().email).toBe('');
      expect(page().otpControl.value).toBe('');
      expect(page().passwordForm.getRawValue()).toEqual({ newPassword: '', confirmPassword: '' });
      expect(page().challenge()).toBeNull();
      expect(page().verified()).toBe(false);
    });

    it('invalidates the challenge on the way out', async () => {
      await request(REGISTERED);
      const id = page().challenge().challengeId as string;

      page().onDialogClosed();
      await settle();

      expect(service.getChallenge(id)).toBeNull();
    });

    it('clears the form on "Back to sign in", not just on the modal\'s own close', async () => {
      // The bug this guards: `open` belongs to the parent, so once the parent
      // sets it false the modal merely hides and never calls back. Emitting on
      // its own closed the dialog while leaving the typed values behind.
      // "Back to sign in" sits on the email step, which is where this happens.
      await request(REGISTERED);
      page().error.set('Enter a valid email address.');
      await settle();
      page().changeEmail();
      await settle();
      page().emailForm.controls.email.setValue('someone@mediq.ph');
      page().passwordForm.setValue({ newPassword: GOOD, confirmPassword: GOOD });
      await settle();

      click('Back to sign in');
      await settle();

      expect(page().emailForm.getRawValue().email).toBe('');
      expect(page().otpControl.value).toBe('');
      expect(page().passwordForm.getRawValue()).toEqual({ newPassword: '', confirmPassword: '' });
      expect(page().challenge()).toBeNull();
      expect(page().error()).toBeNull();
    });
  });

  /**
   * Closing through a host that owns `open`, the way the login page does.
   *
   * The X button could not close the dialog because the component cleaned up and
   * then stopped — it never emitted, so the page never set `open` back to false.
   * A spec that sets `open` itself is playing the parent's part and cannot see
   * that, so this block exists to reproduce the real seam.
   */
  describe('the development mock code, end to end', () => {
  let fixture: ComponentFixture<ForgotPassword>;
  let service: PasswordManagementService;

  function page(): any {
    return fixture.componentInstance;
  }

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function text(): string {
    return host().querySelector('dialog')?.textContent ?? '';
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function request(email: string): Promise<void> {
    page().emailForm.controls.email.setValue(email);
    page().emailForm.controls.email.markAsTouched();
    await settle();
    page().requestCode();
    await settle();
  }

  /** Builds the flow with the development gate forced on or off. */
  async function build(devMode: boolean): Promise<void> {
    resetStoredPasswords();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: CLOCK, useValue: () => 0 },
        { provide: DEV_MODE, useValue: devMode },
      ],
    });
    service = TestBed.inject(PasswordManagementService);
    fixture = TestBed.createComponent(ForgotPassword);
    fixture.componentRef.setInput('open', true);
    await settle();
  }

  beforeEach(async () => {
    await build(true);
  });

  it('reaches the password form with 000000', async () => {
    await request(REGISTERED);

    page().verifyCode(DEV_MOCK_OTP);
    await settle();

    expect(page().step()).toBe('password');
    expect(page().verified()).toBe(true);
    expect(text()).toContain('Your code is verified');
  });

  it('completes the reset and the service really stores the password', async () => {
    await request(REGISTERED);
    page().verifyCode(DEV_MOCK_OTP);
    await settle();

    page().passwordForm.setValue({ newPassword: GOOD, confirmPassword: GOOD });
    await settle();
    expect(page().canSubmit()).toBe(true);

    await page().resetPassword();
    await settle();

    expect(page().step()).toBe('done');
    // Not "the dialog said so" — the password actually changed.
    expect(storedPassword('doc-002', 'original')).toBe(GOOD);
    expect(text()).toContain('Return to sign in');
  });

  it('still enforces the password policy and the confirmation', async () => {
    await request(REGISTERED);
    page().verifyCode(DEV_MOCK_OTP);
    await settle();

    page().passwordForm.setValue({ newPassword: 'short1', confirmPassword: 'short1' });
    await settle();
    expect(page().canSubmit()).toBe(false);

    page().passwordForm.setValue({ newPassword: GOOD, confirmPassword: 'mismatch-9' });
    await settle();
    expect(page().canSubmit()).toBe(false);

    await page().resetPassword();
    await settle();
    // Neither attempt wrote anything.
    expect(storedPassword('doc-002', 'original')).toBe('original');
    expect(page().step()).toBe('password');
  });

  it('leaves every other code rejected', async () => {
    await request(REGISTERED);
    const real = service.peekIssuedCode(page().challenge().challengeId) as string;

    page().verifyCode(real === '999999' ? '111111' : '999999');
    await settle();

    expect(page().step()).toBe('code');
    expect(text()).toContain('That code is not right');
  });

  it('is refused for an address no account uses', async () => {
    await request(UNKNOWN);

    page().verifyCode(DEV_MOCK_OTP);
    await settle();

    // No challenge was ever issued, so nothing can verify — the mock does not
    // conjure one, and the user cannot reach the password form.
    expect(page().step()).toBe('code');
    expect(page().verified()).toBe(false);
  });

  it('is refused in a production build', async () => {
    await build(false);
    await request(REGISTERED);

    page().verifyCode(DEV_MOCK_OTP);
    await settle();

    expect(page().step()).toBe('code');
    expect(page().verified()).toBe(false);
    expect(text()).toContain('That code is not right');
  });

  it('clears the flow when the dialog is closed afterwards', async () => {
    await request(REGISTERED);
    page().verifyCode(DEV_MOCK_OTP);
    await settle();
    const id = page().challenge().challengeId as string;

    page().onDialogClosed();
    await settle();

    expect(service.getChallenge(id)).toBeNull();
    expect(page().step()).toBe('email');
    expect(page().otpControl.value).toBe('');
    expect(page().emailForm.getRawValue().email).toBe('');
  });
});

  /**
   * Closing through a host that owns `open`, the way the login page does.
   *
   * The X button could not close the dialog because the component cleaned up and
   * then stopped — it never emitted, so the page never set `open` back to false.
   * A spec that sets `open` itself is playing the parent's part and cannot see
   * that, so this block exists to reproduce the real seam.
   */
  describe('closing through the page that owns the dialog', () => {
    let page_: ComponentFixture<PageHost>;
    let flow: any;

    beforeEach(async () => {
      TestBed.resetTestingModule();
      resetStoredPasswords();
      TestBed.configureTestingModule({
        imports: [PageHost],
        providers: [{ provide: CLOCK, useValue: () => 0 }],
      });
      service = TestBed.inject(PasswordManagementService);
      page_ = TestBed.createComponent(PageHost);
      flow = page_.debugElement.children
        .map((child) => child.componentInstance)
        .find((instance) => instance && typeof instance.requestCode === 'function');
      page_.detectChanges();
      await page_.whenStable();
      page_.detectChanges();
    });

    const hostEl = () => page_.nativeElement as HTMLElement;
    const dlg = () => hostEl().querySelector('dialog') as HTMLDialogElement;
    const press = (label: string) => {
      const b = [...hostEl().querySelectorAll('button')]
        .map((el) => el as HTMLButtonElement)
        .find((el) => (el.textContent ?? '').trim().includes(label));
      expect(b, `no button labelled "${label}"`).toBeTruthy();
      b!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      page_.detectChanges();
    };
    const settle = async () => {
      page_.detectChanges();
      await page_.whenStable();
      page_.detectChanges();
    };

    async function openAndRequestCode(): Promise<void> {
      page_.componentInstance.open.set(true);
      await settle();
      flow.emailForm.controls.email.setValue(REGISTERED);
      flow.emailForm.controls.email.markAsTouched();
      await settle();
      press('Send verification code');
      await settle();
    }

    it('closes on the X button', async () => {
      page_.componentInstance.open.set(true);
      await settle();
      expect(dlg().hasAttribute('open')).toBe(true);

      // The X the shared Modal renders in its header.
      dlg().querySelector<HTMLButtonElement>('.ui-modal__close')!.click();
      await settle();

      expect(page_.componentInstance.open()).toBe(false);
      expect(dlg().hasAttribute('open')).toBe(false);
    });

    it('keeps the user on the page', async () => {
      page_.componentInstance.open.set(true);
      await settle();
      dlg().querySelector<HTMLButtonElement>('.ui-modal__close')!.click();
      await settle();

      // The host renders a link to /login; closing must not navigate anywhere.
      expect(hostEl().querySelector('a')?.getAttribute('href')).toBe('/login');
    });

    it('closes on Escape', async () => {
      page_.componentInstance.open.set(true);
      await settle();

      dlg().dispatchEvent(new Event('cancel', { cancelable: true, bubbles: true }));
      await settle();

      expect(page_.componentInstance.open()).toBe(false);
    });

    it('closes on a backdrop click but not on a click inside', async () => {
      page_.componentInstance.open.set(true);
      await settle();

      // Inside the panel: must not dismiss.
      (dlg().querySelector('.ui-modal__title') as HTMLElement).dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      );
      await settle();
      expect(page_.componentInstance.open()).toBe(true);

      // The dialog element itself is the backdrop.
      dlg().dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle();
      expect(page_.componentInstance.open()).toBe(false);
    });

    it('survives selecting the whole password with a drag', async () => {
      // The gesture that broke: press inside the field, drag out, release over
      // the backdrop. The browser retargets the resulting click to the <dialog>,
      // so the modal used to read a text selection as a backdrop click.
      await openAndRequestCode();
      flow.verifyCode(service.peekIssuedCode(flow.challenge().challengeId) as string);
      await settle();
      flow.passwordForm.setValue({ newPassword: GOOD, confirmPassword: GOOD });
      await settle();

      const field = dlg().querySelector<HTMLInputElement>('#forgot-password-new')!;
      field.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      dlg().dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      dlg().dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle();

      expect(page_.componentInstance.open()).toBe(true);
      expect(flow.step()).toBe('password');
      // Nothing was cleared by the stray selection.
      expect(flow.passwordForm.getRawValue().newPassword).toBe(GOOD);
    });

    it('survives using a password reveal control', async () => {
      await openAndRequestCode();
      flow.verifyCode(service.peekIssuedCode(flow.challenge().challengeId) as string);
      await settle();

      const reveal = dlg().querySelector<HTMLButtonElement>('.password-fields__reveal')!;
      reveal.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      reveal.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle();

      expect(page_.componentInstance.open()).toBe(true);
      // And it still did its job.
      expect(dlg().querySelector<HTMLInputElement>('#forgot-password-new')!.type).toBe('text');
    });

    it('closes from the email step and clears what was typed', async () => {
      page_.componentInstance.open.set(true);
      await settle();
      flow.emailForm.controls.email.setValue('  RAFAEL.SANTOS@MEDIQ.PH ');
      flow.emailForm.controls.email.markAsTouched();
      await settle();

      dlg().querySelector<HTMLButtonElement>('.ui-modal__close')!.click();
      await settle();

      expect(flow.emailForm.getRawValue().email).toBe('');
      expect(flow.error()).toBeNull();
      expect(flow.notice()).toBeNull();
    });

    it('closes from the code step and kills the challenge', async () => {
      await openAndRequestCode();
      const id = flow.challenge().challengeId as string;
      flow.otpControl.setValue('123456');
      flow.error.set('That code is not right.');
      await settle();

      dlg().querySelector<HTMLButtonElement>('.ui-modal__close')!.click();
      await settle();

      expect(page_.componentInstance.open()).toBe(false);
      expect(flow.otpControl.value).toBe('');
      expect(flow.challenge()).toBeNull();
      expect(flow.error()).toBeNull();
      expect(flow.step()).toBe('email');
      expect(service.getChallenge(id)).toBeNull();
    });

    it('closes from the password step and clears the typed password', async () => {
      await openAndRequestCode();
      flow.verifyCode(service.peekIssuedCode(flow.challenge().challengeId) as string);
      await settle();
      flow.passwordForm.setValue({ newPassword: GOOD, confirmPassword: GOOD });
      await settle();
      expect(flow.step()).toBe('password');

      dlg().querySelector<HTMLButtonElement>('.ui-modal__close')!.click();
      await settle();

      expect(page_.componentInstance.open()).toBe(false);
      expect(flow.passwordForm.getRawValue()).toEqual({ newPassword: '', confirmPassword: '' });
      expect(flow.verified()).toBe(false);
      expect(flow.challenge()).toBeNull();
    });

    it('closes from the success receipt', async () => {
      await openAndRequestCode();
      flow.verifyCode(service.peekIssuedCode(flow.challenge().challengeId) as string);
      await settle();
      flow.passwordForm.setValue({ newPassword: GOOD, confirmPassword: GOOD });
      await settle();
      await flow.resetPassword();
      await settle();
      expect(flow.step()).toBe('done');

      press('Return to sign in');
      await settle();

      expect(page_.componentInstance.open()).toBe(false);
      expect(flow.emailForm.getRawValue().email).toBe('');
    });

    it('can be reopened clean after a close', async () => {
      await openAndRequestCode();
      dlg().querySelector<HTMLButtonElement>('.ui-modal__close')!.click();
      await settle();

      page_.componentInstance.open.set(true);
      await settle();

      expect(dlg().hasAttribute('open')).toBe(true);
      expect(flow.step()).toBe('email');
      expect(flow.emailForm.getRawValue().email).toBe('');
      expect(hostEl().querySelector('#forgot-password-email')).toBeTruthy();
    });
  });

  describe('the mock boundary', () => {
    it('writes neither the code nor the password to storage', async () => {
      await reachPasswordStep();
      const code = service.peekIssuedCode(page().challenge().challengeId) as string;
      page().passwordForm.setValue({ newPassword: GOOD, confirmPassword: GOOD });
      await settle();
      await page().resetPassword();
      await settle();

      const serialised = JSON.stringify({
        local: { ...localStorage },
        session: { ...sessionStorage },
      });
      expect(serialised).not.toContain(GOOD);
      expect(serialised).not.toContain(code);
    });
  });
});