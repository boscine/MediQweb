import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  isDevMode,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { CLOCK } from '../../../core/services/clock';
import {
  PasswordManagementService,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  describeOtpFailure,
  maskEmail,
  type OtpChallenge,
} from '../../../core/services/password-management.service';
import {
  Button,
  FormField,
  Modal,
  OtpInput,
  PasswordFields,
} from '../../../shared/components';
// DEV-ONLY: delete this import, the `devPanel` field, and the DevOtpHint entry
// in `imports` to remove the development code helper. See dev-otp-hint.ts.
import { DevOtpHint } from '../../../shared/components/dev-otp-hint/dev-otp-hint';
import {
  CONFIRM_PASSWORD,
  NEW_PASSWORD,
  passwordsMatch,
  passwordPolicy,
} from '../../../shared/validation/password.policy';
import { emailAddress } from '../../pages/staff-login/staff-login.validators';

/** `email` → `code` → `password` → `done`. */
type Step = 'email' | 'code' | 'password' | 'done';

/**
 * The answer given for every address, known or not.
 *
 * Recovery cannot say "no such account" — that turns the form into a way to test
 * whether someone is a MediQ user, which is the more useful thing for an attacker
 * than the password itself. The same sentence is shown either way and the flow
 * continues to the code step in both cases; see `requestCode` for how an unknown
 * address is carried through without becoming distinguishable.
 */
const GENERIC_RESPONSE =
  'If an account exists for this email, a verification code can be requested.';

/**
 * Password reset from the sign-in screen, behind an emailed code.
 *
 * Coordinated rather than pushed into the login page: the login page owns sign-in
 * and nothing else, and this flow is long enough that living in its own file is
 * what keeps `staff-login.ts` readable. Everything the two password flows share —
 * the code entry, the password fields, the policy, the service — is shared; only
 * the first step differs, because here the address is the thing being supplied.
 *
 * Presentation only. No email is sent and no request leaves the browser; the
 * limits of that are documented on the service.
 */
