import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { CLOCK } from '../../../core/services/clock';
import {
  OTP_EXPIRY_MS,
  OTP_RESEND_COOLDOWN_MS,
  PasswordManagementService,
  type PasswordAccount,
} from '../../../core/services/password-management.service';
import { resetStoredPasswords, storedPassword } from '../../../core/services/password-store';
import { CONFIRM_PASSWORD, NEW_PASSWORD } from '../../validation/password.policy';
import { ChangePassword } from './change-password';

const ACCOUNT: PasswordAccount = {
  accountId: 'doc-002',
  email: 'rafael.santos@mediq.ph',
  role: 'doctor',
};
const GOOD = 'clinic-portal-2026';

/** A clock the test advances by hand, so nothing waits on real time. */
class FakeClock {
  private value = Date.parse('2026-10-18T09:00:00Z');
  readonly read = () => this.value;
  advance(ms: number): void {
    this.value += ms;
  }
}

describe('ChangePassword', () => {
  let fixture: ComponentFixture<ChangePassword>;
  let service: PasswordManagementService;
  let clock: FakeClock;

  beforeEach(async () => {
    clock = new FakeClock();
    resetStoredPasswords();
    TestBed.configureTestingModule({
      providers: [{ provide: CLOCK, useValue: clock.read }],
    });
    service = TestBed.inject(PasswordManagementService);

    fixture = TestBed.createComponent(ChangePassword);
    fixture.componentRef.setInput('account', ACCOUNT);
    fixture.detectChanges();
    await fixture.whenStable();
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

  /**
 * Finds a button by its visible label.
 *
 * Searches the whole component, not just the dialog: the button that *opens* the
 * dialog lives on the card. Returns the element so a test can read `disabled`.
 */
  function button(label: string): HTMLButtonElement | undefined {
    return [...host().querySelectorAll('button')]
      .map((el) => el as HTMLButtonElement)
      .find((el) => (el.textContent ?? '').trim().includes(label));
  }

  /** Clicks a button by its visible label. */
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

  async function open(): Promise<void> {
    click('Change password');
    await settle();
  }

  /** Walks to the password step with a verified code. */
  async function reachPasswordStep(): Promise<void> {
    await open();
    click('Send verification code');
    await settle();
    page().verifyCode(service.peekIssuedCode(page().challenge().challengeId) as string);
    await settle();
  }

  describe('the card on the profile', () => {
    it('renders the heading, the lock and the button', () => {
      const card = host().querySelector('ui-card');
      expect(card).toBeTruthy();
      expect(card?.textContent).toContain('Change Password');
      expect(card?.querySelector('svg')).toBeTruthy();
      expect(card?.textContent).toContain('Change password');
    });

    it('says the flow is a demonstration that sends no email', () => {
      // The prototype must not claim to have emailed anyone.
      expect(host().textContent).toContain('demonstration flow');
      expect(host().textContent).toContain('no email is sent');
    });

    it('keeps the dialog closed until the button is used', () => {
      expect(dialog().hasAttribute('open')).toBe(false);
    });
  });

  describe('opening and closing', () => {
    it('opens on the button', async () => {
      await open();
      expect(dialog().hasAttribute('open')).toBe(true);
    });

    it('shows the masked address, not the full one', async () => {
      await open();
      expect(text()).toContain('ra***********@mediq.ph');
      // The full address is the thing masking exists to avoid putting on screen.
      expect(text()).not.toContain('rafael.santos@mediq.ph');
    });

    it('closes on Cancel and clears the flow', async () => {
      await open();
      page().step.set('verify');
      click('Cancel');
      await settle();

      expect(dialog().hasAttribute('open')).toBe(false);
      expect(page().step()).toBe('request');
      expect(page().challenge()).toBeNull();
      expect(page().verified()).toBe(false);
    });

    it('drops the challenge when the dialog is dismissed mid-flow', async () => {
      await open();
      click('Send verification code');
      await settle();
      const id = page().challenge().challengeId as string;
      expect(service.getChallenge(id)).toBeTruthy();

      click('Cancel');
      await settle();

      // The code must not stay live behind a closed dialog.
      expect(service.getChallenge(id)).toBeNull();
    });

    it('clears the typed password when reopened', async () => {
      await reachPasswordStep();
      page().passwordForm.setValue({ [NEW_PASSWORD]: GOOD, [CONFIRM_PASSWORD]: GOOD });
      await settle();

      await open();
      await reachPasswordStep();

      expect(page().passwordForm.getRawValue()).toEqual({
        [NEW_PASSWORD]: '',
        [CONFIRM_PASSWORD]: '',
      });
    });
  });

  describe('requesting a code', () => {
    it('issues one for the signed-in account', async () => {
      await open();
      click('Send verification code');
      await settle();

      const challenge = page().challenge();
      expect(challenge.accountId).toBe('doc-002');
      expect(challenge.purpose).toBe('change-password');
    });

    it('moves to the code step', async () => {
      await open();
      click('Send verification code');
      await settle();
      expect(page().step()).toBe('verify');
      expect(text()).toContain('Verification code');
    });

    it('shows a six-digit code field', async () => {
      await open();
      click('Send verification code');
      await settle();

      const input = dialog().querySelector('.ui-otp-input__field') as HTMLInputElement;
      expect(input.getAttribute('inputmode')).toBe('numeric');
      expect(input.getAttribute('maxlength')).toBe('6');
      expect(input.getAttribute('autocomplete')).toBe('one-time-code');
    });

    it('shows the code only through the development panel', async () => {
      await open();
      click('Send verification code');
      await settle();

      const code = service.peekIssuedCode(page().challenge().challengeId) as string;

      // The flow's own copy must never contain it: a prototype that displays its
      // own second factor teaches the wrong habit.
      const flowOnly = host().cloneNode(true) as HTMLElement;
      flowOnly.querySelectorAll('dev-otp-hint').forEach((node) => node.remove());
      expect(flowOnly.textContent).not.toContain(code);

      // It reaches the screen only through the panel, which is gated on
      // `isDevMode()` and renders nothing in a production build.
      expect(host().querySelector('dev-otp-hint')?.textContent).toContain(code);
    });

    it('starts the resend cooldown', async () => {
      await open();
      click('Send verification code');
      await settle();

      expect(page().coolingDown()).toBe(true);
      expect(button('Resend code')?.disabled).toBe(true);
    });
  });

  describe('verifying the code', () => {
    it('refuses an incomplete code', async () => {
      await open();
      click('Send verification code');
      await settle();

      page().verifyCode('12');
      await settle();

      expect(page().step()).toBe('verify');
      expect(text()).toContain('Enter all six digits');
    });

    it('reports a wrong code and stays on the step', async () => {
      await open();
      click('Send verification code');
      await settle();

      page().verifyCode('000000');
      await settle();

      expect(page().step()).toBe('verify');
      expect(text()).toContain('That code is not right');
    });

    it('reports how many attempts are left', async () => {
      await open();
      click('Send verification code');
      await settle();

      page().verifyCode('000000');
      await settle();

      expect(text()).toContain('4 attempts left');
    });

    it('reports an expired code', async () => {
      await open();
      click('Send verification code');
      await settle();
      const code = service.peekIssuedCode(page().challenge().challengeId) as string;

      clock.advance(OTP_EXPIRY_MS + 1);
      page().verifyCode(code);
      await settle();

      expect(text()).toContain('expired');
    });

    it('refuses a code that a resend replaced', async () => {
      await open();
      click('Send verification code');
      await settle();
      const stale = service.peekIssuedCode(page().challenge().challengeId) as string;

      clock.advance(OTP_RESEND_COOLDOWN_MS);
      await page().resend();
      await settle();

      // The old challenge is gone, so the old code cannot be carried over.
      page().verifyCode(stale);
      await settle();
      expect(page().step()).toBe('verify');
    });

    it('cancels the native submit on the code form', async () => {
      // The code form carries no formGroup, so no form directive cancels the
      // browser's own submission. Without this the page navigates on "Verify
      // code" and the flow is lost — which jsdom cannot reproduce, so it has to
      // be asserted rather than discovered.
      await open();
      click('Send verification code');
      await settle();

      const form = host().querySelector('#verify-code-form') as HTMLFormElement;
      const event = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);
      await settle();

      expect(event.defaultPrevented).toBe(true);
    });

    it('advances on the right code', async () => {
      await open();
      click('Send verification code');
      await settle();

      page().verifyCode(service.peekIssuedCode(page().challenge().challengeId) as string);
      await settle();

      expect(page().step()).toBe('password');
      expect(page().verified()).toBe(true);
    });

    it('will not advance without a verified code', async () => {
      await open();
      click('Send verification code');
      await settle();

      // Set the form up properly but leave the code unverified: the step must not
      // be reachable, and the service must refuse even if it were.
      page().passwordForm.setValue({ [NEW_PASSWORD]: GOOD, [CONFIRM_PASSWORD]: GOOD });
      await settle();
      expect(page().canSubmit()).toBe(false);

      const result = await service.completePasswordChange(page().challenge().challengeId, GOOD);
      expect(result).toEqual({ ok: false, reason: 'not-verified' });
      expect(storedPassword('doc-002', 'original')).toBe('original');
    });
  });

  describe('resending', () => {
    it('issues nothing while the cooldown is running', async () => {
      await open();
      click('Send verification code');
      await settle();
      const firstId = page().challenge().challengeId as string;

      // The button is disabled, and the handler refuses too — the guard matters
      // because a disabled attribute is not an authorisation check.
      await page().resend();
      await settle();

      expect(page().challenge().challengeId).toBe(firstId);
      expect(page().step()).toBe('verify');
    });

    it('issues a replacement once the cooldown passes', async () => {
      await open();
      click('Send verification code');
      await settle();
      const firstId = page().challenge().challengeId as string;

      clock.advance(OTP_RESEND_COOLDOWN_MS);
      await page().resend();
      await settle();

      expect(page().challenge().challengeId).not.toBe(firstId);
      expect(page().coolingDown()).toBe(true);
    });
  });

  describe('setting the new password', () => {
    it('disables submit until the form is valid', async () => {
      await reachPasswordStep();
      expect(button('Update password')?.disabled).toBe(true);

      page().passwordForm.setValue({ [NEW_PASSWORD]: GOOD, [CONFIRM_PASSWORD]: 'different-1' });
      await settle();
      expect(button('Update password')?.disabled).toBe(true);

      page().passwordForm.setValue({ [NEW_PASSWORD]: GOOD, [CONFIRM_PASSWORD]: GOOD });
      await settle();
      expect(button('Update password')?.disabled).toBe(false);
    });

    it('refuses a password that breaks the policy', async () => {
      await reachPasswordStep();
      page().passwordForm.setValue({ [NEW_PASSWORD]: 'short1', [CONFIRM_PASSWORD]: 'short1' });
      await settle();

      expect(page().canSubmit()).toBe(false);
    });

    it('reports a mismatch on the confirmation field', async () => {
      await reachPasswordStep();
      page().passwordForm.setValue({ [NEW_PASSWORD]: GOOD, [CONFIRM_PASSWORD]: 'other-pass-1' });
      page().passwordForm.controls[CONFIRM_PASSWORD].markAsTouched();
      await settle();

      expect(text()).toContain('The two passwords do not match.');
    });

    it('shows both fields with their own reveal control', async () => {
      await reachPasswordStep();

      const newField = dialog().querySelector('#change-password-new') as HTMLInputElement;
      const confirmField = dialog().querySelector('#change-password-confirm') as HTMLInputElement;
      expect(newField.type).toBe('password');
      expect(confirmField.type).toBe('password');

      const reveals = dialog().querySelectorAll('.password-fields__reveal');
      expect(reveals.length).toBe(2);
      reveals[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();

      expect((dialog().querySelector('#change-password-new') as HTMLInputElement).type).toBe('text');
      expect((dialog().querySelector('#change-password-confirm') as HTMLInputElement).type).toBe(
        'password',
      );
    });

    it('renders a visible icon inside each reveal control', async () => {
      // The regression this guards: the global `button` baseline carries
      // `padding: 0 var(--space-4)`, so on a 32px control the content box
      // collapsed to zero and the global `svg { max-width: 100% }` shrank the
      // icon to 0px wide. Toggling still worked, so the earlier test passed while
      // nothing was drawn — asserting the rendered icon is what actually catches it.
      await reachPasswordStep();

      const reveals = dialog().querySelectorAll<HTMLButtonElement>(
        '.password-fields__reveal',
      );
      expect(reveals.length).toBe(2);

      for (const reveal of reveals) {
        const style = getComputedStyle(reveal);
        // The two resets that stop the collapse.
        expect(style.paddingLeft).toBe('0px');
        expect(style.paddingRight).toBe('0px');
        expect(style.minHeight).toBe('0px');

        const icon = reveal.querySelector('svg');
        expect(icon, 'the control must contain an icon').toBeTruthy();
        // Pinned so the icon cannot be shrunk back to nothing by the global
        // `svg { max-width: 100% }` rule.
        expect(getComputedStyle(icon!).flex).toContain('0 0 auto');
      }
    });

    it('labels each control and reflects its state', async () => {
      await reachPasswordStep();
      const reveals = dialog().querySelectorAll('.password-fields__reveal');

      expect(reveals[0].getAttribute('aria-label')).toBe('Show new password');
      expect(reveals[1].getAttribute('aria-label')).toBe('Show password confirmation');
      // `type="button"` so pressing it cannot submit the form.
      expect(reveals[0].getAttribute('type')).toBe('button');
      expect(reveals[1].getAttribute('type')).toBe('button');
      expect(reveals[0].getAttribute('aria-pressed')).toBe('false');

      reveals[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle();

      // Only the one that was pressed changes.
      expect(reveals[1].getAttribute('aria-label')).toBe('Hide password confirmation');
      expect(reveals[1].getAttribute('aria-pressed')).toBe('true');
      expect(reveals[0].getAttribute('aria-label')).toBe('Show new password');
      expect(reveals[0].getAttribute('aria-pressed')).toBe('false');
    });

    it('changes the password and shows a receipt', async () => {
      await reachPasswordStep();
      page().passwordForm.setValue({ [NEW_PASSWORD]: GOOD, [CONFIRM_PASSWORD]: GOOD });
      await settle();

      await page().submit();
      await settle();

      expect(page().step()).toBe('done');
      expect(storedPassword('doc-002', 'original')).toBe(GOOD);
      expect(text()).toContain('Password updated');
    });

    it('says plainly that nothing was sent to a server', async () => {
      await reachPasswordStep();
      page().passwordForm.setValue({ [NEW_PASSWORD]: GOOD, [CONFIRM_PASSWORD]: GOOD });
      await settle();
      await page().submit();
      await settle();

      expect(text()).toContain('No server was contacted');
    });

    it('consumes the challenge, so the receipt cannot be resubmitted', async () => {
      await reachPasswordStep();
      page().passwordForm.setValue({ [NEW_PASSWORD]: GOOD, [CONFIRM_PASSWORD]: GOOD });
      await settle();
      await page().submit();
      await settle();

      const id = page().challenge();
      expect(id).toBeNull();
      expect(page().canSubmit()).toBe(false);
    });
  });

  describe('the mock boundary', () => {
    it('writes nothing to storage', async () => {
      await reachPasswordStep();
      page().passwordForm.setValue({ [NEW_PASSWORD]: GOOD, [CONFIRM_PASSWORD]: GOOD });
      await settle();
      await page().submit();
      await settle();

      // A password or a code reaching localStorage would outlive the session and
      // turn a prototype into a plaintext credential on disk.
      const serialised = JSON.stringify({
        local: { ...localStorage },
        session: { ...sessionStorage },
      });
      expect(serialised).not.toContain(GOOD);
    });
  });
});