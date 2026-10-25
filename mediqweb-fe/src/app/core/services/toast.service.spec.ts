import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let toasts: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    toasts = TestBed.inject(ToastService);
  });

  afterEach(() => toasts.dismissAll());

  function titles(): string[] {
    return [...toasts.toasts()].reverse().map((toast) => toast.title);
  }

  describe('raising a notification', () => {
    it('starts empty', () => {
      expect(toasts.toasts()).toEqual([]);
    });

    it('puts the title and message on the stack', () => {
      toasts.success('Account created', 'Rafael Santos was added as a doctor.');

      expect(toasts.toasts().length).toBe(1);
      expect(toasts.toasts()[0]).toMatchObject({
        tone: 'success',
        title: 'Account created',
        message: 'Rafael Santos was added as a doctor.',
      });
    });

    it('accepts a title with no message', () => {
      toasts.info('Nothing to do');
      expect(toasts.toasts()[0].message).toBeNull();
    });

    it('trims the title and the message', () => {
      // An untrimmed title shows as " Saved " in the notification and makes the
      // duplicate check below miss a toast that is really the same one.
      toasts.success('  Saved  ', '  Your hours were updated.  ');
      expect(toasts.toasts()[0]).toMatchObject({
        title: 'Saved',
        message: 'Your hours were updated.',
      });
    });

    it('treats a blank message as no message rather than an empty line', () => {
      toasts.success('Saved', '   ');
      expect(toasts.toasts()[0].message).toBeNull();
    });

    it('supports all four tones', () => {
      toasts.success('One');
      toasts.error('Two');
      toasts.warning('Three');
      toasts.info('Four');

      expect([...toasts.toasts()].reverse().map((toast) => toast.tone)).toEqual([
        'success',
        'error',
        'warning',
        'info',
      ]);
    });

    it('gives every notification its own id', () => {
      const first = toasts.success('First');
      const second = toasts.success('Second');
      expect(first).not.toBe(second);
    });

    it('puts the newest at the top of the stack', () => {
      // The stack is anchored to the top of the window, so the newest belongs in
      // the one place the eye already is rather than pushed down the column.
      toasts.success('First');
      toasts.success('Second');

      expect(titles()).toEqual(['First', 'Second']);
      expect(toasts.toasts()[0].title).toBe('Second');
    });

    it('returns the id, so a caller can dismiss what it just raised', () => {
      const id = toasts.warning('Careful');
      toasts.dismiss(id);
      expect(toasts.toasts()).toEqual([]);
    });
  });

  describe('repeats', () => {
    it('refreshes a repeat rather than stacking a second copy', () => {
      // Two identical notifications are the signature of a handler firing twice —
      // a double-clicked submit, a re-entrant save — and the second says nothing
      // the first did not while pushing a different message off the bottom.
      toasts.success('Profile updated', 'Held in this session only.');

      const id = toasts.success('Profile updated', 'Held in this session only.');

      expect(toasts.toasts().length).toBe(1);
      // The existing id, so dismissing either call dismisses the same toast.
      expect(id).toBe(toasts.toasts()[0].id);
    });

    it('does not merge the same title in a different tone', () => {
      // A success and a warning with one title are two different facts, and
      // collapsing them would hide whichever came second.
      toasts.success('Appointment updated');
      toasts.warning('Appointment updated');

      expect(toasts.toasts().length).toBe(2);
    });

    it('does not merge different titles in the same tone', () => {
      toasts.success('Profile updated');
      toasts.success('Hours updated');
      expect(toasts.toasts().length).toBe(2);
    });
  });

  describe('the stack', () => {
    it('keeps at most four on screen', () => {
      // A column of toasts down the middle of the window is its own way of hiding
      // the page, so the oldest goes once the cap is reached.
      for (let n = 1; n <= 6; n++) toasts.info(`Message ${n}`);

      expect(toasts.toasts().length).toBe(4);
      // The oldest two are the ones that have been on screen longest.
      expect(titles()).toEqual(['Message 3', 'Message 4', 'Message 5', 'Message 6']);
    });

    it('dismisses exactly the one asked for', () => {
      toasts.success('Keep me');
      const drop = toasts.error('Drop me');
      toasts.success('Also keep me');

      toasts.dismiss(drop);

      expect(titles()).toEqual(['Keep me', 'Also keep me']);
    });

    it('ignores an id that is not on the stack', () => {
      toasts.success('Still here');
      expect(() => toasts.dismiss(9999)).not.toThrow();
      expect(toasts.toasts().length).toBe(1);
    });

    it('clears everything at once', () => {
      toasts.success('One');
      toasts.error('Two');

      toasts.dismissAll();

      expect(toasts.toasts()).toEqual([]);
    });
  });

  describe('dismissal on a timer', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('takes a notification off the screen on its own', () => {
      toasts.success('Expires');
      expect(toasts.toasts().length).toBe(1);

      vi.advanceTimersByTime(4000);
      expect(toasts.toasts()).toEqual([]);
    });

    it('keeps an error longer than a success', () => {
      // More to read and more to decide about, and the user is the only one who
      // can clear it.
      toasts.success('Short');
      toasts.error('Long');

      vi.advanceTimersByTime(4000);
      expect(titles()).toEqual(['Long']);
    });

    it('expires each on its own schedule, not all at the first deadline', () => {
      toasts.success('First');
      vi.advanceTimersByTime(2000);
      toasts.success('Second');

      vi.advanceTimersByTime(2000);
      // The first is now 4s old and gone; the second is only 2s old.
      expect(titles()).toEqual(['Second']);
    });

    it('stops counting while paused, and resumes with what was left', () => {
      // WCAG 2.2.1: content that disappears on a timer has to be pausable, or a
      // reader who has tabbed to the close button loses the text under them.
      toasts.success('Paused');
      const id = toasts.toasts()[0].id;

      vi.advanceTimersByTime(3000);
      toasts.pause(id);
      expect(titles()).toEqual(['Paused']);

      // Ten seconds pass with the pointer resting on it.
      vi.advanceTimersByTime(10_000);
      expect(titles()).toEqual(['Paused']);

      toasts.resume(id);
      // Only the remaining second, not a fresh four.
      vi.advanceTimersByTime(1000);
      expect(titles()).toEqual([]);
    });

    it('does nothing when pausing or resuming an unknown id', () => {
      expect(() => toasts.pause(9999)).not.toThrow();
      expect(() => toasts.resume(9999)).not.toThrow();
    });

    it('is not thrown off by pausing twice', () => {
      // A pointer that crosses a child element fires enter and leave, so a pause
      // can arrive twice for the same toast. Without the guard, the second would
      // subtract elapsed time from a timer that is already stopped.
      toasts.success('Once');
      const id = toasts.toasts()[0].id;

      vi.advanceTimersByTime(1000);
      toasts.pause(id);
      toasts.pause(id);
      toasts.resume(id);

      vi.advanceTimersByTime(3000);
      expect(titles()).toEqual([]);
    });
  });
});
