import { InjectionToken } from '@angular/core';

/**
 * The clock the password service reads.
 *
 * Injected rather than calling `Date.now()` inline so the expiry and resend
 * cooldown rules can be tested by moving this forward, instead of the suite
 * waiting out a real five minutes or a real thirty seconds. Tests bind a counter
 * they advance themselves; production binds `Date.now`.
 */
export const CLOCK = new InjectionToken<() => number>('MediQ clock', {
  providedIn: 'root',
  factory: () => () => Date.now(),
});
