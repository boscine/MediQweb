import { DestroyRef, Injectable, inject, signal } from '@angular/core';

/**
 * How a notification reads, and therefore how it is painted and announced.
 *
 * Four tones, no more. `error` is the only one that interrupts — it is the only
 * one where the user is waiting on an outcome they did not get — and everything
 * else waits its turn rather than talking over itself.
 */
export type ToastTone = 'success' | 'error' | 'warning' | 'info';

/** One notification on screen. */
export interface Toast {
  readonly id: number;
  readonly tone: ToastTone;
  /** Short and bold, e.g. "Account created". */
  readonly title: string;
  /** The sentence underneath. Optional, because a title alone is often enough. */
  readonly message: string | null;
}

/**
 * How long each tone stays up, in milliseconds.
 *
 * An error outlasts a success because it carries more to read and more to decide
 * about — a wrong password, a refusal from the store — and the user is the only
 * one who can clear it. A success is a receipt for something already done.
 *
 * Every one of these is also pausable: hovering or focusing a toast stops its
 * timer, which is what WCAG 2.2.1 asks for when content disappears on a timer.
 */
const DURATION_MS: Record<ToastTone, number> = {
  success: 4000,
  info: 5000,
  warning: 7000,
  error: 9000,
};

/**
 * How many may be on screen at once.
 *
 * A cap rather than unlimited stacking: toasts are for things that just happened,
 * and a column of them down the middle of the window is its own way of hiding the
 * page. Past the cap the oldest goes, which is the one already the closest to
 * having finished being read.
 */
const MAX_VISIBLE = 4;

/** Live bookkeeping for one toast's dismissal timer. */
interface ToastTimer {
  handle: ReturnType<typeof setTimeout>;
  /** Time left when the timer is paused, so resuming does not restart the wait. */
  remaining: number;
  startedAt: number;
  paused: boolean;
}

/**
 * App-wide notifications.
 *
 * One root-provided instance, because a notification outlives the page that
 * raised it: booking an appointment and then being navigated away from must not
 * silently drop the confirmation. The area sessions are scoped to their branch on
 * purpose and this is the deliberate opposite.
 *
 * Callers pass the real outcome of what they did:
 *
 * ```ts
 * if (!this.session.confirm(id)) {
 *   this.toasts.error('Not confirmed', 'That appointment is already cancelled.');
 *   return;
 * }
 * this.toasts.success('Appointment confirmed', `${name} is expected.`);
 * ```
 *
 * Never the other way round. A success toast that fires when the operation failed
 * is worse than no toast at all, because it is a false statement about a record
 * somebody will rely on.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly destroyRef = inject(DestroyRef);

  private nextId = 0;
  private readonly state = signal<Toast[]>([]);
  private readonly timers = new Map<number, ToastTimer>();

  /** The notifications on screen, newest first. */
  readonly toasts = this.state.asReadonly();

  constructor() {
    // A pending timer outliving the injector would fire into a torn-down service
    // and, with a fake clock in a test, keep the runner alive.
    this.destroyRef.onDestroy(() => {
      for (const timer of this.timers.values()) clearTimeout(timer.handle);
      this.timers.clear();
    });
  }

  /**
   * Puts a notification on screen and returns its id.
   *
   * A repeat of a tone and title already on screen is *not* stacked: it restarts
   * that toast's timer and returns its existing id. Two identical toasts are the
   * signature of a handler firing twice — a double-clicked submit, a re-entrant
   * save — and showing the user the same sentence twice tells them nothing that
   * the first one did not, while pushing the message they did not read off the
   * bottom.
   */
  show(tone: ToastTone, title: string, message?: string | null): number {
    const text = title.trim();
    const existing = this.state().find((toast) => toast.tone === tone && toast.title === text);

    if (existing) {
      // Refreshed rather than re-announced, so a repeated action does not make a
      // screen reader say the same thing again.
      this.startTimer(existing.id);
      return existing.id;
    }

    const toast: Toast = {
      id: ++this.nextId,
      tone,
      title: text,
      message: message?.trim() || null,
    };

    this.state.update((toasts) => [toast, ...toasts].slice(0, MAX_VISIBLE));
    this.startTimer(toast.id);
    return toast.id;
  }

  /** Something the user asked for was done, and really was. */
  success(title: string, message?: string | null): number {
    return this.show('success', title, message);
  }

  /** Something the user asked for did not happen. */
  error(title: string, message?: string | null): number {
    return this.show('error', title, message);
  }

  /** It happened, or will, but there is something to attend to. */
  warning(title: string, message?: string | null): number {
    return this.show('warning', title, message);
  }

  /** Neutral progress or guidance. No good or bad news attached. */
  info(title: string, message?: string | null): number {
    return this.show('info', title, message);
  }

  /**
   * Takes one notification off screen.
   *
   * Called by the close button and by the timer alike, so it has to clear the
   * timer too — otherwise dismissing by hand leaves it armed to remove a *future*
   * toast that happens to reuse the id, which cannot happen today but is a trap
   * worth not leaving in.
   */
  dismiss(id: number): void {
    this.clearTimer(id);
    this.state.update((toasts) => toasts.filter((toast) => toast.id !== id));
  }

  /** Takes everything off screen. For tests, and for a page that is being replaced. */
  dismissAll(): void {
    for (const id of this.timers.keys()) clearTimeout(this.timers.get(id)!.handle);
    this.timers.clear();
    this.state.set([]);
  }

  /**
   * Stops a toast's clock, keeping the time it had left.
   *
   * Called when the pointer or keyboard focus reaches a toast. Without this, a
   * reader who has tabbed to the close button loses the toast underneath them,
   * because they have not finished reading it.
   */
  pause(id: number): void {
    const timer = this.timers.get(id);
    if (!timer || timer.paused) return;

    clearTimeout(timer.handle);
    timer.remaining = Math.max(0, timer.remaining - (Date.now() - timer.startedAt));
    timer.paused = true;
  }

  /** Starts a paused toast's clock again, with what was left of it. */
  resume(id: number): void {
    const timer = this.timers.get(id);
    if (!timer || !timer.paused) return;

    timer.paused = false;
    timer.startedAt = Date.now();
    timer.handle = setTimeout(() => this.dismiss(id), timer.remaining);
  }

  private startTimer(id: number): void {
    this.clearTimer(id);

    const duration = DURATION_MS[this.state().find((toast) => toast.id === id)!.tone];
    this.timers.set(id, {
      handle: setTimeout(() => this.dismiss(id), duration),
      remaining: duration,
      startedAt: Date.now(),
      paused: false,
    });
  }

  private clearTimer(id: number): void {
    const timer = this.timers.get(id);
    if (timer) clearTimeout(timer.handle);
    this.timers.delete(id);
  }
}