@Component({
  selector: 'app-forgot-password',
  imports: [
    ReactiveFormsModule,
    Button,
    FormField,
    Modal,
    OtpInput,
    PasswordFields,
    DevOtpHint, // DEV-ONLY
  ],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPassword {
  /** The login page owns the open state, so it can keep one modal per screen. */
  readonly open = input(false);
  readonly closed = output<void>();

  private readonly service = inject(PasswordManagementService);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly clock = inject(CLOCK);

  protected readonly step = signal<Step>('email');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Shown after a request, whether or not an account was found. */
  protected readonly notice = signal<string | null>(null);
  protected readonly challenge = signal<OtpChallenge | null>(null);
  protected readonly verified = signal(false);
  protected readonly cooldownSeconds = signal(0);

  // DEV-ONLY: see the import above. Delete this field and the template block to
  // remove the development code helper.
  protected readonly devPanel = isDevMode();

  /**
   * What the code step remembers about the request.
   *
   * `challenge` is null for an address no account uses. That is not shown and not
   * branched on in the template — the code step renders identically — it only
   * decides which verification result comes back. Keeping the difference here
   * rather than in the view is what makes the two indistinguishable on screen.
   */
  protected readonly requestedEmail = signal('');

  protected readonly emailForm = this.fb.group({
    email: this.fb.control('', [Validators.required, emailAddress]),
  });

  protected readonly otpControl = new FormControl('', { nonNullable: true });

  protected readonly passwordForm = this.fb.group(
    {
      [NEW_PASSWORD]: this.fb.control('', [Validators.required, passwordPolicy]),
      [CONFIRM_PASSWORD]: this.fb.control('', [Validators.required, passwordPolicy]),
    },
    { validators: [passwordsMatch] },
  );

  /** Control names, exposed because the template cannot index a form by a const. */
  protected readonly forgotPasswordNewName = NEW_PASSWORD;
  protected readonly forgotPasswordConfirmName = CONFIRM_PASSWORD;

  /**
   * The address shown on the code step.
   *
   * For a known account this is the *registered* address from the service, never
   * the one that was typed — so leading or trailing whitespace and a different
   * case cannot move the code somewhere else.
   */
  protected readonly maskedEmail = computed(
    () => this.challenge()?.maskedEmail ?? maskEmail(this.requestedEmail()),
  );

  protected readonly coolingDown = computed(() => this.cooldownSeconds() > 0);

  protected readonly description = computed(() =>
    this.step() === 'email'
      ? 'Enter the email address associated with your MediQ account to receive a verification code.'
      : null,
  );

  constructor() {
    // A countdown left running after the dialog closed would keep the zone busy.
    inject(DestroyRef).onDestroy(() => this.stopCooldown());
  }

  // --- step 1: the address ------------------------------------------------

  protected emailError(): string | null {
    const control = this.emailForm.controls.email;
    if (!control.touched) return null;
    if (control.hasError('required')) return 'Enter your email address.';
    if (control.hasError('emailAddress')) return 'Enter a valid email address.';
    return null;
  }

  protected async requestCode(): Promise<void> {
    if (this.loading()) return; // no double submission
    if (this.emailForm.invalid) {
      this.emailForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    try {
      const submitted = this.emailForm.getRawValue().email.trim();
      const challenge = await this.service.requestPasswordResetOtp(submitted);

      this.requestedEmail.set(submitted);
      this.challenge.set(challenge);
      this.notice.set(GENERIC_RESPONSE);
      this.step.set('code');

      // Both paths get a cooldown. Starting one only when a code was issued would
      // show an enabled resend button for an unknown address and a counting-down
      // one for a known address, which is the same leak in the shape of a timer.
      this.startCooldown(challenge?.cooldownUntil ?? this.clock() + OTP_RESEND_COOLDOWN_MS);
    } finally {
      this.loading.set(false);
    }
  }

  // --- step 2: the code ---------------------------------------------------

  protected verifyCode(code: string): void {
    const challenge = this.challenge();
    if (!challenge) {
      // No code was ever issued for this address, so nothing can match. Reported
      // with the same words and the same attempt counter as a wrong guess on a
      // real challenge, which is what makes the two paths indistinguishable.
      this.unknownAttempts = Math.min(
        OTP_MAX_ATTEMPTS - 1,
        this.unknownAttempts + (code.length === 6 ? 1 : 0),
      );
      this.error.set(describeOtpFailure('invalid', OTP_MAX_ATTEMPTS - this.unknownAttempts));
      return;
    }

    const result = this.service.verifyOtp(challenge.challengeId, code);
    if (result.ok) {
      this.verified.set(true);
      this.error.set(null);
      this.step.set('password');
      return;
    }
    this.error.set(
      describeOtpFailure(
        result.reason,
        this.service.getChallenge(challenge.challengeId)?.attemptsRemaining ?? 0,
      ),
    );
  }

  /** Guesses spent against an address no account uses, for the shared wording. */
  private unknownAttempts = 0;

  protected async resend(): Promise<void> {
    // No client-side cooldown guard: see the note in `ChangePassword.resend`. The
    // countdown is for the label; the service decides whether a resend is allowed.
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(null);

    const challenge = this.challenge();
    if (!challenge) {
      // Nothing was ever issued, so there is nothing to reissue. The button is
      // shown and does the same visible thing as a successful resend — clears the
      // error, restarts the cooldown, leaves the notice standing — because a
      // button that silently fails would be just as telling as a missing one.
      this.otpControl.reset('');
      this.notice.set(GENERIC_RESPONSE);
      this.startCooldown(this.clock() + OTP_RESEND_COOLDOWN_MS);
      this.loading.set(false);
      return;
    }

    try {
      const result = await this.service.resend(challenge.challengeId);
      if (result.ok) {
        this.challenge.set(result.challenge);
        this.startCooldown(result.challenge.cooldownUntil);
        return;
      }
      this.error.set(describeOtpFailure(result.reason, challenge.attemptsRemaining));
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Back to the address field, for a typo or a different account.
   *
   * The field is emptied rather than left holding what was typed: after asking
   * for a different address, a stale value sitting in the box invites a second
   * request for the same wrong one without the user noticing.
   */
  protected changeEmail(): void {
    const id = this.challenge()?.challengeId;
    if (id) this.service.invalidate(id);
    this.challenge.set(null);
    this.verified.set(false);
    this.error.set(null);
    this.notice.set(null);
    this.requestedEmail.set('');
    this.unknownAttempts = 0;
    this.step.set('email');
    this.otpControl.reset('');
    this.emailForm.reset({ email: '' });
    this.emailForm.markAsUntouched();
    this.stopCooldown();
  }

  // --- step 3: the new password ------------------------------------------

  protected newPasswordError(): string | null {
    const control = this.passwordForm.controls[NEW_PASSWORD];
    if (!control.touched) return null;
    if (control.hasError('required')) return 'Enter a new password.';
    if (control.hasError('passwordPolicy')) return 'This password does not meet the requirements.';
    return null;
  }

  protected confirmPasswordError(): string | null {
    const control = this.passwordForm.controls[CONFIRM_PASSWORD];
    if (!control.touched) return null;
    if (control.hasError('required')) return 'Repeat the new password.';
    if (control.hasError('passwordPolicy')) return 'This password does not meet the requirements.';
    // Group-level error: it lives on the form, not on either control.
    if (this.passwordForm.hasError('passwordsMismatch')) return 'The two passwords do not match.';
    return null;
  }

  /** As in the change-password flow: a live challenge is part of being able to submit. */
  protected canSubmit(): boolean {
    return this.challenge() !== null && this.verified() && this.passwordForm.valid && !this.loading();
  }

  protected async resetPassword(): Promise<void> {
    const challenge = this.challenge();
    if (!challenge || this.loading()) return;
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    try {
      const result = await this.service.completePasswordReset(
        challenge.challengeId,
        this.passwordForm.getRawValue()[NEW_PASSWORD],
      );
      if (!result.ok) {
        this.error.set(describeOtpFailure(result.reason, challenge.attemptsRemaining));
        this.verified.set(false);
        this.step.set('code');
        return;
      }
      this.challenge.set(null);
      this.stopCooldown();
      this.step.set('done');
    } finally {
      this.loading.set(false);
    }
  }

  // --- closing ------------------------------------------------------------

  /**
   * "Back to sign in" and "Return to sign in": close and clear.
   *
   * Routed through `closeDialog` rather than emitting on its own, because the
   * parent closing the dialog does not bring the cleanup with it — `open` is an
   * input, so once the parent sets it false the modal merely hides and never
   * calls back. Emitting alone would close the dialog and leave the typed email,
   * the code and the new password sitting in the component for next time.
   */
  protected dismiss(): void {
    this.closeDialog();
  }

  /**
   * The modal's own close requests: the X button, Escape, and a backdrop click.
   *
   * These arrive from `Modal` because `open` is owned by the parent and the modal
   * cannot close itself. That is also why this has to emit: the parent is the
   * only thing that can set `open` back to false, and without the emit the X
   * button cleared the form while leaving the dialog on screen.
   */
  protected onDialogClosed(): void {
    this.closeDialog();
  }

  /**
   * The single way out of this dialog: clear everything sensitive, then tell the
   * parent to close.
   *
   * Every route out goes through here — the X, Escape, the backdrop, and both
   * footer actions — so no path can leave a live OTP challenge or a typed
   * password behind. The account is not signed in afterwards: nothing here
   * created a session, so the user goes back to the sign-in form to use the
   * password they just set.
   *
   * Idempotent, because a caller may reach it twice (the X emits, and the
   * parent's update can close the modal again on the way out).
   */
  private closeDialog(): void {
    const id = this.challenge()?.challengeId;
    if (id) this.service.invalidate(id);

    this.step.set('email');
    this.loading.set(false);
    this.error.set(null);
    this.notice.set(null);
    this.challenge.set(null);
    this.verified.set(false);
    this.cooldownSeconds.set(0);
    this.requestedEmail.set('');
    this.unknownAttempts = 0;
    this.otpControl.reset('');
    this.emailForm.reset({ email: '' });
    this.emailForm.markAsUntouched();
    this.passwordForm.reset({ [NEW_PASSWORD]: '', [CONFIRM_PASSWORD]: '' });
    this.passwordForm.markAsUntouched();
    this.stopCooldown();

    // Last, so everything above is already cleared if the parent's update to
    // `open` re-enters this method on the way out.
    this.closed.emit();
  }

  // --- the resend cooldown, as a countdown --------------------------------

  private cooldownTimer: ReturnType<typeof setInterval> | null = null;

  private startCooldown(cooldownUntil: number): void {
    this.stopCooldown();
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((cooldownUntil - this.clock()) / 1000));
      this.cooldownSeconds.set(remaining);
      if (remaining <= 0) this.stopCooldown();
    };
    tick();
    if (this.cooldownSeconds() > 0) this.cooldownTimer = setInterval(tick, 1000);
  }

  private stopCooldown(): void {
    if (this.cooldownTimer !== null) {
      clearInterval(this.cooldownTimer);
      this.cooldownTimer = null;
    }
  }
}