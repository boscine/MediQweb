import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { OtpInput } from './otp-input';

/** A host that binds the component through a reactive form, as both flows do. */
@Component({
  imports: [ReactiveFormsModule, OtpInput],
  template: '<ui-otp-input [formControl]="code" />',
})
class Host {
  readonly code = new FormControl('', { nonNullable: true });
  readonly length = signal(6);
}

describe('OtpInput', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [Host] });
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  function field(): HTMLInputElement {
    return fixture.nativeElement.querySelector('.ui-otp-input__field') as HTMLInputElement;
  }

  /** Types as a user would, so the component's own handler runs. */
  function type(value: string): void {
    const input = field();
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  }

  it('renders a numeric six-digit field', () => {
    expect(field().getAttribute('inputmode')).toBe('numeric');
    expect(field().getAttribute('pattern')).toBe('[0-9]*');
    expect(field().maxLength).toBe(6);
  });

  it('offers the platform one-time-code autofill', () => {
    // The browser can only fill a code into a single field, which is part of why
    // this is one input rather than six.
    expect(field().getAttribute('autocomplete')).toBe('one-time-code');
  });

  it('keeps digits as they are typed', () => {
    type('1');
    type('12');
    type('123');
    expect(host.code.value).toBe('123');
    expect(field().value).toBe('123');
  });

  it('drops letters rather than rejecting them', () => {
    type('1a2b3c');
    expect(host.code.value).toBe('123');
    // The browser is left showing the sanitised value, not the raw one.
    expect(field().value).toBe('123');
  });

  it('drops spaces, which a pasted code often carries', () => {
    type('12 34 56');
    expect(host.code.value).toBe('123456');
  });

  it('stops at six digits', () => {
    type('1234567890');
    expect(host.code.value).toBe('123456');
  });

  it('accepts a value written into the field by the form', () => {
    host.code.setValue('987654');
    fixture.detectChanges();
    expect(field().value).toBe('987654');
  });

  it('sanitises a value written by the form', () => {
    // A code arriving by autofill or paste arrives through the form, not through
    // the input event, so this path needs sanitising too.
    host.code.setValue('98 76 54');
    fixture.detectChanges();
    expect(field().value).toBe('987654');
  });

  it('survives a null value from the form', () => {
    host.code.setValue(null as never);
    fixture.detectChanges();
    expect(field().value).toBe('');
  });

  it('marks itself touched on blur', () => {
    expect(host.code.touched).toBe(false);
    field().dispatchEvent(new Event('blur'));
    expect(host.code.touched).toBe(true);
  });

  it('does not mark itself invalid while the code is incomplete', () => {
    // `aria-invalid` is for the state a form is in, and a half-typed code is not
    // an error until the form says so.
    type('123');
    expect(field().getAttribute('aria-invalid')).toBe('true');
  });
});