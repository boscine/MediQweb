import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  isDevMode,
  signal,
} from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { CLOCK } from '../../../core/services/clock';
import {
  PasswordManagementService,
  describeOtpFailure,
  maskEmail,
  type OtpChallenge,
  type PasswordAccount,
} from '../../../core/services/password-management.service';
import { Button, Card, FormField, Modal, OtpInput, PasswordFields } from '../../../shared/components';
// DEV-ONLY: delete this import, the `devPanel` field, and the DevOtpHint entry
// in `imports` to remove the development code helper. See dev-otp-hint.ts.
import { DevOtpHint } from '../../../shared/components/dev-otp-hint/dev-otp-hint';
import {
  CONFIRM_PASSWORD,
  NEW_PASSWORD,
  passwordsMatch,
  passwordPolicy,
} from '../../../shared/validation/password.policy';

/** The three steps, in order. `done` is the receipt, not an editable step. */
type Step = 'request' | 'verify' | 'password' | 'done';

/**
 * Change password for a signed-in user, behind an email code.
 *
 * Shared by the Doctor and Secretary profiles: both hand it the signed-in
 * account and everything else — the steps, the wording, the policy — is one
 * implementation. The account arrives as an input rather than being resolved
 * here, because each area keeps its own mock identity and neither knows about
 * the other.
 *
 * The verification is real *inside* this prototype: the service refuses a
 * password change unless that challenge's code was verified, so the disabled
 * button is not the only thing standing between a user and a new password. It is
 * still only client-side, and that limit is stated on the card that opens this
 * and in the service's own documentation.
 */
