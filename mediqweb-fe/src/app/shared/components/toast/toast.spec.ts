import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { ToastService } from '../../../core/services/toast.service';
import { Toasts } from './toast';

describe('Toasts', () => {
  let fixture: ComponentFixture<Toasts>;
  let service: ToastService;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [Toasts] });
    service = TestBed.inject(ToastService);
    fixture = TestBed.createComponent(Toasts);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => service.dismissAll());

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function rendered(): HTMLElement[] {
    return [...host().querySelectorAll<HTMLElement>('.toast')];
  }

  it('renders nothing while the stack is empty', () => {
    expect(host().querySelector('.toasts')).toBeTruthy();
    expect(rendered()).toEqual([]);
  });

  it('labels itself as a notifications landmark', () => {
    // A landmark rather than a live region of its own, so each toast below can
    // choose its own urgency without one assertive toast making all of them
    // assertive.
    const region = host().querySelector('.toasts')!;
    expect(region.getAttribute('role')).toBe('region');
    expect(region.getAttribute('aria-label')).toBe('Notifications');
  });

  it('renders a title and a message', () => {
    service.success('Account created', 'Rafael Santos was added as a doctor.');
    fixture.detectChanges();

    const toast = rendered()[0];
    expect(toast.querySelector('.toast__title')?.textContent?.trim()).toBe('Account created');
    expect(toast.querySelector('.toast__message')?.textContent?.trim()).toBe(
      'Rafael Santos was added as a doctor.',
    );
  });

  it('omits the message element when there is no message', () => {
    service.info('Nothing to do');
    fixture.detectChanges();

    expect(rendered()[0].querySelector('.toast__message')).toBeNull();
    expect(rendered()[0].querySelector('.toast__title')?.textContent?.trim()).toBe('Nothing to do');
  });

  it('gives each tone its own class', () => {
    service.success('One');
    service.error('Two');
    service.warning('Three');
    service.info('Four');
    fixture.detectChanges();

    expect(rendered().map((toast) => toast.className)).toEqual([
      'toast toast--info',
      'toast toast--warning',
      'toast toast--error',
      'toast toast--success',
    ]);
  });

  it('interrupts only for an error', () => {
    service.success('Fine');
    service.error('Broken');
    fixture.detectChanges();

    const roles = rendered().map((toast) => toast.getAttribute('role'));
    // Newest first, so the error is the one that gets `alert`.
    expect(roles).toEqual(['alert', 'status']);
  });

  it('hides the icon from assistive technology', () => {
    // The tone is already announced by the role and is visible as the accent
    // colour, so reading the glyph out would repeat it.
    service.success('Saved');
    fixture.detectChanges();

    expect(rendered()[0].querySelector('.toast__icon')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('names the notification on the close button', () => {
    // "Dismiss" on its own tells a screen reader user four identical buttons
    // apart only by position.
    service.success('Account created');
    fixture.detectChanges();

    expect(rendered()[0].querySelector('.toast__close')?.getAttribute('aria-label')).toBe(
      'Dismiss: Account created',
    );
  });

  it('dismisses the right notification when one of several is closed', () => {
    const keep = service.success('Keep me');
    const drop = service.error('Drop me');
    service.success('Also keep me');
    fixture.detectChanges();

    // The close button on the middle toast, by its accessible name.
    const button = [...host().querySelectorAll<HTMLButtonElement>('.toast__close')].find(
      (b) => b.getAttribute('aria-label') === 'Dismiss: Drop me',
    )!;
    button.click();
    fixture.detectChanges();

    expect(service.toasts().map((toast) => toast.id)).not.toContain(drop);
    expect(service.toasts().map((toast) => toast.id)).toContain(keep);
    expect(rendered().length).toBe(2);
  });

  it('pauses on hover and resumes on leave', () => {
    // The timer has to stop while the pointer is on the toast, or it disappears
    // from under the reader who has reached for the close button.
    service.success('Hovered');
    fixture.detectChanges();

    const toast = rendered()[0];
    toast.dispatchEvent(new MouseEvent('mouseenter'));
    toast.dispatchEvent(new MouseEvent('mouseleave'));

    expect(rendered().length).toBe(1);
  });

  it('pauses on keyboard focus and resumes on blur', () => {
    // Same reason as hover, reached by tabbing rather than pointing.
    service.success('Focused');
    fixture.detectChanges();

    const toast = rendered()[0];
    toast.dispatchEvent(new FocusEvent('focusin', { bubbles: false }));
    toast.dispatchEvent(new FocusEvent('focusout', { bubbles: false }));

    expect(rendered().length).toBe(1);
  });

  it('renders several notifications without nesting them', () => {
    service.success('One');
    service.error('Two');
    service.warning('Three');
    fixture.detectChanges();

    // Each toast is a sibling, so they stack rather than one containing the next.
    const toasts = rendered();
    expect(toasts.length).toBe(3);
    for (const toast of toasts) {
      expect(toast.querySelector('.toast')).toBeNull();
    }
  });

  it('keeps pointer events off the gap between notifications', () => {
    // The container spans the whole column so the newest can sit at the top, and
    // a full-height transparent box would swallow clicks aimed at the page.
    service.success('One');
    service.success('Two');
    fixture.detectChanges();

    const container = getComputedStyle(host().querySelector('.toasts')!);
    expect(container.pointerEvents).toBe('none');
    // Each toast opts back in, or its close button would be unclickable.
    for (const toast of rendered()) {
      expect(getComputedStyle(toast).pointerEvents).toBe('auto');
    }
  });
});
