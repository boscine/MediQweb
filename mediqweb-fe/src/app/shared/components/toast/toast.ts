import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService, type Toast, type ToastTone } from '../../../core/services/toast.service';

/**
 * The notifications on screen.
 *
 * Mounted once at the root rather than inside the layout or a page, because a
 * confirmation that disappears when you navigate away from the page that produced
 * it is worse than no confirmation at all.
 *
 * The stack is newest-first. For a column anchored to the top of the window that
 * keeps the newest message in the one place the eye already is, rather than
 * pushing it down the list each time something else arrives.
 */
@Component({
  selector: 'ui-toasts',
  templateUrl: './toast.html',
  styleUrl: './toast.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Toasts {
  private readonly toastService = inject(ToastService);

  protected readonly toasts = this.toastService.toasts;

  /**
   * Live-region role per tone.
   *
   * `alert` is reserved for `error` because it interrupts: it is the one outcome
   * the user is waiting on and did not get. Everything else is `status`, which
   * waits for a pause in speech rather than cutting across whatever is being
   * read out.
   */
  protected role(toast: Toast): 'status' | 'alert' {
    return toast.tone === 'error' ? 'alert' : 'status';
  }

  /** The glyph beside each toast, matched to the tone's shape as well as colour. */
  protected iconPath(tone: ToastTone): string {
    return ICON_PATHS[tone];
  }

  protected dismiss(id: number): void {
    this.toastService.dismiss(id);
  }

  protected pause(id: number): void {
    this.toastService.pause(id);
  }

  protected resume(id: number): void {
    this.toastService.resume(id);
  }
}

/**
 * 24x24 stroked paths, as `staff-nav` keeps its own.
 *
 * A distinct *shape* per tone rather than a coloured dot: a check, a cross, a
 * warning triangle and an information circle stay apart when the colour does not
 * — in forced-colours mode, on a monochrome display, or to someone who cannot
 * separate the greens and reds.
 */
const ICON_PATHS: Record<ToastTone, string> = {
  success: 'M20 6L9 17l-5-5',
  error: 'M18 6L6 18M6 6l12 12',
  warning:
    'M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01',
  info: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0zM12 16v-4M12 8h.01',
};
