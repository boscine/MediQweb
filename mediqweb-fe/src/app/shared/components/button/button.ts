import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Spinner } from '../spinner/spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Primary action control.
 *
 * Inherits the global `button` baseline (radius, control height, typography)
 * and layers only variant/size styles on top, so it cannot drift from form
 * controls elsewhere in the app.
 *
 * Icon slots use `uiButtonIconStart` / `uiButtonIconEnd`:
 * ```html
 * <ui-button variant="primary">
 *   <svg uiButtonIconStart …></svg>
 *   Save
 * </ui-button>
 * ```
 *
 * A `type="submit"` button that has to sit outside its `<form>` — in a dialog
 * footer, for instance — must be given the form's id explicitly:
 * ```html
 * <ui-button type="submit" formId="add-doctor-form">Create</ui-button>
 * ```
 */
@Component({
  selector: 'ui-button',
  imports: [Spinner],
  templateUrl: './button.html',
  styleUrl: './button.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.ui-button-host--block]': 'fullWidth()',
  },
})
export class Button {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('md');
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly disabled = input(false);
  /** Shows a spinner and blocks interaction. */
  readonly loading = input(false);
  readonly fullWidth = input(false);
  /** Square button for a single icon; the label becomes screen-reader only. */
  readonly iconOnly = input(false);
  /** Accessible name — required when `iconOnly` is used. */
  readonly ariaLabel = input<string | null>(null);
  /**
   * `id` of the form a `type="submit"` button belongs to.
   *
   * Set via an input rather than a bare `form="…"` attribute: an attribute on
   * `<ui-button>` lands on the host element, not the inner `<button>`, so the
   * browser never associates the two and pressing the button silently does
   * nothing.
   */
  readonly formId = input<string | null>(null);

  readonly pressed = output<MouseEvent>();

  protected onClick(event: MouseEvent): void {
    this.pressed.emit(event);
  }
}
