import { FormControl, FormGroup } from '@angular/forms';
import {
  CONFIRM_PASSWORD,
  NEW_PASSWORD,
  PASSWORD_MIN_LENGTH,
  PASSWORD_REQUIREMENTS,
  passwordsMatch,
  passwordPolicy,
  unmetPasswordRequirements,
} from './password.policy';

/** Runs the field validator the way a form control would. */
const runPolicy = (value: string) => passwordPolicy(new FormControl(value));

function passwordForm(password: string, confirm: string) {
  // Carries the same validators the two flows attach, so a test sees the same
  // errors the form would.
  return new FormGroup(
    {
      [NEW_PASSWORD]: new FormControl(password, { validators: [passwordPolicy] }),
      [CONFIRM_PASSWORD]: new FormControl(confirm, { validators: [passwordPolicy] }),
    },
    { validators: [passwordsMatch] },
  );
}

describe('unmetPasswordRequirements', () => {
  it('passes a long value with a letter and a number', () => {
    expect(unmetPasswordRequirements('clinic-portal-2026')).toEqual([]);
  });

  it('reports a value that is too short', () => {
    expect(unmetPasswordRequirements('short1')).toContain(PASSWORD_REQUIREMENTS[0]);
  });

  it('reports a value with no number', () => {
    expect(unmetPasswordRequirements('no-digits-at-all')).toContain(PASSWORD_REQUIREMENTS[2]);
  });

  it('reports a value with no letter', () => {
    expect(unmetPasswordRequirements('12345678901234')).toContain(PASSWORD_REQUIREMENTS[1]);
  });

  it('counts length in characters, not bytes or words', () => {
    // The boundary is the point: one character under, then exactly at.
    const oneUnder = 'a'.repeat(PASSWORD_MIN_LENGTH - 2) + '1';
    expect(oneUnder).toHaveLength(PASSWORD_MIN_LENGTH - 1);
    expect(unmetPasswordRequirements(oneUnder)).toContain(PASSWORD_REQUIREMENTS[0]);
    expect(unmetPasswordRequirements(oneUnder)).not.toContain(PASSWORD_REQUIREMENTS[1]);

    expect(unmetPasswordRequirements('a'.repeat(PASSWORD_MIN_LENGTH - 1) + '1')).toEqual([]);
  });

  it('accepts upper, lower and non-letters as letters', () => {
    expect(unmetPasswordRequirements('ABCDEFGHIJKL1')).toEqual([]);
    // A word with no ASCII letters in it still has letters. Rejecting it would
    // refuse a perfectly good passphrase for a reason the user cannot see.
    expect(unmetPasswordRequirements('éàü1234567890')).toEqual([]);
  });

  it('counts non-ASCII digits as numbers', () => {
    expect(unmetPasswordRequirements('clinic-portal-٢٠٢٦')).toEqual([]);
  });
});

describe('passwordPolicy', () => {
  it('leaves an empty field to the required validator', () => {
    // Two errors on a field nobody has filled in yet is noise; only `required`
    // should speak for it.
    expect(runPolicy('')).toBeNull();
  });

  it('accepts a valid password', () => {
    expect(runPolicy('clinic-portal-2026')).toBeNull();
  });

  it('flags a password that breaks the policy', () => {
    expect(runPolicy('short')).toEqual({ passwordPolicy: true });
  });

  it('ignores a non-string value rather than throwing', () => {
    expect(passwordPolicy(new FormControl(null))).toBeNull();
    expect(passwordPolicy(new FormControl(12345))).toBeNull();
  });
});

describe('passwordsMatch', () => {
  it('passes when the two fields agree', () => {
    expect(passwordsMatch(passwordForm('clinic-portal-2026', 'clinic-portal-2026'))).toBeNull();
  });

  it('fails when they differ', () => {
    expect(passwordsMatch(passwordForm('clinic-portal-2026', 'clinic-portal-2027'))).toEqual({
      passwordsMismatch: true,
    });
  });

  it('stays quiet while both are empty', () => {
    // A fresh form should not open with a mismatch error on an untouched field.
    expect(passwordsMatch(passwordForm('', ''))).toBeNull();
  });

  it('fails when only one is filled', () => {
    expect(passwordsMatch(passwordForm('clinic-portal-2026', ''))).toEqual({
      passwordsMismatch: true,
    });
  });

  it('is unaffected by the pair being valid on its own terms', () => {
    // Both wrong but equal: the policy says no, the match says yes. They are
    // separate questions and must not be collapsed into one error.
    const form = passwordForm('short', 'short');
    expect(passwordsMatch(form)).toBeNull();
    expect(form.get(NEW_PASSWORD)?.hasError('passwordPolicy')).toBe(true);
  });
});