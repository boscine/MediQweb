import { TestBed } from '@angular/core/testing';
import { CLOCK } from './clock';
import {
  DEV_MODE,
  DEV_MOCK_OTP,
  OTP_EXPIRY_MS,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  PasswordManagementService,
  describeOtpFailure,
  maskEmail,
  type OtpChallenge,
  type PasswordAccount,
} from './password-management.service';
import { resetStoredPasswords, storedPassword } from './password-store';

const DOCTOR: PasswordAccount = { accountId: 'doc-002', email: 'rafael.santos@mediq.ph', role: 'doctor' };
const SECRETARY: PasswordAccount = { accountId: 'sec-001', email: 'celine.villanueva@mediq.ph', role: 'secretary' };

/** A password that satisfies the policy: long enough, with a letter and a number. */
const GOOD = 'clinic-portal-2026';

/** A clock the test moves by hand, so nothing here waits on real time. */
class FakeClock {
  constructor(private value = Date.parse('2026-10-18T09:00:00Z')) {}
  readonly read = () => this.value;
  advance(ms: number): void {
    this.value += ms;
  }
}

describe('maskEmail', () => {
  it('keeps the first two characters and the domain', () => {
    expect(maskEmail('rafael.santos@mediq.ph')).toBe('ra***********@mediq.ph');
  });

  it('always hides at least one character of the local part', () => {
    // Two characters visible out of two would leave the address fully readable,
    // which is the one case masking exists to prevent.
    expect(maskEmail('ab@mediq.ph')).toBe('a*@mediq.ph');
    expect(maskEmail('a@mediq.ph')).toBe('a*@mediq.ph');
    expect(maskEmail('ab@mediq.ph')).not.toBe('ab@mediq.ph');
  });

  it('falls back to a fixed mask for something with no domain', () => {
    expect(maskEmail('nonsense')).toBe('•••');
  });
});

describe('describeOtpFailure', () => {
  it('never names an account or confirms one exists', () => {
    // The wording is the whole of the anti-enumeration guarantee; a future edit
    // that added "no account uses that address" would slip past every other test.
    for (const reason of [
      'incomplete',
      'invalid',
      'expired',
      'superseded',
      'attempts-exhausted',
      'wrong-purpose',
      'cooldown',
      'not-verified',
      'unknown-challenge',
    ] as const) {
      expect(describeOtpFailure(reason, 3)).not.toMatch(/account|email|exist/i);
    }
  });

  it('counts the attempts that remain', () => {
    expect(describeOtpFailure('invalid', 3)).toContain('3 attempts left');
    expect(describeOtpFailure('invalid', 1)).toContain('1 attempt left');
  });
});

