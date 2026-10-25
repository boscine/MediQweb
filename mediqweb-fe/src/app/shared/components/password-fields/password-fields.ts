import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { ReactiveFormsModule, type FormControl } from '@angular/forms';
import { FormField } from '../form-field/form-field';
import { PASSWORD_REQUIREMENTS, unmetPasswordRequirements } from '../../validation/password.policy';

/**
 * New password and confirmation, with the show/hide controls and the policy
 * feedback.
 *
 * Both password flows need the same two fields, the same reveal buttons and the
 * same three requirement lines. Written once here so the rules shown are the
 * rules enforced — a copy in each flow would eventually disagree, and the copy
 * that shows fewer requirements than it enforces is the one that loses a user.
 *
 * Bound to the enclosing form: the flow owns the controls, their values and the
 * submit button's disabled state, and this renders them. Errors arrive as inputs
 * rather than being recomputed here, so there is exactly one place that decides
 * what a failure is called.
 */
@Component({
  selector: 'ui-password-fields',
  imports: [ReactiveFormsModule, FormField],
  templateUrl: './password-fields.html',
  styleUrl: './password-fields.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PasswordFields {
  /**
   * The two controls, passed as instances rather than by name.
   *
   * These inputs are declared in *this* component's template, so a
   * `formControlName` here would look for a `formGroup` in this view and not
   * find the one the flow put around its own form — the parent and child are
   * separate views, and a directive does not cross that boundary. Binding
   * `[formControl]` to the instance works from anywhere and still leaves the
   * controls owned by the flow's form, which is what the submit button's
   * disabled state reads.
   */
  readonly newPassword = input.required<FormControl<string>>();
  readonly confirmPassword = input.required<FormControl<string>>();
  /** Unique per rendered instance; both flows pass their own. */
  readonly idPrefix = input.required<string>();
  /** Message for the new-password field, or null. */
  readonly newError = input<string | null>(null);
  /** Message for the confirmation field, or null. */
  readonly confirmError = input<string | null>(null);

  protected readonly requirements = PASSWORD_REQUIREMENTS;
  protected readonly newVisible = signal(false);
  protected readonly confirmVisible = signal(false);

  /** The rule list doubles as the field hint until there is an error to show. */
  protected readonly requirementsHint = computed(
    () => this.requirements.join(' · ') + '.',
  );

  protected isMet(index: number): boolean {
    return !unmetPasswordRequirements(this.newPassword().value ?? '').includes(
      this.requirements[index],
    );
  }

  protected toggle(which: 'new' | 'confirm'): void {
    if (which === 'new') this.newVisible.update((v) => !v);
    else this.confirmVisible.update((v) => !v);
  }
}
