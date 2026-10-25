import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// Deliberately permissive: staff sign in with the email the Admin created the
// account with, and some sites are addressed by username.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USERNAME = /^[a-zA-Z0-9._-]{3,}$/;

/**
 * Accepts either an email address or a username.
 *
 * Returns `null` for an empty value so `Validators.required` stays the single
 * owner of the "this field is blank" case and the two messages never overlap.
 */
export const emailOrUsername: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = String(control.value ?? '').trim();
  if (!value) return null;
  return EMAIL.test(value) || USERNAME.test(value) ? null : { emailOrUsername: true };
};

/**
 * Email format, for the forgot-password field.
 *
 * Strictly an address, unlike `emailOrUsername` above: recovery is matched
 * against a registered address, so accepting a username here would only ever
 * produce a request that cannot succeed. Returns null for an empty value so
 * `Validators.required` stays the single owner of "this field is blank".
 */
const EMAIL_ONLY = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const emailAddress: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = String(control.value ?? '').trim();
  if (!value) return null;
  return EMAIL_ONLY.test(value) ? null : { emailAddress: true };
};