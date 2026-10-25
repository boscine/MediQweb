/**
 * Where a changed password is remembered for the session.
 *
 * Module-scoped rather than injected, because two unrelated injectables need the
 * same table and `MockAuthGateway` is constructed bare in its own spec — wiring
 * one to the other through DI would make the gateway untestable without a
 * `TestBed`. A `Map` on the module is the honest shape for "state that lives
 * until the tab closes": there is no instance to scope it to.
 *
 * **In memory only.** Nothing here reaches `localStorage`, `sessionStorage`,
 * cookies, fixtures or the console, so a reload loses every change — which is
 * the point of a prototype, and the reason the UI tells the user so.
 *
 * A real implementation deletes this file and has the gateway ask a server.
 */
const overrides = new Map<string, string>();

/** The password an account should be accepted with right now. */
export function storedPassword(accountId: string, fallback: string): string {
  return overrides.get(accountId) ?? fallback;
}

/** Records a new password for an account, replacing any earlier one. */
export function storePassword(accountId: string, password: string): void {
  overrides.set(accountId, password);
}

/** Whether this account's password has been changed at all. */
export function hasStoredPassword(accountId: string): boolean {
  return overrides.has(accountId);
}

/**
 * Empties the table.
 *
 * **Test use only.** Because the store is module-scoped it outlives every
 * `TestBed.resetTestingModule()`, so a spec that changes a password would leave
 * that password behind for the next test in the same file — which is exactly how
 * a "this test asserts the password is unchanged" assertion can silently pass
 * against someone else's write. Nothing in the application calls this; a reload
 * is the only thing that clears the store in a browser.
 */
export function resetStoredPasswords(): void {
  overrides.clear();
}