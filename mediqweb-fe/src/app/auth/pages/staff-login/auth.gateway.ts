import { InjectionToken } from '@angular/core';

/** What the sign-in form collects. Deliberately minimal — no role field. */
export interface StaffCredentials {
  readonly identifier: string;
  readonly password: string;
}

/** The workspaces a staff account can land in. */
export type StaffRole = 'admin' | 'doctor' | 'secretary';

/**
 * The seam between the login UI and real authentication.
 *
 * The UI is built against this contract only, so wiring the HTTP call in a
 * later branch is a provider swap rather than a rewrite of the page. Nothing
 * in this contract may decide *where* a user lands after signing in — that is
 * the caller's job. What it returns is the role, and routing on it is the
 * page's decision, so the same gateway can be reused if a second entry point
 * ever needs different routing.
 */
export interface AuthGateway {
  /**
   * Resolves with the role the credentials belong to, or rejects.
   *
   * The rejection message is shown to the user verbatim, so implementations
   * must keep it safe to display: never leak whether the account exists or
   * whether the password was merely wrong.
   */
  signIn(credentials: StaffCredentials): Promise<StaffRole>;
}

export const AUTH_GATEWAY = new InjectionToken<AuthGateway>('MediQ auth gateway');
