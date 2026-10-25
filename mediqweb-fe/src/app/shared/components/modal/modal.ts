import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';

let nextId = 0;

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';
export type ModalPlacement = 'center' | 'left' | 'right';

/**
 * Modal dialog built on the native `<dialog>` element.
 *
 * Using `showModal()` gets a real focus trap, inert background content,
 * top-layer stacking and Escape-to-dismiss from the platform — none of which
 * are reimplemented here, and no extra dependency is required. This matters
 * for a clinical app where correct keyboard behaviour is a requirement, not a
 * nicety.
 *
 * The `open` input stays authoritative: the component never flips it itself,
 * it only requests dismissal through `closed`.
 */
@Component({
  selector: 'ui-modal',
  templateUrl: './modal.html',
  styleUrl: './modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Modal {
  readonly open = input(false);
  readonly title = input<string | null>(null);
  /**
   * One line under the title explaining what the dialog is for or what will
   * happen. Kept separate from the projected body so it stays put when the body
   * scrolls, and so it can be wired to `aria-describedby` for context.
   */
  readonly description = input<string | null>(null);
  readonly size = input<ModalSize>('md');
  /**
   * `left`/`right` render an edge-anchored drawer instead of a centred dialog.
   * The drawer reuses this element so it inherits the platform focus trap,
   * inert background and Escape handling rather than reimplementing them.
   */
  readonly placement = input<ModalPlacement>('center');
  /** Clicking the backdrop dismisses the dialog. */
  readonly closeOnBackdrop = input(true);
  /** Escape dismisses the dialog. */
  readonly closeOnEscape = input(true);
  /** Hides the header close button for dialogs that require an explicit choice. */
  readonly showClose = input(true);
  readonly closed = output<void>();

  private readonly dialogRef = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    // Signal queries are reactive, so this re-runs once the view exists.
    effect(() => {
      const dialog = this.dialogRef()?.nativeElement;
      if (!dialog) return;
      if (this.open() && !dialog.open) {
        this.openDialog(dialog);
      } else if (!this.open() && dialog.open) {
        this.closeDialog(dialog);
      }
    });
  }

  /**
   * `showModal()` is absent in some non-browser DOM implementations (jsdom,
   * older engines), so fall back to the reflected attribute rather than
   * throwing and taking the whole view down with it.
   */
  private openDialog(dialog: HTMLDialogElement): void {
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  private closeDialog(dialog: HTMLDialogElement): void {
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }

  /** Public dismissal API for the header button and Escape handling. */
  close(): void {
    this.closed.emit();
  }

  /** Id for the description, so the dialog can point `aria-describedby` at it. */
  protected readonly descriptionId = `ui-modal-description-${++nextId}`;

  /**
   * Whether the current press began on the backdrop rather than on the panel.
   *
   * `null` means no press has been seen, which is the case for a programmatic
   * click with no pointer involved.
   */
  private pressStartedOnBackdrop: boolean | null = null;

  protected onPointerDown(event: Event): void {
    this.pressStartedOnBackdrop = event.target === this.dialogRef()?.nativeElement;
  }

  protected onBackdropClick(event: MouseEvent): void {
    const dialog = this.dialogRef()?.nativeElement;
    // Clicks on the panel bubble here too; only the <dialog> itself is backdrop.
    if (event.target !== dialog) return;

    // The click's own target is not enough to go on. A drag that *starts* inside
    // the panel — selecting a password, dragging out of the field — and is
    // *released* over the backdrop produces a click whose target is the nearest
    // common ancestor of the press and the release, which is the <dialog>. That
    // made selecting text close the dialog mid-gesture. Requiring the press to
    // have started on the backdrop too is what separates the two: a real
    // backdrop click begins and ends there, and a selection begins on content.
    const beganOnPanel = this.pressStartedOnBackdrop === false;
    this.pressStartedOnBackdrop = null;
    if (beganOnPanel) return;

    if (this.closeOnBackdrop()) this.close();
  }

  protected onCancel(event: Event): void {
    if (!this.closeOnEscape()) {
      event.preventDefault();
      return;
    }
    // Let the native close run, then notify the owner.
    this.closed.emit();
  }
}
