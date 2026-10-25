import { ChangeDetectionStrategy, Component, computed, inject, input, isDevMode } from '@angular/core';
import { PasswordManagementService } from '../../../core/services/password-management.service';

// ============================================================================
// DEV-ONLY HELPER — safe to delete at any time
// ============================================================================
// Shows the current one-time code on screen so the reset and change-password
// flows can be walked without opening the console.
//
// WHY IT EXISTS: the codes are deliberately random per request, so there is no
// fixed value to type. Reading one out of the browser console works but is
// tedious, and hardcoding a code would be the bypass this feature is built to
// avoid.
//
// WHY IT IS SAFE: `isDevMode()` is `false` in a production build, so `devPanel`
// is `false` and the `@if` branch is never entered — no code is ever shown to a
// user. Stated precisely, because it is worth not overclaiming: the component's
// template and styles ARE still emitted into the production chunks (measured at
// about 30 bytes across two lazy chunks), because it is still listed in the
// parent's `imports`. Only its *output* is suppressed. If a future build needs
// it gone at the byte level too, add a `fileReplacements` entry in angular.json
// swapping this file for an empty stub — that is the only thing Angular will not
// optimise away for us.
//
// HOW TO REMOVE IT — four steps, no other file depends on it:
//   1. Delete this file.
//   2. Delete the `<dev-otp-hint>` block from each of the two flow templates
//      (they are marked DEV-ONLY, and are in `change-password.html` and
//      `forgot-password.html`).
//   3. Delete the `devPanel` field from each of the two flow components
//      (also marked DEV-ONLY).
//   4. Delete the `DevOtpHint` import and its entry in each component's
//      `imports` array.
// This component is deliberately NOT exported from the shared barrel, so
// removing it cannot leave a dangling export behind.
// ============================================================================

@Component({
  selector: 'dev-otp-hint',
  template: `
    @if (code(); as value) {
      <p class="dev-otp" role="note">
        <strong>Development only.</strong>
        Verification code: <code>{{ value }}</code>
        <span class="dev-otp__note">shown because this is not a production build</span>
      </p>
    }
  `,
  styles: [
    `
      .dev-otp {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: var(--space-2);
        margin: var(--space-3) 0 0;
        padding: var(--space-2) var(--space-3);
        border: var(--border-width) dashed var(--color-warning);
        border-radius: var(--radius-sm);
        background: var(--color-surface-light);
        font-size: var(--font-size-small);
        line-height: var(--line-height-small);
        color: var(--color-text-secondary);
      }

      /* Monospaced and tracked out so a six-digit code cannot be misread as a
         word or as two groups of three. */
      .dev-otp code {
        font-family: var(--font-family-mono);
        font-size: var(--font-size-body);
        letter-spacing: 0.15em;
        color: var(--color-text-primary);
      }

      .dev-otp__note {
        color: var(--color-text-muted);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DevOtpHint {
  /** The challenge whose code should be shown, from the surrounding flow. */
  // Accepts `undefined` because that is what `challenge()?.challengeId` yields
  // on a step where no challenge has been issued yet.
  readonly challengeId = input<string | null | undefined>(null);

  private readonly service = inject(PasswordManagementService);

  /**
   * The code, or `null` outside a development build.
   *
   * Called in TypeScript rather than in the template so the production build has
   * something to fold: `isDevMode()` becomes `false`, the expression becomes
   * `null`, and nothing is rendered. See the note at the top of this file about
   * what that does and does not remove from the bundle.
   */
  protected readonly code = computed(() =>
    isDevMode() ? this.service.peekIssuedCode(this.challengeId() ?? '') : null,
  );
}