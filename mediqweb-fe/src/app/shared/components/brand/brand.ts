import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * MediQ brand mark: tile glyph plus wordmark.
 *
 * Lives in the shared library because the staff layout, the role dashboards
 * and this login page all need it. Purely decorative — the surrounding link
 * or heading carries the accessible name, so the mark is `aria-hidden`.
 */
@Component({
  selector: 'ui-brand',
  templateUrl: './brand.html',
  styleUrl: './brand.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Brand {
  /** Icon only; for tight headers where the wordmark is redundant. */
  readonly compact = input(false);
}
