import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type FormFieldState = 'default' | 'success' | 'error';

/**
 * Accessible label + control + hint/error wrapper.
 *
 * The control is projected rather than wrapped, so a single component covers
 * `<input>`, `<select>`, `<textarea>` and custom controls without duplicating
 * the global form baseline. Pass a matching `id` on the control:
 *
 * ```html
 * <ui-form-field label="Username" controlId="username" [error]="error()">
 *   <input id="username" type="text" formControlName="username" />
 * </ui-form-field>
 * ```
 *
 * Validation colours reach the projected control through the
 * `--field-border-color` / `--field-focus-*` custom properties declared in
 * `styles.scss`. CSS custom properties cross Angular's style encapsulation, so
 * this works without `::ng-deep` and without restyling the input here.
 */
@Component({
  selector: 'ui-form-field',
  templateUrl: './form-field.html',
  styleUrl: './form-field.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.ui-form-field--error]': 'hasError()',
    '[class.ui-form-field--success]': 'isSuccess()',
    '[class.ui-form-field--disabled]': 'disabled()',
    '[style.--field-border-color]': 'borderColor()',
    '[style.--field-focus-border-color]': 'borderColor()',
    '[style.--field-focus-ring]': 'focusRing()',
  },
})
export class FormField {
  readonly label = input.required<string>();
  /** Must match the `id` of the projected control. */
  readonly controlId = input.required<string>();
  readonly hint = input<string | null>(null);
  /** When set, the field switches to the error state automatically. */
  readonly error = input<string | null>(null);
  readonly successMessage = input<string | null>(null);
  readonly required = input(false);
  readonly disabled = input(false);
  /** Force a state instead of deriving it from `error`/`successMessage`. */
  readonly state = input<FormFieldState>('default');

  readonly hasError = computed(() => !!this.error() || this.state() === 'error');

  /**
   * Public so a caller can point its control at the rendered help text:
   * `<input [attr.aria-describedby]="field.helpId()" [attr.aria-invalid]="field.hasError()" />`
   */
  readonly helpId = computed(() => `${this.controlId()}-help`);

  protected readonly isSuccess = computed(
    () => !this.hasError() && (!!this.successMessage() || this.state() === 'success'),
  );
  protected readonly helpText = computed(
    () => this.error() ?? this.successMessage() ?? this.hint(),
  );
  protected readonly hasHelp = computed(() => !!this.helpText());

  protected readonly borderColor = computed(() =>
    this.hasError() ? 'var(--color-danger)' : this.isSuccess() ? 'var(--color-success)' : null,
  );

  protected readonly focusRing = computed(() =>
    this.hasError()
      ? 'color-mix(in srgb, var(--color-danger) 18%, transparent)'
      : this.isSuccess()
        ? 'color-mix(in srgb, var(--color-success) 18%, transparent)'
        : null,
  );
}
