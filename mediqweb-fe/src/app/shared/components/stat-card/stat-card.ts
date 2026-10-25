import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Card } from '../card/card';

export type StatTone = 'primary' | 'success' | 'warning' | 'danger' | 'info';
export type StatTrend = 'up' | 'down' | 'flat';

const TREND_GLYPH: Record<StatTrend, string> = {
  up: '↑',
  down: '↓',
  flat: '→',
};

/**
 * Single headline metric for dashboard summaries.
 *
 * Composes `ui-card` rather than restating the surface treatment, and resolves
 * its accent from `--color-<tone>` so no colour is hardcoded. The trend
 * direction is exposed as text as well as an arrow glyph so it is not
 * conveyed by shape alone.
 *
 * Two optional projection slots, since anything else is silently discarded:
 * ```html
 * <ui-stat-card label="Doctors" [value]="24">
 *   <svg statIcon>…</svg>
 *   <a statFooter routerLink="/admin/accounts/doctors">Manage doctors</a>
 * </ui-stat-card>
 * ```
 */
@Component({
  selector: 'ui-stat-card',
  imports: [Card],
  templateUrl: './stat-card.html',
  styleUrl: './stat-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.--stat-tone]': 'toneToken()',
  },
})
export class StatCard {
  readonly label = input.required<string>();
  readonly value = input<string | number>('');
  /** Supporting text under the value. */
  readonly hint = input<string | null>(null);
  readonly tone = input<StatTone>('primary');
  readonly trend = input<StatTrend | null>(null);
  /** e.g. "12% vs last week". Read alongside `trend`. */
  readonly trendLabel = input<string | null>(null);
  /** Show the trend arrow in the accent colour rather than neutral. */
  readonly highlightTrend = input(false);

  protected readonly toneToken = computed(() => `var(--color-${this.tone()})`);
  protected readonly trendGlyph = computed(() => {
    const t = this.trend();
    return t ? TREND_GLYPH[t] : '';
  });
  protected readonly trendText = computed(() => {
    const t = this.trend();
    if (!t) return '';
    return { up: 'increase', down: 'decrease', flat: 'no change' }[t];
  });
}
