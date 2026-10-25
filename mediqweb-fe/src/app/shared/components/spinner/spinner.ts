import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Named sizes resolve to a pixel diameter; any other value is used verbatim. */
const SPINNER_SIZES: Record<string, string> = {
  xs: '12px',
  sm: '16px',
  md: '20px',
  lg: '24px',
  xl: '32px',
};

/**
 * Indeterminate loading indicator.
 *
 * Purely decorative by default — it exposes `aria-hidden` so a wrapping control
 * (e.g. `ui-button`) can own the announcement. Set `announce` to `true` when
 * used on its own so screen readers hear the label.
 */
@Component({
  selector: 'ui-spinner',
  templateUrl: './spinner.html',
  styleUrl: './spinner.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.ui-spinner--overlay]': 'overlay()',
  },
})
export class Spinner {
  /** Named size (`xs`…`xl`) or any CSS length such as `40px`. */
  readonly size = input<string>('md');
  /** Text announced to assistive technology. */
  readonly label = input('Loading');
  /** Expose `role="status"` + a visually hidden label. */
  readonly announce = input(true);
  /** Stretch into a full-bleed blocking overlay. */
  readonly overlay = input(false);

  protected readonly diameter = computed(() => SPINNER_SIZES[this.size()] ?? this.size());
  protected readonly stroke = computed(() => `max(2px, ${this.diameter()} * 0.12)`);
}
