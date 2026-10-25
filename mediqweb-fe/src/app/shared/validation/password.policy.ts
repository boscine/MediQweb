import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * The one password policy both password flows apply.
 *
 * Twelve characters with at least one letter and one number. Deliberately not
 * more: rules about symbols, casing and character classes push people towards
 * `Password1!` and a written-down note, which is a weaker password than a long
 * passphrase, and every extra rule is one more thing the two flows could
 * disagree about. Length is what actually resists guessing.
 *
 * Exported as data rather than baked into a validator so the requirement text in
 * the UI and the rule the form enforces cannot drift apart — the same reason
 * the design system keeps its values in one place.
 */
export const PASSWORD_MIN_LENGTH = 12;

/** The control names both flows use, so the validators below need no arguments. */
export const NEW_PASSWORD = 'newPassword';
export const CONFIRM_PASSWORD = 'confirmPassword';

/** Each rule as the sentence shown under the field. */
export const PASSWORD_REQUIREMENTS: readonly string[] = [
  `At least ${PASSWORD_MIN_LENGTH} characters`,
  'At least one letter',
  'At least one number',
];

/** Which of `PASSWORD_REQUIREMENTS` this value fails. Empty when it passes. */
export function unmetPasswordRequirements(value: string): string[] {
  const unmet: string[] = [];
  if (value.length < PASSWORD_MIN_LENGTH) unmet.push(PASSWORD_REQUIREMENTS[0]);
  // Unicode property escapes, not `[a-zA-Z]`: the rule says "a letter", and a
  // passphrase built from a Filipino or accented word should not be told it has
  // no letters in it.
  if (!/\p{L}/u.test(value)) unmet.push(PASSWORD_REQUIREMENTS[1]);
  if (!/\p{Nd}/u.test(value)) unmet.push(PASSWORD_REQUIREMENTS[2]);
  return unmet;
}

/**
 * Validator for the new-password field.
 *
 * Attached to the control itself rather than written into the service, so the
 * submit button's disabled state comes from the same place the error message
 * does and the two cannot disagree.
 */
export const passwordPolicy: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = typeof control.value === 'string' ? control.value : '';
  // An empty field is "required", not "too short". Reporting both puts two
  // errors on a field the user has not filled in yet.
  if (!value) return null;
  return unmetPasswordRequirements(value).length > 0 ? { passwordPolicy: true } : null;
};

/**
 * Validator that the two password fields agree, run on the form.
 *
 * Group level on purpose. `AbstractControl` carries no name of its own, so a
 * control validator cannot find the field it is meant to match against; given the
 * group it can, and both flows use `NEW_PASSWORD` / `CONFIRM_PASSWORD` so no
 * caller has to pass the names.
 *
 * Returns null while both are empty — that is `required` reporting, not a
 * mismatch — so a fresh form does not open with an error on a field nobody has
 * touched.
 */
export const passwordsMatch: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const group = control as AbstractControl;
  const password = group.get(NEW_PASSWORD)?.value;
  const confirm = group.get(CONFIRM_PASSWORD)?.value;
  if (typeof password !== 'string' || typeof confirm !== 'string') return null;
  if (!password && !confirm) return null;
  return password === confirm ? null : { passwordsMismatch: true };
};
