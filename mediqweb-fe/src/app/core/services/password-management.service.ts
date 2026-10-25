import { InjectionToken, Injectable, inject, isDevMode } from '@angular/core';
import { CLOCK } from './clock';
import {
  PASSWORD_MIN_LENGTH,
  unmetPasswordRequirements,
} from '../../shared/validation/password.policy';
import { storedPassword, storePassword } from './password-store';

/**
 * What a one-time code may authorise.
 *
 * A code is bound to one account *and* one purpose, and both are checked on
 * verification. Without the purpose a code obtained from the signed-in "change
 * my password" dialog would also reset an account named in a reset request —
 * two different operations, one shared secret.
 */
export type OtpPurpose = 'change-password' | 'forgot-password';

/** One account that can sign in to a MediQ workspace. */
export interface PasswordAccount {
  readonly accountId: string;
  readonly email: string;
  readonly role: string;
}

/** A challenge the user has been asked to complete. */
export interface OtpChallenge {
  readonly challengeId: string;
  readonly accountId: string;
  readonly purpose: OtpPurpose;
  /** Partially hidden, so it is recognisable without being shown in full. */
  readonly maskedEmail: string;
  readonly expiresAt: number;
  readonly cooldownUntil: number;
  readonly attemptsRemaining: number;
}

/** Why a verification did not succeed. Never names the account. */
export type OtpFailureReason =
  | 'incomplete'
  | 'invalid'
  | 'expired'
  | 'superseded'
  | 'attempts-exhausted'
  | 'wrong-purpose'
  | 'cooldown'
  | 'unknown-challenge'
  | 'not-verified';

/** The outcome of checking a code. */
export type OtpVerification =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: OtpFailureReason };

/** The outcome of asking for a replacement code. */
export type OtpResend =
  | { readonly ok: true; readonly challenge: OtpChallenge }
  | { readonly ok: false; readonly reason: OtpFailureReason };

/** How long a code stays usable. */
export const OTP_EXPIRY_MS = 5 * 60 * 1000;
/** How soon a new code may be requested after the last one. */
export const OTP_RESEND_COOLDOWN_MS = 30 * 1000;
/** Wrong codes allowed per issued code, after which it is dead. */
export const OTP_MAX_ATTEMPTS = 5;
/** Length of the code the user types. */
export const OTP_LENGTH = 6;

/**
 * The code that is always accepted while developing, so the reset flow can be
 * walked without reading a real one out of the console.
 *
 * Scoped to `forgot-password` only. The signed-in Change Password dialog does not
 * accept it: that flow's security story is "prove you hold the account", and a
 * code that needs no mailbox weakens exactly the case where the claim is
 * strongest.
 *
 * **It is an account oracle while development mode is on.** The recovery flow is
 * built so a registered and an unregistered address are indistinguishable — same
 * notice, same step, same wording. A fixed code gives that away: `000000`
 * verifies for a real account and not for a fake one, so anyone can enumerate
 * MediQ accounts by trying it. That is acceptable for a development shortcut and
 * unacceptable anywhere else, which is the second reason it is fenced behind
 * `DEV_MODE` as well as the purpose check. Dropping this constant once a real
 * backend exists removes the problem rather than documenting it away.
 */
export const DEV_MOCK_OTP = '000000';

/**
 * Whether development-only affordances are active.
 *
 * An injection token rather than a bare `isDevMode()` call so a test can drive
 * the service as a production build and prove the mock is refused there. In the
 * application nothing binds this, so it resolves to `isDevMode()` — false in a
 * production build, where `DEV_MOCK_OTP` is never even compared.
 */
export const DEV_MODE = new InjectionToken<boolean>('MediQ development mode', {
  providedIn: 'root',
  factory: () => isDevMode(),
});

interface StoredChallenge {
  readonly challengeId: string;
  readonly accountId: string;
  readonly purpose: OtpPurpose;
  readonly maskedEmail: string;
  readonly code: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly cooldownUntil: number;
  attemptsUsed: number;
  verified: boolean;
  /** Set when a newer code replaces this one, so the old one is refused clearly. */
  superseded: boolean;
  /** Set once the password step has completed. */
  consumed: boolean;
}

