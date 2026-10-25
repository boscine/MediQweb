import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AvatarStatus = 'none' | 'online' | 'busy' | 'away';

const STATUS_TOKEN: Record<AvatarStatus, string | null> = {
  none: null,
  online: 'var(--color-success)',
  busy: 'var(--color-danger)',
  away: 'var(--color-warning)',
};

/** Up to two uppercase initials derived from a display name. */
function toInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return (parts[0].charAt(0) || '?').toUpperCase();
  return ((parts[0].charAt(0) || '') + (parts[parts.length - 1].charAt(0) || '')).toUpperCase();
}

/**
 * User representation with an initials fallback.
 *
 * Emits `imageError` when the supplied `src` fails so callers can clear a
 * stale URL; internally it falls back to initials either way.
 */
@Component({
  selector: 'ui-avatar',
  templateUrl: './avatar.html',
  styleUrl: './avatar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.--avatar-status-color]': 'statusToken()',
  },
})
export class Avatar {
  readonly name = input('');
  readonly src = input<string | null>(null);
  readonly size = input<AvatarSize>('md');
  readonly status = input<AvatarStatus>('none');
  /** Overrides the derived initials. */
  readonly initials = input<string | null>(null);
  readonly imageError = output<string>();

  protected readonly broken = signal(false);
  protected readonly initialsText = computed(() => this.initials() ?? toInitials(this.name()));
  protected readonly showImage = computed(() => !!this.src() && !this.broken());
  protected readonly statusToken = computed(() => STATUS_TOKEN[this.status()]);

  protected onError(): void {
    this.broken.set(true);
    if (this.src()) this.imageError.emit(this.src()!);
  }
}