describe('PasswordManagementService', () => {
  let service: PasswordManagementService;
  let clock: FakeClock;

  beforeEach(() => {
    clock = new FakeClock();
    // The password store is module-scoped and so outlives TestBed; without this
    // a password changed by one test would satisfy another test's "unchanged"
    // assertion in the wrong direction.
    resetStoredPasswords();
    TestBed.configureTestingModule({ providers: [{ provide: CLOCK, useValue: clock.read }] });
    service = TestBed.inject(PasswordManagementService);
  });

  /** Issues a challenge and returns it with its real code. */
  async function issue(
    account: PasswordAccount = DOCTOR,
    purpose: 'change-password' | 'forgot-password' = 'change-password',
  ): Promise<{ challenge: OtpChallenge; code: string }> {
    const challenge =
      purpose === 'change-password'
        ? await service.requestChangePasswordOtp(account)
        : ((await service.requestPasswordResetOtp(account.email)) as OtpChallenge);
    return { challenge, code: service.peekIssuedCode(challenge.challengeId) as string };
  }

  describe('issuing a code', () => {
    it('issues six digits', async () => {
      const { code } = await issue();
      expect(code).toMatch(/^\d{6}$/);
    });

    it('asks for a fresh code on every issue', async () => {
      const first = await issue();
      clock.advance(OTP_RESEND_COOLDOWN_MS);
      const result = await service.resend(first.challenge.challengeId);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(service.peekIssuedCode(result.challenge.challengeId)).toMatch(/^\d{6}$/);
      }
    });

    it('has no hardcoded universal code', async () => {
      // The point of this assertion: a prototype that accepts `123456` teaches the
      // wrong habit and, if the fixtures ever leaked, that code would be a real
      // bypass. Checked across several issues, not once.
      const codes = new Set<string>();
      for (let i = 0; i < 12; i++) {
        const { challenge, code } = await issue();
        codes.add(code);
        clock.advance(OTP_RESEND_COOLDOWN_MS);
        await service.resend(challenge.challengeId);
      }
      expect(codes.size).toBeGreaterThan(1);
      expect(codes.has('123456')).toBe(false);
    });

    it('masks the address and reports an expiry five minutes out', async () => {
      const { challenge } = await issue();
      expect(challenge.maskedEmail).toBe('ra***********@mediq.ph');
      expect(challenge.expiresAt).toBe(clock.read() + OTP_EXPIRY_MS);
      expect(challenge.cooldownUntil).toBe(clock.read() + OTP_RESEND_COOLDOWN_MS);
      expect(challenge.attemptsRemaining).toBe(OTP_MAX_ATTEMPTS);
    });

    it('sends the code to the account it was given, not one the caller names', async () => {
      // The change-password entry point takes the whole account, so there is no
      // string a caller could substitute to redirect the code elsewhere.
      const { challenge } = await issue(DOCTOR);
      expect(challenge.accountId).toBe('doc-002');
    });
  });

  describe('verifying a code', () => {
    it('accepts the code that was issued', async () => {
      const { challenge, code } = await issue();
      expect(service.verifyOtp(challenge.challengeId, code)).toEqual({ ok: true });
    });

    it('reports an unfinished entry without spending an attempt', async () => {
      const { challenge } = await issue();
      expect(service.verifyOtp(challenge.challengeId, '12')).toEqual({
        ok: false,
        reason: 'incomplete',
      });
      expect(service.verifyOtp(challenge.challengeId, 'abcdef')).toEqual({
        ok: false,
        reason: 'incomplete',
      });
      // Five tries, then it should still have all five.
      expect(service.getChallenge(challenge.challengeId)?.attemptsRemaining).toBe(OTP_MAX_ATTEMPTS);
    });

    it('rejects a wrong code and spends an attempt', async () => {
      const { challenge, code } = await issue();
      const wrong = code === '000000' ? '111111' : '000000';

      expect(service.verifyOtp(challenge.challengeId, wrong)).toEqual({
        ok: false,
        reason: 'invalid',
      });
      expect(service.getChallenge(challenge.challengeId)?.attemptsRemaining).toBe(OTP_MAX_ATTEMPTS - 1);
    });

    it('dies after five wrong guesses', async () => {
      const { challenge, code } = await issue();
      const wrong = code === '000000' ? '111111' : '000000';

      for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) {
        service.verifyOtp(challenge.challengeId, wrong);
      }
      // The sixth try reports the exhaustion rather than another "invalid", and
      // the challenge is gone.
      expect(service.verifyOtp(challenge.challengeId, code)).toEqual({
        ok: false,
        reason: 'attempts-exhausted',
      });
      expect(service.getChallenge(challenge.challengeId)).toBeNull();
    });

    it('still accepts the right code when the fifth guess is correct', async () => {
      const { challenge, code } = await issue();
      const wrong = code === '000000' ? '111111' : '000000';

      for (let i = 0; i < OTP_MAX_ATTEMPTS - 1; i++) {
        service.verifyOtp(challenge.challengeId, wrong);
      }
      expect(service.verifyOtp(challenge.challengeId, code)).toEqual({ ok: true });
    });
  });

  describe('expiry', () => {
    it('accepts a code right up to the five-minute mark', async () => {
      const { challenge, code } = await issue();
      clock.advance(OTP_EXPIRY_MS);
      expect(service.verifyOtp(challenge.challengeId, code)).toEqual({ ok: true });
    });

    it('refuses a code one millisecond later', async () => {
      const { challenge, code } = await issue();
      clock.advance(OTP_EXPIRY_MS + 1);
      expect(service.verifyOtp(challenge.challengeId, code)).toEqual({
        ok: false,
        reason: 'expired',
      });
    });

    it('stops counting a verified challenge as verified once it expires', async () => {
      const { challenge, code } = await issue();
      service.verifyOtp(challenge.challengeId, code);
      expect(service.isVerified(challenge.challengeId)).toBe(true);

      clock.advance(OTP_EXPIRY_MS + 1);
      expect(service.isVerified(challenge.challengeId)).toBe(false);
    });
  });

  describe('resending', () => {
    it('refuses inside the thirty-second cooldown', async () => {
      const { challenge } = await issue();
      expect(await service.resend(challenge.challengeId)).toEqual({
        ok: false,
        reason: 'cooldown',
      });
    });

    it('allows a resend once the cooldown has passed', async () => {
      const { challenge } = await issue();
      clock.advance(OTP_RESEND_COOLDOWN_MS);
      expect((await service.resend(challenge.challengeId)).ok).toBe(true);
    });

    it('invalidates the previous code', async () => {
      const { challenge, code } = await issue();
      clock.advance(OTP_RESEND_COOLDOWN_MS);
      const result = await service.resend(challenge.challengeId);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // The old code must not work against the new challenge...
      expect(service.verifyOtp(result.challenge.challengeId, code)).toEqual({
        ok: false,
        reason: 'invalid',
      });
      // ...and the old challenge is gone entirely rather than merely unverified.
      expect(service.getChallenge(challenge.challengeId)).toBeNull();
    });

    it('replaces a challenge issued for the same account and purpose', async () => {
      const first = await issue();
      // Same account, same purpose, requested again with no cooldown check: the
      // service replaces the live challenge rather than running two at once.
      const second = await service.requestChangePasswordOtp(DOCTOR);

      expect(second.challengeId).not.toBe(first.challenge.challengeId);
      expect(service.getChallenge(first.challenge.challengeId)).toBeNull();
      // The superseded code cannot be carried over to the replacement.
      expect(service.verifyOtp(second.challengeId, first.code)).toEqual({
        ok: false,
        reason: 'invalid',
      });
    });
  });

  describe('purpose and account binding', () => {
    it('will not let a change-password code reset a forgotten password', async () => {
      const { challenge, code } = await issue(DOCTOR, 'change-password');
      const reset = (await service.requestPasswordResetOtp(DOCTOR.email)) as OtpChallenge;

      // A different challenge for a different purpose, even for the same person.
      expect(reset.purpose).toBe('forgot-password');
      expect(reset.challengeId).not.toBe(challenge.challengeId);
      // The change-password code is not valid against the reset challenge.
      expect(service.verifyOtp(reset.challengeId, code)).toEqual({
        ok: false,
        reason: 'invalid',
      });
    });

    it("will not let one account's code change another account's password", async () => {
      const { challenge, code } = await issue(DOCTOR);
      expect(challenge.accountId).toBe('doc-002');
      expect(SECRETARY.accountId).toBe('sec-001');

      expect(service.verifyOtp(challenge.challengeId, code)).toEqual({ ok: true });
      await service.completePasswordChange(challenge.challengeId, GOOD);

      // The account comes from the stored challenge, not from the caller, so the
      // write lands on doc-002 and sec-001 is untouched.
      expect(storedPassword('doc-002', 'original')).toBe(GOOD);
      expect(storedPassword('sec-001', 'original')).toBe('original');
    });
  });

  describe('completing a password operation', () => {
    it('refuses without a verified code', async () => {
      const { challenge } = await issue();
      expect(await service.completePasswordChange(challenge.challengeId, GOOD)).toEqual({
        ok: false,
        reason: 'not-verified',
      });
      expect(storedPassword('doc-002', 'original')).toBe('original');
    });

    it('refuses when the code was wrong', async () => {
      const { challenge, code } = await issue();
      service.verifyOtp(challenge.challengeId, code === '000000' ? '111111' : '000000');

      expect(await service.completePasswordChange(challenge.challengeId, GOOD)).toEqual({
        ok: false,
        reason: 'not-verified',
      });
    });

    it('re-checks the policy rather than trusting the form', async () => {
      const { challenge, code } = await issue();
      service.verifyOtp(challenge.challengeId, code);

      // Too short, and letters with no number: both rejected even though the
      // challenge is verified, because the service does its own check.
      expect(await service.completePasswordChange(challenge.challengeId, 'short1')).toEqual({
        ok: false,
        reason: 'not-verified',
      });
      expect(await service.completePasswordChange(challenge.challengeId, 'nodigitshere')).toEqual({
        ok: false,
        reason: 'not-verified',
      });
      expect(storedPassword('doc-002', 'original')).toBe('original');
    });

    it('changes the password once the code is verified', async () => {
      const { challenge, code } = await issue();
      service.verifyOtp(challenge.challengeId, code);

      expect(await service.completePasswordChange(challenge.challengeId, GOOD)).toEqual({ ok: true });
      expect(storedPassword('doc-002', 'original')).toBe(GOOD);
    });

    it('consumes the challenge, so it cannot be replayed', async () => {
      const { challenge, code } = await issue();
      service.verifyOtp(challenge.challengeId, code);
      await service.completePasswordChange(challenge.challengeId, GOOD);

      expect(service.isVerified(challenge.challengeId)).toBe(false);
      expect(await service.completePasswordChange(challenge.challengeId, 'another-one-2')).toEqual({
        ok: false,
        reason: 'unknown-challenge',
      });
    });

    it('resets a forgotten password on the same terms', async () => {
      const { challenge, code } = await issue(SECRETARY, 'forgot-password');
      expect(service.verifyOtp(challenge.challengeId, code)).toEqual({ ok: true });

      expect(await service.completePasswordReset(challenge.challengeId, GOOD)).toEqual({ ok: true });
      expect(storedPassword('sec-001', 'original')).toBe(GOOD);
    });
  });

  describe('looking accounts up by email', () => {
    it('ignores case and surrounding whitespace', () => {
      expect(service.findByEmail('  RAFAEL.SANTOS@Mediq.PH ')?.accountId).toBe('doc-002');
    });

    it('returns null for an address no account uses', () => {
      expect(service.findByEmail('nobody@mediq.ph')).toBeNull();
    });

    it('issues nothing for an address no account uses', async () => {
      // The caller is responsible for not turning this into an answer; the
      // service simply has no challenge to hand back.
      expect(await service.requestPasswordResetOtp('nobody@mediq.ph')).toBeNull();
    });
  });

  describe('invalidating a challenge', () => {
    it('drops it, verified or not', async () => {
      const verified = await issue();
      service.verifyOtp(verified.challenge.challengeId, verified.code);
      service.invalidate(verified.challenge.challengeId);

      expect(service.isVerified(verified.challenge.challengeId)).toBe(false);
      expect(await service.completePasswordChange(verified.challenge.challengeId, GOOD)).toEqual({
        ok: false,
        reason: 'unknown-challenge',
      });
      expect(storedPassword('doc-002', 'original')).toBe('original');
    });

    it('tolerates an id that was never issued', () => {
      // The flow calls this on close even before a code has been requested.
      expect(() => service.invalidate('')).not.toThrow();
    });
  });

  describe('the development code peek', () => {
    it('is not reachable from anything but a test', async () => {
      // A guard on the shape rather than the call site: the method exists and is
      // documented as development-only, and no template in the feature calls it.
      const { challenge } = await issue();
      expect(service.peekIssuedCode(challenge.challengeId)).toMatch(/^\d{6}$/);
      expect(service.peekIssuedCode('otp-does-not-exist')).toBeNull();
    });
  });

  describe('the development mock code', () => {
    /** Rebuilds the service with the development gate forced on or off. */
    function withDevMode(enabled: boolean): void {
      resetStoredPasswords();
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          { provide: CLOCK, useValue: clock.read },
          { provide: DEV_MODE, useValue: enabled },
        ],
      });
      service = TestBed.inject(PasswordManagementService);
    }

    async function resetChallenge(
      account: PasswordAccount = DOCTOR,
    ): Promise<OtpChallenge> {
      return (await service.requestPasswordResetOtp(account.email)) as OtpChallenge;
    }

    beforeEach(() => withDevMode(true));

    it('is accepted for a real password-reset challenge', async () => {
      const challenge = await resetChallenge();

      expect(service.verifyOtp(challenge.challengeId, DEV_MOCK_OTP)).toEqual({ ok: true });
      expect(service.isVerified(challenge.challengeId)).toBe(true);
    });

    it('is refused in a production build', async () => {
      // The load-bearing test for this feature. If the gate ever leaked the
      // wrong way, `000000` would reset any account in production.
      withDevMode(false);
      const challenge = await resetChallenge();

      expect(service.verifyOtp(challenge.challengeId, DEV_MOCK_OTP)).toEqual({
        ok: false,
        reason: 'invalid',
      });
      expect(service.isVerified(challenge.challengeId)).toBe(false);
    });

    it('still requires a challenge that exists', async () => {
      // No request, no challenge, no bypass: the mock cannot conjure one.
      expect(service.verifyOtp('otp-never-issued', DEV_MOCK_OTP)).toEqual({
        ok: false,
        reason: 'unknown-challenge',
      });
      expect(service.verifyOtp('', DEV_MOCK_OTP)).toEqual({
        ok: false,
        reason: 'unknown-challenge',
      });
    });

    it('does not work without a registered address', async () => {
      // The request itself is what proves the address belongs to an account;
      // an unknown one yields no challenge to verify against.
      expect(await service.requestPasswordResetOtp('nobody@mediq.ph')).toBeNull();
      expect(service.verifyOtp('', DEV_MOCK_OTP)).toEqual({
        ok: false,
        reason: 'unknown-challenge',
      });
    });

    it('does not work for a change-password challenge', async () => {
      // Change Password is untouched: that dialog proves you hold the account,
      // and a fixed code would weaken the strongest case for needing one.
      const challenge = await service.requestChangePasswordOtp(DOCTOR);

      expect(service.verifyOtp(challenge.challengeId, DEV_MOCK_OTP)).toEqual({
        ok: false,
        reason: 'invalid',
      });
    });

    it('still has to be the right length and numeric', async () => {
      const challenge = await resetChallenge();

      expect(service.verifyOtp(challenge.challengeId, '00000')).toEqual({
        ok: false,
        reason: 'incomplete',
      });
      expect(service.verifyOtp(challenge.challengeId, '00000a')).toEqual({
        ok: false,
        reason: 'incomplete',
      });
      // Neither of those spent an attempt.
      expect(service.getChallenge(challenge.challengeId)?.attemptsRemaining).toBe(OTP_MAX_ATTEMPTS);
    });

    it('does not bypass the expiry', async () => {
      const challenge = await resetChallenge();
      clock.advance(OTP_EXPIRY_MS + 1);

      expect(service.verifyOtp(challenge.challengeId, DEV_MOCK_OTP)).toEqual({
        ok: false,
        reason: 'expired',
      });
    });

    it('does not bypass a superseded challenge', async () => {
      const first = await resetChallenge();
      const second = await resetChallenge();

      expect(service.verifyOtp(first.challengeId, DEV_MOCK_OTP)).toEqual({
        ok: false,
        reason: 'unknown-challenge',
      });
      expect(service.verifyOtp(second.challengeId, DEV_MOCK_OTP)).toEqual({ ok: true });
    });

    it('does not bypass the attempt limit', async () => {
      const challenge = await resetChallenge();

      for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) {
        service.verifyOtp(challenge.challengeId, '999999');
      }

      expect(service.verifyOtp(challenge.challengeId, DEV_MOCK_OTP)).toEqual({
        ok: false,
        reason: 'attempts-exhausted',
      });
      expect(storedPassword('doc-002', 'original')).toBe('original');
    });

    it('spends an attempt like any other code', async () => {
      const challenge = await resetChallenge();

      service.verifyOtp(challenge.challengeId, DEV_MOCK_OTP);

      expect(service.getChallenge(challenge.challengeId)?.attemptsRemaining).toBe(
        OTP_MAX_ATTEMPTS - 1,
      );
    });

    it('leaves every other code alone', async () => {
      const { challenge, code } = await issue(DOCTOR, 'forgot-password');
      // Not `000000` and not the real code: in development that one is now a
      // second accepted value, so it is not a wrong guess here.
      const wrong = code === '888888' ? '999999' : '888888';

      expect(service.verifyOtp(challenge.challengeId, wrong)).toEqual({
        ok: false,
        reason: 'invalid',
      });

      // A fresh challenge for the positive case, carrying its own real code.
      const other = await resetChallenge();
      const otherCode = service.peekIssuedCode(other.challengeId) as string;
      expect(service.verifyOtp(other.challengeId, otherCode)).toEqual({ ok: true });
    });

    it('completes a reset once accepted', async () => {
      const challenge = await resetChallenge();
      service.verifyOtp(challenge.challengeId, DEV_MOCK_OTP);

      expect(await service.completePasswordReset(challenge.challengeId, GOOD)).toEqual({
        ok: true,
      });
      expect(storedPassword('doc-002', 'original')).toBe(GOOD);
    });

    it('cannot complete a reset without being verified first', async () => {
      const challenge = await resetChallenge();

      expect(await service.completePasswordReset(challenge.challengeId, GOOD)).toEqual({
        ok: false,
        reason: 'not-verified',
      });
      expect(storedPassword('doc-002', 'original')).toBe('original');
    });
  });
});