/**
 * Stand-in for the password service that a real backend will replace.
 *
 * **This is a prototype and is not production-secure password recovery.** Every
 * rule that matters here is enforced in the browser, where a caller is free to
 * edit it. A server must re-implement all of it before this feature is
 * reachable by anyone: authenticating the signed-in user, generating and storing
 * challenges, delivering codes through a mail provider, enforcing expiry and
 * attempt limits, and hashing passwords. See the section at the foot of this
 * file.
 *
 * Nothing is persisted. Codes and passwords live in memory for the session and
 * are never written to storage, cookies, fixtures or logs — the account table
 * below is a fixture of *identities*, not credentials, and the only password it
 * carries is the one the sign-in screen already prints.
 *
 * **`DEV_MOCK_OTP` is a standing hazard.** It is a fixed second factor that
 * resets a real account's password without a mailbox. It is inert in a
 * production build, and it still requires a live challenge for a registered
 * address — but it is exactly the thing that must never be wired to `true` by
 * accident, and it must be deleted outright when this feature is replaced by a
 * real backend. A test drives the service as a production build specifically to
 * keep that claim honest; see `verifyOtp`'s `accepts`.
 */
@Injectable({ providedIn: 'root' })
export class PasswordManagementService {
  private readonly clock = inject(CLOCK);
  private readonly devMode = inject(DEV_MODE);

  private nextId = 0;
  private readonly challenges = new Map<string, StoredChallenge>();
  /** Only the most recent challenge per account+purpose; resending replaces it. */
  private readonly latestByKey = new Map<string, string>();

  /**
   * The accounts a code can be issued for.
   *
   * Development-only, and the single place a real backend's account directory
   * would be consulted instead. Emails come from the areas' own profile fixtures
   * so the recovery flow matches the address each profile already shows.
   */
  private readonly directory: readonly PasswordAccount[] = MOCK_PASSWORD_DIRECTORY;

  /** Finds an account by email: trimmed, and case-insensitive. */
  findByEmail(email: string): PasswordAccount | null {
    const wanted = email.trim().toLowerCase();
    return this.directory.find((account) => account.email.toLowerCase() === wanted) ?? null;
  }

  /** Finds an account by id. */
  findById(accountId: string): PasswordAccount | null {
    return this.directory.find((account) => account.accountId === accountId) ?? null;
  }

  /**
   * Issues a code for the signed-in user changing their own password.
   *
   * Takes the account rather than trusting a caller-supplied email, so the code
   * always goes to the address on the account.
   */
  async requestChangePasswordOtp(account: PasswordAccount): Promise<OtpChallenge> {
    return this.issue(account, 'change-password');
  }

  /**
   * Issues a code for a password reset requested by email.
   *
   * Resolves `null` when the address is unknown. The caller shows the same
   * message either way — an answer that differed would let anyone test whether
   * an account exists.
   */
  async requestPasswordResetOtp(email: string): Promise<OtpChallenge | null> {
    const account = this.findByEmail(email);
    if (!account) return null;
    return this.issue(account, 'forgot-password');
  }

