import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
export type BadgeSize = 'sm' | 'md';

/**
 * Tone name -> design-token reference. Keeps colour out of the stylesheet.
 *
 * Exported so anything that needs to paint by tone — a bare severity dot, say —
 * resolves the same token the badge would, instead of keeping a second copy of
 * this table.
 */
export const BADGE_TONE_TOKEN: Record<BadgeTone, string> = {
  neutral: 'var(--color-text-secondary)',
  primary: 'var(--color-primary)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
  info: 'var(--color-info)',
};

/**
 * Compact status indicator.
 *
 * The label always uses `--color-text-primary` rather than the tone colour:
 * `--color-warning` (#F59E0B) on a pale tint fails WCAG AA for body text. The
 * tone is carried by the background tint, border and optional dot instead, so
 * every tone stays readable.
 */
@Component({
  selector: 'ui-status-badge',
  templateUrl: './status-badge.html',
  styleUrl: './status-badge.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.--badge-tone]': 'toneToken()',
  },
})
export class StatusBadge {
  readonly tone = input<BadgeTone>('neutral');
  readonly size = input<BadgeSize>('md');
  /** Render a leading dot in the tone colour. */
  readonly dot = input(false);
  /** Announced prefix, e.g. "Status: Confirmed". */
  readonly ariaLabel = input<string | null>(null);

  protected readonly toneToken = computed(() => BADGE_TONE_TOKEN[this.tone()]);
}
