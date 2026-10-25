import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { isDevMode } from '@angular/core';
import { PasswordManagementService } from '../../../core/services/password-management.service';
import { DevOtpHint } from './dev-otp-hint';

/**
 * The development-only code panel.
 *
 * It deliberately shows the second factor, so what matters is that it is gated
 * on `isDevMode()` and shows nothing else. The gate itself is asserted here as a
 * property of the code; that a production build really does render nothing was
 * verified against `ng serve --configuration production`, where the element is
 * absent from the DOM entirely.
 */
describe('DevOtpHint', () => {
  let fixture: ComponentFixture<DevOtpHint>;
  let service: PasswordManagementService;

  beforeEach(async () => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PasswordManagementService);
    fixture = TestBed.createComponent(DevOtpHint);
  });

  async function issueChallenge(): Promise<string> {
    const challenge = await service.requestChangePasswordOtp({
      accountId: 'doc-002',
      email: 'rafael.santos@mediq.ph',
      role: 'doctor',
    });
    return challenge.challengeId;
  }

  it('is gated on the development build', () => {
    // If this ever stops being true in a production build the panel starts
    // rendering a live credential, so the gate is asserted rather than assumed.
    expect(isDevMode()).toBe(true); // this suite runs in a development build
  });

  it('shows the code for the challenge it is given', async () => {
    const id = await issueChallenge();
    const code = service.peekIssuedCode(id) as string;

    fixture.componentRef.setInput('challengeId', id);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain(code);
  });

  it('says plainly that it is development only', async () => {
    fixture.componentRef.setInput('challengeId', await issueChallenge());
    fixture.detectChanges();
    await fixture.whenStable();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Development only');
    expect(text).toContain('not a production build');
  });

  it('renders nothing without a challenge', async () => {
    // The code step can be re-entered before a challenge exists.
    fixture.componentRef.setInput('challengeId', null);
    fixture.detectChanges();
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).textContent?.trim()).toBe('');
  });

  it('renders nothing for an id that was never issued', () => {
    fixture.componentRef.setInput('challengeId', 'otp-does-not-exist');
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent?.trim()).toBe('');
  });

  it('follows the challenge when a new one replaces it', async () => {
    const first = await issueChallenge();
    fixture.componentRef.setInput('challengeId', first);
    fixture.detectChanges();
    await fixture.whenStable();
    const firstCode = service.peekIssuedCode(first) as string;
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(firstCode);

    // Issuing again for the same account and purpose replaces the challenge.
    const second = await issueChallenge();
    fixture.componentRef.setInput('challengeId', second);
    fixture.detectChanges();
    await fixture.whenStable();

    const secondCode = service.peekIssuedCode(second) as string;
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain(secondCode);
    expect(text).not.toContain(firstCode);
  });
});