import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast.service';

/**
 * Test helpers for reading the notification stack.
 *
 * Every action in the app reports through `ToastService` rather than through a
 * message held by the page, so a test asserting on feedback asks this service
 * what it currently holds instead of reading the DOM. That is the point of the
 * change: feedback is no longer something a page renders and therefore no longer
 * something a page can be tested for without rendering it.
 */

/** The toast service for the current test's injector. */
export function toasts(): ToastService {
  return TestBed.inject(ToastService);
}

/** A toast as a test wants to read it: the parts worth asserting on, flattened. */
export interface ReadToast {
  readonly id: number;
  readonly title: string;
  readonly message: string | null;
  readonly tone: string;
}

/**
 * The newest toast, or `null` when none has been raised.
 *
 * Newest first is the service's own order, so this is the one a user would say
 * they saw last. `id` is carried through because a test that dismisses has to
 * dismiss *this* toast rather than whichever one happens to be on the stack.
 */
export function latestToast(): ReadToast | null {
  const toast = toasts().toasts()[0];
  return toast ? { ...toast } : null;
}

/**
 * Every toast currently on screen, oldest first.
 *
 * For asserting that a repeated action did *not* stack duplicates — the count is
 * the whole point, so `[0]` would answer it wrongly.
 */
export function allToasts(): { title: string; tone: string }[] {
  return [...toasts().toasts()].reverse().map(({ title, tone }) => ({ title, tone }));
}

/**
 * Clears the stack and disarms its timers.
 *
 * Not optional hygiene: every toast arms a `setTimeout`, and a timer still
 * pending when the test ends is a timer the runner has to wait for or a failure
 * reported against whichever test happens to be running.
 */
export function clearToasts(): void {
  toasts().dismissAll();
}