@Component({
  selector: 'app-change-password',
  imports: [
    ReactiveFormsModule,
    Button,
    Card,
    FormField,
    Modal,
    OtpInput,
    PasswordFields,
    DevOtpHint, // DEV-ONLY
  ],
  templateUrl: './change-password.html',
  styleUrl: './change-password.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangePassword {
  /** The signed-in user's account. The code always goes to this address. */
  readonly account = input.required<PasswordAccount>();

  private readonly service = inject(PasswordManagementService);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly open = signal(false);
  protected readonly step = signal<Step>('request');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly challenge = signal<OtpChallenge | null>(null);
  protected readonly verified = signal(false);
  /** Seconds left before a resend is allowed, for the cooldown message. */
  protected readonly cooldownSeconds = signal(0);

  // DEV-ONLY: see the import above. Delete this field and the template block to
  // remove the development code helper.
  protected readonly devPanel = isDevMode();

  protected readonly passwordForm = this.fb.group(
    {
      [NEW_PASSWORD]: this.fb.control('', [Validators.required, passwordPolicy]),
      [CONFIRM_PASSWORD]: this.fb.control('', [Validators.required, passwordPolicy]),
    },
    { validators: [passwordsMatch] },
  );

  /**
   * The code lives in its own control rather than in `passwordForm`.
   *
   * The two are never on screen together — the code is step two, the passwords
   * are step three — so one form would carry a control the user cannot see and
   * whose emptiness would quietly block submit.
   */
  protected readonly otpControl = new FormControl('', { nonNullable: true });

  /** Control names, exposed because the template cannot index a form by a const. */
  protected readonly changePasswordNewName = NEW_PASSWORD;
  protected readonly changePasswordConfirmName = CONFIRM_PASSWORD;

  /** Shown on every step, so the user can see which address a code goes to. */
  protected readonly maskedEmail = computed(
    () => this.challenge()?.maskedEmail ?? maskEmail(this.account().email),
  );

  /** True only while the cooldown is running, which is what greys the resend. */
  protected readonly coolingDown = computed(() => this.cooldownSeconds() > 0);

  constructor() {
    // A timer outliving the dialog would keep the zone busy after it closed.
    inject(DestroyRef).onDestroy(() => this.stopCooldown());
  }

  // --- opening and closing ------------------------------------------------

  protected openDialog(): void {
    this.reset();
    this.open.set(true);
  }

  protected close(): void {
    this.forgetChallenge();
    this.reset();
    this.open.set(false);
  }

  /** Escape and the backdrop both land here, so neither can skip the cleanup. */
  protected onDialogClosed(): void {
    this.close();
  }

  private reset(): void {
    this.step.set('request');
    this.loading.set(false);
    this.error.set(null);
    this.challenge.set(null);
    this.verified.set(false);
    this.cooldownSeconds.set(0);
    this.otpControl.reset('');
    this.passwordForm.reset({ [NEW_PASSWORD]: '', [CONFIRM_PASSWORD]: '' });
    this.passwordForm.markAsUntouched();
    this.stopCooldown();
  }

  private forgetChallenge(): void {
    const id = this.challenge()?.challengeId;
    if (id) this.service.invalidate(id);
  }

  // --- step 1: ask for a code --------------------------------------------

  protected async sendCode(): Promise<void> {
    if (this.loading()) return; // no double submission
    this.loading.set(true);
    this.error.set(null);
    try {
      // The account comes from the session, not from anything the user can type,
      // so this can only ever issue a code for the signed-in account.
      const challenge = await this.service.requestChangePasswordOtp(this.account());
      this.challenge.set(challenge);
      this.step.set('verify');
      this.startCooldown(challenge.cooldownUntil);
    } finally {
      this.loading.set(false);
    }
  }

  // --- step 2: check the code --------------------------------------------

  protected verifyCode(code: string): void {
    const challenge = this.challenge();
    if (!challenge) return;

    const result = this.service.verifyOtp(challenge.challengeId, code);
    if (result.ok) {
      this.verified.set(true);
      this.error.set(null);
      this.step.set('password');
      return;
    }
    this.error.set(
      describeOtpFailure(result.reason, this.service.getChallenge(challenge.challengeId)?.attemptsRemaining ?? 0),
    );
  }

  protected async resend(): Promise<void> {
    const challenge = this.challenge();
    if (!challenge || this.loading()) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      // No client-side cooldown check here on purpose. `coolingDown()` is driven
      // by a real interval for the button's label, and it can disagree with the
      // service — a throttled background tab stops the interval, which would make
      // this refuse a resend the service is willing to honour. The service reads
      // the same injected clock and is the only thing that decides.
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

  protected changeEmail(): void {
    this.forgetChallenge();
    this.challenge.set(null);
    this.verified.set(false);
    this.error.set(null);
    this.step.set('request');
    // The typed code belongs to the code that was just dropped.
    this.otpControl.reset('');
    this.stopCooldown();
  }

  // --- step 3: set the password ------------------------------------------

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
    // The mismatch is a group-level error, so it lives on the form and not on
    // either control. Reading it off the control would silently never fire.
    if (this.passwordForm.hasError('passwordsMismatch')) return 'The two passwords do not match.';
    return null;
  }

  /**
   * Submit stays disabled until the form is valid, the code was verified, and a
   * challenge is still live.
   *
   * The last clause is what stops the receipt from being resubmitted: a completed
   * change consumes the challenge, and requiring one here means the answer becomes
   * false on success rather than staying true because the form happens to be
   * filled in.
   */
  protected canSubmit(): boolean {
    return this.challenge() !== null && this.verified() && this.passwordForm.valid && !this.loading();
  }

  protected async submit(): Promise<void> {
    const challenge = this.challenge();
    if (!challenge || this.loading()) return;
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    try {
      const result = await this.service.completePasswordChange(
        challenge.challengeId,
        this.passwordForm.getRawValue()[NEW_PASSWORD],
      );
      if (!result.ok) {
        this.error.set(describeOtpFailure(result.reason, challenge.attemptsRemaining));
        this.verified.set(false);
        this.step.set('verify');
        return;
      }
      // The service consumed the challenge; drop the local copy before the
      // receipt renders so nothing can resubmit against a dead challenge.
      this.challenge.set(null);
      this.stopCooldown();
      this.step.set('done');
    } finally {
      this.loading.set(false);
    }
  }

  // --- the resend cooldown, as a countdown --------------------------------

  private readonly clock = inject(CLOCK);
  private cooldownTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Counts down the service's cooldown rather than tracking it here.
   *
   * Display only: the authoritative check is inside `resend`, which reads the
   * clock through `CLOCK`. This exists so the label updates while the dialog is
   * open, and uses the same injected clock so a test that moves time does not
   * have to fake timers to watch the button come back.
   */
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