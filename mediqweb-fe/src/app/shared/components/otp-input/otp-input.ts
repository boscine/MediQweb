import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  forwardRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { OTP_LENGTH } from '../../../core/services/password-management.service';

/**
 * Six-digit one-time-code entry, shared by both password flows.
 *
 * One text field rather than six boxes. Six boxes need caret handling, arrow
 * keys and a paste path of their own before a pasted code works at all, and a
 * phone keyboard gives one field the numeric keypad for free — the native
 * `one-time-code` autofill from an SMS or mail app also only fills a single
 * input. It still looks like a code entry: monospaced digits with letter
 * spacing.
 *
 * A `ControlValueAccessor` so it drops into the reactive forms both flows already
 * use, rather than each of them reimplementing sanitising.
 */
@Component({
  selector: 'ui-otp-input',
  templateUrl: './otp-input.html',
  styleUrl: './otp-input.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => OtpInput),
      multi: true,
    },
  ],
  host: { class: 'ui-otp-input' },
})
export class OtpInput implements ControlValueAccessor {
  /** How many digits. The service issues six; the field follows it. */
  readonly length = input(OTP_LENGTH);
  readonly disabled = input(false);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly inputRef = viewChild<ElementRef<HTMLInputElement>>('code');

  protected readonly value = signal('');

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string | null): void {
    this.value.set(sanitise(value ?? '', this.length()));
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    // The field is driven by the `disabled` input so a parent can disable it
    // directly; the CVA hook exists for form-level disabling.
    if (isDisabled) this.host.nativeElement.setAttribute('data-disabled', 'true');
  }

  /** Focuses the field, so a flow can move the user here after sending a code. */
  focus(): void {
    this.inputRef()?.nativeElement.focus();
  }

  protected onInput(event: Event): void {
    const typed = (event.target as HTMLInputElement).value;
    const clean = sanitise(typed, this.length());
    // Writing back matters when the paste is longer than the field: the browser
    // leaves the extra characters in place and the caret ends up past the end.
    if (typed !== clean) (event.target as HTMLInputElement).value = clean;
    this.value.set(clean);
    this.onChange(clean);
  }

  protected onPaste(event: ClipboardEvent): void {
    // A pasted code often carries a space or a trailing newline from a mail app.
    const pasted = event.clipboardData?.getData('text') ?? '';
    const clean = sanitise(pasted, this.length());
    if (clean !== pasted.trim()) {
      event.preventDefault();
      this.value.set(clean);
      this.onChange(clean);
    }
  }

  protected onBlur(): void {
    this.onTouched();
  }

  /** The digits only, capped at `length`. Anything else is dropped silently. */
  protected digitCount(): number {
    return this.value().length;
  }

  protected isComplete(): boolean {
    return this.value().length === this.length();
  }
}

/**
 * Keeps digits and drops everything else — spaces, dashes, letters, and the
 * stray characters a mail client adds when a code is copied out of a message.
 */
function sanitise(value: string, length: number): string {
  return value.replace(/\D/g, '').slice(0, length);
}