  /** Re-issues the code for a challenge, subject to the resend cooldown. */
  async resend(challengeId: string): Promise<OtpResend> {
    const stored = this.challenges.get(challengeId);
    if (!stored) return { ok: false, reason: 'unknown-challenge' };

    const now = this.clock();
    if (now < stored.cooldownUntil) return { ok: false, reason: 'cooldown' };
    if (stored.consumed) return { ok: false, reason: 'superseded' };

    const fresh = this.issue(this.require(stored.accountId, stored.purpose), stored.purpose, {
      // A resend replaces the old code outright.
      supersede: stored.challengeId,
    });
    return { ok: true, challenge: fresh };
  }
  /**
   * Checks a typed code against its challenge.
   *
   * The code must belong to this challenge, this account, this purpose, be
   * unexpired, not superseded, and still have attempts left.
   */
  verifyOtp(challengeId: string, code: string): OtpVerification {
    const stored = this.challenges.get(challengeId);
    if (!stored) return { ok: false, reason: 'unknown-challenge' };

    const typed = (code ?? '').trim();
    if (typed.length !== OTP_LENGTH || !/^\d+$/.test(typed)) {
      // A short or non-numeric entry is the form being unfinished, not a guess
      // being wrong, so it neither reads nor spends an attempt.
      return { ok: false, reason: 'incomplete' };
    }

    if (stored.superseded) return { ok: false, reason: 'superseded' };
    if (stored.consumed) return { ok: false, reason: 'superseded' };

    if (stored.attemptsUsed >= OTP_MAX_ATTEMPTS) {
      this.clear(stored.challengeId);
      return { ok: false, reason: 'attempts-exhausted' };
    }

    if (this.clock() > stored.expiresAt) {
      this.clear(stored.challengeId);
      return { ok: false, reason: 'expired' };
    }

    stored.attemptsUsed += 1;
    if (!this.accepts(stored, typed)) return { ok: false, reason: 'invalid' };

    stored.verified = true;
    return { ok: true };
  }

  /**
   * Whether this typed code opens the challenge.
   *
   * The real code, or — in development, for a password reset only — the fixed
   * mock. Deliberately the *last* check in `verifyOtp`, after the challenge has
   * been found, the format confirmed, and the superseded, consumed, attempt-limit
   * and expiry rules applied. Placing it there is the whole point: `000000` is
   * an alternative way to pass one comparison, not a way around the rest, so it
   * still needs a live challenge for a real registered address, still expires,
   * still spends an attempt and is still dead once superseded.
   */
  private accepts(stored: StoredChallenge, typed: string): boolean {
    if (stored.code === typed) return true;
    return (
      this.devMode && stored.purpose === 'forgot-password' && typed === DEV_MOCK_OTP
    );
  }

  /** True while a challenge holds a verified, unexpired, unconsumed code. */
  isVerified(challengeId: string): boolean {
    const stored = this.challenges.get(challengeId);
    if (!stored || !stored.verified) return false;
    if (stored.superseded || stored.consumed) return false;
    return this.clock() <= stored.expiresAt;
  }

  /** The challenge as the UI should see it. */
  getChallenge(challengeId: string): OtpChallenge | null {
    const stored = this.challenges.get(challengeId);
    return stored ? this.toPublic(stored) : null;
  }

  /**
   * Finishes a password change for the signed-in user.
   *
   * Refuses unless the challenge is verified, and only ever writes the password
   * for the account that challenge was issued to — the account id comes from the
   * stored challenge, not from the caller.
   */
  async completePasswordChange(challengeId: string, newPassword: string): Promise<OtpVerification> {
    return this.complete(challengeId, newPassword);
  }

  /** Finishes a password reset. Same rules: the challenge picks the account. */
  async completePasswordReset(challengeId: string, newPassword: string): Promise<OtpVerification> {
    return this.complete(challengeId, newPassword);
  }

  /**
   * Whether a password is accepted for an account right now.
   *
   * The sign-in screen calls this so a password reset actually changes what the
   * next sign-in accepts. Without it a reset would appear to succeed and the old
   * password would still work, which is the one outcome that must not happen.
   *
   * Reads the shared session store rather than a table of its own, because
   * `MockAuthGateway` needs the same answer and is built without injection.
   */
  passwordFor(accountId: string, fixturePassword: string): string {
    return storedPassword(accountId, fixturePassword);
  }

  /** Forgets a challenge: cancelling or finishing a flow. */
  invalidate(challengeId: string): void {
    this.clear(challengeId);
  }

  /**
   * The code most recently issued for a challenge.
   *
   * **Development and test use only.** Nothing calls this from the UI, and the
   * user interface never shows or announces a code — there is no "your code is
   * 123456" line anywhere in this feature, because a prototype that displays its
   * own second factor teaches the wrong habit. It exists so a test can complete a
   * flow without a hardcoded `123456` in the spec, which would be a universal
   * bypass if the code ever leaked into a real deployment.
   */
  peekIssuedCode(challengeId: string): string | null {
    return this.challenges.get(challengeId)?.code ?? null;
  }

  // --- internals ---------------------------------------------------------

  private issue(
    account: PasswordAccount,
    purpose: OtpPurpose,
    options: { supersede?: string } = {},
  ): OtpChallenge {
    if (options.supersede) {
      const previous = this.challenges.get(options.supersede);
      if (previous) previous.superseded = true;
      this.challenges.delete(options.supersede);
    }

    // One live challenge per account+purpose: a code for the same operation
    // replaces the last one rather than sitting beside it.
    const key = `${account.accountId}|${purpose}`;
    const existingId = this.latestByKey.get(key);
    if (existingId) {
      const existing = this.challenges.get(existingId);
      if (existing) existing.superseded = true;
      this.challenges.delete(existingId);
    }

    const now = this.clock();
    const stored: StoredChallenge = {
      challengeId: `otp-${++this.nextId}`,
      accountId: account.accountId,
      purpose,
      maskedEmail: maskEmail(account.email),
      code: generateNumericCode(OTP_LENGTH),
      issuedAt: now,
      expiresAt: now + OTP_EXPIRY_MS,
      cooldownUntil: now + OTP_RESEND_COOLDOWN_MS,
      attemptsUsed: 0,
      verified: false,
      superseded: false,
      consumed: false,
    };

    this.challenges.set(stored.challengeId, stored);
    this.latestByKey.set(key, stored.challengeId);
    return this.toPublic(stored);
  }

  private async complete(challengeId: string, newPassword: string): Promise<OtpVerification> {
    const stored = this.challenges.get(challengeId);
    if (!stored) return { ok: false, reason: 'unknown-challenge' };
    if (!this.isVerified(challengeId)) return { ok: false, reason: 'not-verified' };

    // Re-checked here rather than trusted from the form, so a value that reached
    // the service by some other route still cannot be stored.
    if (unmetPasswordRequirements(newPassword).length > 0) {
      return { ok: false, reason: 'not-verified' };
    }

    storePassword(stored.accountId, newPassword);
    stored.consumed = true;
    this.clear(stored.challengeId);
    return { ok: true };
  }

  private require(accountId: string, purpose: OtpPurpose): PasswordAccount {
    const account = this.findById(accountId);
    if (!account) throw new Error(`No mock account ${accountId}`);
    return account;
  }

  private clear(challengeId: string): void {
    const stored = this.challenges.get(challengeId);
    if (stored) this.latestByKey.delete(`${stored.accountId}|${stored.purpose}`);
    this.challenges.delete(challengeId);
  }

  private toPublic(stored: StoredChallenge): OtpChallenge {
    return {
      challengeId: stored.challengeId,
      accountId: stored.accountId,
      purpose: stored.purpose,
      maskedEmail: stored.maskedEmail,
      expiresAt: stored.expiresAt,
      cooldownUntil: stored.cooldownUntil,
      attemptsRemaining: Math.max(0, OTP_MAX_ATTEMPTS - stored.attemptsUsed),
    };
  }
}

/**
 * Wording for a verification that did not succeed.
 *
 * Lives beside the reasons so a new reason cannot be added without a sentence to
 * match it, and shared by both flows so they cannot drift apart. Never names the
 * account, says whether an address exists, or reveals which part of a guess was
 * wrong.
 */
export function describeOtpFailure(reason: OtpFailureReason, attemptsLeft: number): string {
  switch (reason) {
    case 'incomplete':
      return 'Enter all six digits.';
    case 'invalid':
      // Every remaining attempt is reported, including the last one — a single
      // attempt left is the most important moment to say so, because it is the
      // one before the challenge dies.
      return attemptsLeft >= 1
        ? `That code is not right. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} left.`
        : 'That code is not right.';
    case 'expired':
      return 'That code has expired. Request a new one.';
    case 'superseded':
      return 'That code was replaced by a newer one. Use the newest code.';
    case 'attempts-exhausted':
      return 'Too many incorrect attempts. Request a new code.';
    case 'wrong-purpose':
      return 'That code cannot be used here. Request a new one.';
    case 'cooldown':
      return 'Wait a moment before requesting another code.';
    case 'not-verified':
      return 'Verify your code before setting a new password.';
    case 'unknown-challenge':
      return 'Start again from the beginning.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

/**
 * `rafael.santos@mediq.ph` -> `ra****@mediq.ph`.
 *
 * Keeps the first two characters of the local part so the reader can tell which
 * of their own addresses this is, and hides the rest. The domain is left alone:
 * it is not the secret half.
 */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return '•••';
  const local = email.slice(0, at);
  // Never the whole local part. `min(2, length - 1)` is what stops a one- or
  // two-character address being rendered in full, which would leave nothing
  // masked at all.
  const visible = local.slice(0, Math.max(1, Math.min(2, local.length - 1)));
  return `${visible}${'*'.repeat(Math.max(1, local.length - visible.length))}${email.slice(at)}`;
}

/**
 * A random numeric code of `length` digits.
 *
 * Rejection sampling, so every digit is uniform: taking `value % 10` off a whole
 * byte favours 0-5 slightly, which is a real (if small) weakness in a value that
 * should be unpredictable. Falls back only if `crypto` is unavailable, which in
 * a browser is not a state that occurs.
 */
function generateNumericCode(length: number): string {
  const crypto = globalThis.crypto;
  if (!crypto?.getRandomValues) {
    return Array.from({ length }, () => String(Math.floor(Math.random() * 10))).join('');
  }
  const limit = 256 - (256 % 10); // largest multiple of 10 that fits a byte
  let code = '';
  const buffer = new Uint8Array(length);
  while (code.length < length) {
    crypto.getRandomValues(buffer);
    for (const byte of buffer) {
      if (byte >= limit) continue; // re-roll rather than bias the digit
      code += String(byte % 10);
      if (code.length === length) break;
    }
  }
  return code;
}

/**
 * Development-only account directory.
 *
 * Development fixtures only. A real implementation asks a server which account
 * owns an email address and never holds the list here, because a client-side
 * directory of who has an account *is* an account-enumeration table — the very
 * thing the recovery flow is built to avoid giving away. Read the entries as
 * "these addresses can recover a password", not as a list of who works here.
 *
 * Three of the four are copied from the areas' own profile fixtures rather than
 * invented, so recovery lands on the same address the profile already displays:
 *
 * - `doc-002` from `MOCK_DOCTOR_PROFILE` (Rafael Santos)
 * - `sec-001` from `MOCK_SECRETARY_PROFILE` (Celine Villanueva)
 * - `pat-101` from `MOCK_PATIENTS` (Juan Dela Cruz)
 *
 * The Admin is the exception and needs saying plainly: **no admin profile
 * fixture exists anywhere in this prototype.** The Admin area has no signed-in
 * identity of its own — the sign-in screen accepts the literal identifier `admin`
 * and the area reads its data from fixtures with no person attached. So the
 * address below is invented, following the existing staff convention, and will
 * have to be replaced by whatever the real admin directory says.
 *
 * Note also that `sec-001` means two different people across the codebase:
 * `MOCK_SECRETARY_PROFILE` calls Celine Villanueva `sec-001`, while
 * `MOCK_SECRETARIES` in the admin area calls Grace Lim `sec-001`. That collision
 * predates this file. Celine is listed because she is the signed-in secretary —
 * the account this feature can actually change a password for.
 */
const MOCK_PASSWORD_DIRECTORY: readonly PasswordAccount[] = [
  // Invented — see the note above.
  { accountId: 'admin-001', email: 'patricio.gomez@mediq.ph', role: 'admin' },
  { accountId: 'doc-002', email: 'rafael.santos@mediq.ph', role: 'doctor' },
  { accountId: 'sec-001', email: 'celine.villanueva@mediq.ph', role: 'secretary' },
  { accountId: 'pat-101', email: 'juan.delacruz@example.ph', role: 'patient' },
];

/** Minimum length, re-exported so a caller can describe the policy in one import. */
export { PASSWORD_MIN_LENGTH };
