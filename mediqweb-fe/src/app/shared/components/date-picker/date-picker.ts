import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  forwardRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NG_VALUE_ACCESSOR, type ControlValueAccessor } from '@angular/forms';

/**
 * One cell in the month grid.
 *
 * `outside` days are the leading and trailing days shown to keep every week a
 * rectangle — a calendar whose rows are ragged reads as broken, and a row that
 * jumps from four cells to seven makes the columns impossible to follow with a
 * pointer or a screen reader.
 */
export interface DatePickerDay {
  readonly key: string;
  readonly day: number;
  readonly outside: boolean;
  readonly disabled: boolean;
}

let nextId = 0;

/** Monday first, which is how the grid reads in every locale MediQ ships. */
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const;

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const pad = (value: number): string => String(value).padStart(2, '0');

/** `YYYY-MM-DD` for a local date. Never `toISOString`, which would shift the day. */
function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * A calendar popover that matches the design system.
 *
 * Built because the browser's own `<input type="date">` popup is chrome the page
 * cannot style: it ignores every token, and on this page — whose entire job is
 * choosing among dates that already carry an exception — it cannot show which
 * dates those are.
 *
 * The keyboard model is `role="grid"`: arrows move a day, `PageUp`/`PageDown`
 * move a month, `Home`/`End` jump to the ends of the week, `Enter` selects and
 * `Escape` closes. DOM focus stays on the trigger and the active day is carried
 * by `aria-activedescendant`, which is the same pattern `Dropdown` uses and the
 * one screen readers expect from a custom control.
 */
@Component({
  selector: 'ui-date-picker',
  templateUrl: './date-picker.html',
  styleUrl: './date-picker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.ui-date-picker--open]': 'opened()' },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      // Not `useExisting: forwardRef(() => DatePicker)`: a reference to the class
      // inside its own decorator, which is exactly what `forwardRef` exists for.
      useExisting: forwardRef(() => DatePicker),
      multi: true,
    },
  ],
})
export class DatePicker implements ControlValueAccessor {
  /** Earliest selectable day as `YYYY-MM-DD`. Days before it are disabled. */
  readonly min = input<string | null>(null);
  /** Latest selectable day as `YYYY-MM-DD`. */
  readonly max = input<string | null>(null);
  /**
   * `YYYY-MM-DD` keys worth drawing attention to — the dates that already carry
   * an exception, so the page can show where the gaps in the week are.
   */
  readonly marked = input<readonly string[]>([]);
  /** Visible text when nothing is chosen. */
  readonly placeholder = input('Choose a date');
  /** Accessible name for the trigger. */
  readonly label = input('');
  /**
   * Id for the trigger button, so a `FormField` label can point at it.
   *
   * Named `triggerId` rather than `id` on purpose. An input called `id` is also
   * applied to the host element as a plain attribute, which silently gives the
   * page two elements with the same id — the wrapper and the button — and every
   * `querySelector('#…')`, every `for=` and every `aria-describedby` then picks
   * whichever the browser happens to return first.
   */
  readonly triggerId = input('');
  /** Closes after a day is chosen. Off for a range picker, which needs two. */
  readonly closeOnSelect = input(true);
  /**
   * Ids of the help or error text rendered beside the trigger.
   *
   * Supplied by the caller rather than derived, because the component does not
   * know what `FormField` rendered or what id it chose. Without it the trigger
   * sits next to a sentence explaining what the week already says and no screen
   * reader ever announces it.
   */
  readonly describedBy = input<string | null>(null);
  /** Marks the trigger invalid, for a `required` control the form has rejected. */
  readonly invalid = input(false);
  /** The month the grid opens on. Injectable so tests do not depend on the clock. */
  readonly today = input<string>(dayKey(new Date()));

  readonly valueChange = output<string>();
  readonly openedChange = output<boolean>();

  /**
   * The chosen date.
   *
   * A writable signal rather than an input because `ControlValueAccessor` has to
   * accept a value being set *into* the control from the form — `Reset`, a patch,
   * or the form being refilled from the store — as well as emit one out of it.
   * An input could only ever travel one way.
   */
  protected readonly value = signal<string | null>(null);
  protected readonly isDisabled = signal(false);

  protected readonly opened = signal(false);
  /** The day the keyboard cursor is on, as `YYYY-MM-DD`. */
  protected readonly focusedKey = signal<string | null>(null);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly uid = `ui-date-picker-${++nextId}`;

  /** Held rather than called inline; the forms API supplies them on register. */
  private onChange: (value: string | null) => void = () => {};
  private onTouched: () => void = () => {};

  /** Called by the forms API to push a value in; not used directly. */
  writeValue(value: string | null): void {
    this.value.set(value || null);
  }

  /**
   * Holds the callback the forms API hands over so a chosen day can be pushed
   * back out to the control.
   *
   * This is the half of `ControlValueAccessor` that is easy to forget, and it is
   * not optional: without it the picker selects a date, shows it on the trigger
   * and leaves the form's value untouched, so saving publishes the entry with no
   * date at all. Emitting an output does not cover for it — that only works when
   * the output pairs with a matching `value` *input*, and this component's value
   * is a signal because the form has to be able to set it as well as read it.
   */
  registerOnChange(fn: (value: string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
  }

  /**
   * Records a chosen day everywhere it has to go: the trigger, any
   * `[valueChange]` listener, and the form control itself.
   */
  private commit(key: string): void {
    const value = key || null;
    this.value.set(value);
    this.onChange(value);
    this.valueChange.emit(key);
  }

  protected readonly dialogId = `${this.uid}-dialog`;
  protected readonly gridId = `${this.uid}-grid`;

  protected readonly weekdayNames = WEEKDAYS;

  private readonly todayDate = computed(() => this.parse(this.today()) ?? new Date());
  private readonly minDate = computed(() => {
    const min = this.min();
    return min ? this.parse(min) : null;
  });
  private readonly maxDate = computed(() => {
    const max = this.max();
    return max ? this.parse(max) : null;
  });

  /** The month on screen. Separate from the chosen date so it can be browsed. */
  protected readonly viewMonth = computed(() => {
    const focus = this.focusedKey() ? this.parse(this.focusedKey()!) : null;
    return focus ?? this.todayDate();
  });

  protected readonly monthLabel = computed(
    () => `${MONTH_NAMES[this.viewMonth().getMonth()]} ${this.viewMonth().getFullYear()}`,
  );

  /**
   * Trigger text.
   *
   * Spelled out — "Fri, Nov 14" — rather than `11/14/2026`, because the same page
   * shows the chosen date in that form in the list below it and a picker that
   * switched notation mid-page would read as two different dates.
   */
  protected readonly triggerText = computed(() => {
    const date = this.value() ? this.parse(this.value()!) : null;
    if (!date) return this.placeholder();
    const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
    const month = MONTH_NAMES[date.getMonth()].slice(0, 3);
    return `${weekday}, ${month} ${date.getDate()}`;
  });

  protected readonly isPlaceholder = computed(() => !this.value());

  /**
   * The six-week grid.
   *
   * Always six rows so the panel does not change height between months, which is
   * the jump a fixed-height popover cannot afford: a grid that grows and shrinks
   * under the pointer moves the day you were aiming at.
   */
  protected readonly days = computed<DatePickerDay[]>(() => {
    const month = this.viewMonth();
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    // `getDay()` is Sunday-first; the grid is Monday-first, so shift it.
    const offset = (first.getDay() + 6) % 7;

    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(first.getFullYear(), first.getMonth(), i - offset + 1);
      const key = dayKey(date);
      const min = this.minDate();
      const max = this.maxDate();
      return {
        key,
        day: date.getDate(),
        outside: date.getMonth() !== month.getMonth(),
        disabled:
          (min !== null && date.getTime() < min.getTime()) ||
          (max !== null && date.getTime() > max.getTime()),
      };
    });
  });

  /** What a screen reader announces for the focused cell. */
  protected activeDescendant(): string | null {
    const key = this.focusedKey();
    return key && this.opened() ? `${this.uid}-day-${key}` : null;
  }

  protected dayId(key: string): string {
    return `${this.uid}-day-${key}`;
  }

  protected isFocused(key: string): boolean {
    return this.focusedKey() === key;
  }

  protected isSelected(key: string): boolean {
    return this.value() === key;
  }

  protected isToday(key: string): boolean {
    return key === this.today();
  }

  protected isMarked(key: string): boolean {
    return this.marked().includes(key);
  }

  protected open(): void {
    if (this.isDisabled() || this.opened()) return;
    // Open on the chosen date; failing that today, so the grid is already showing
    // the day the picker is about rather than the first of the month.
    const today = this.today();
    this.focusedKey.set(
      this.value() ?? (this.dayIsDisabled(today) ? (this.firstSelectableKey() ?? today) : today),
    );
    this.opened.set(true);
    this.openedChange.emit(true);
  }

  protected close(refocus = false): void {
    if (!this.opened()) return;
    this.opened.set(false);
    this.openedChange.emit(false);
    if (refocus) {
      queueMicrotask(() => {
        this.host.nativeElement
          .querySelector<HTMLButtonElement>('.ui-date-picker__trigger')
          ?.focus();
      });
    }
  }

  protected toggle(): void {
    this.opened() ? this.close() : this.open();
  }

  /**
   * Whether a day can actually be chosen.
   *
   * Two things rule one out. A disabled day is outside the range — a past date,
   * or one beyond `max`. An outside day belongs to the neighbouring month and is
   * drawn only to keep every week a rectangle.
   *
   * Outside days used to be clickable, which contradicted what they are for and
   * meant the month a day belongs to could be opened by a stray click on a
   * number the user had read as decoration. The month arrows are how you change
   * month; a faded number is not.
   */
  protected isSelectable(day: DatePickerDay): boolean {
    return !day.disabled && !day.outside;
  }

  /**
   * Moves the keyboard cursor to a hovered day, but only a choosable one.
   *
   * Hover must never move the cursor onto a day that cannot be picked. The grid
   * renders the month from `focusedKey`, so hovering a trailing "1 2 3 4 5" from
   * the next month silently flipped the whole calendar back to it — the pointer
   * passing over the end of a row changed the month under the user.
   */
  protected hover(day: DatePickerDay): void {
    if (this.isSelectable(day)) this.focusedKey.set(day.key);
  }

  protected select(day: DatePickerDay): void {
    if (!this.isSelectable(day)) return;
    this.focusedKey.set(day.key);
    this.commit(day.key);
    if (this.closeOnSelect()) this.close(true);
  }

  protected shiftMonth(delta: number): void {
    const month = this.viewMonth();
    const moved = new Date(month.getFullYear(), month.getMonth() + delta, 1);
    // Look forward from the target month rather than inside it: a month with no
    // selectable days at all — a `min` later in it, or a `max` before it starts —
    // would otherwise swallow the keypress and leave the grid stuck where it was.
    const key = this.firstSelectableFrom(moved);
    if (!key) return;
    this.focusedKey.set(key);
  }

  protected shiftDays(delta: number): void {
    const current = this.focusedKey() ? this.parse(this.focusedKey()!) : null;
    if (!current) return;
    const moved = new Date(current.getFullYear(), current.getMonth(), current.getDate() + delta);
    this.focusedKey.set(dayKey(moved));
  }

  protected shiftWeeks(delta: number): void {
    this.shiftDays(delta * 7);
  }

  /** `Home` and `End` move within the week, not the grid — the week is the row. */
  protected toEdgeOfWeek(edge: 'start' | 'end'): void {
    const current = this.focusedKey() ? this.parse(this.focusedKey()!) : null;
    if (!current) return;
    const mondayOffset = (current.getDay() + 6) % 7;
    const delta = edge === 'start' ? -mondayOffset : 6 - mondayOffset;
    this.shiftDays(delta);
  }

  protected clear(): void {
    this.focusedKey.set(null);
    this.commit('');
    this.close(true);
  }

  protected chooseToday(): void {
    const key = this.today();
    if (this.dayIsDisabled(key)) return;
    this.focusedKey.set(key);
    this.commit(key);
    if (this.closeOnSelect()) this.close(true);
  }

  protected onKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.opened() ? this.shiftDays(7) : this.open();
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.opened() ? this.shiftDays(-7) : this.open();
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.shiftDays(1);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        this.shiftDays(-1);
        break;
      case 'PageDown':
        event.preventDefault();
        this.shiftMonth(1);
        break;
      case 'PageUp':
        event.preventDefault();
        this.shiftMonth(-1);
        break;
      case 'Home':
        if (this.opened()) {
          event.preventDefault();
          this.toEdgeOfWeek('start');
        }
        break;
      case 'End':
        if (this.opened()) {
          event.preventDefault();
          this.toEdgeOfWeek('end');
        }
        break;
      case 'Enter':
        event.preventDefault();
        if (this.opened() && this.focusedKey()) this.select(this.dayFor(this.focusedKey()!));
        else this.open();
        break;
      case ' ':
      case 'Spacebar':
        event.preventDefault();
        this.opened() ? this.commitFocused() : this.open();
        break;
      case 'Escape':
        if (this.opened()) {
          event.preventDefault();
          this.close(true);
        }
        break;
      case 'Tab':
        this.close();
        break;
    }
  }

  private commitFocused(): void {
    const key = this.focusedKey();
    if (key) this.select(this.dayFor(key));
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.opened()) return;
    if (!this.host.nativeElement.contains(event.target as Node)) this.close();
  }

  /** Builds a `DatePickerDay` for a key outside the rendered month. */
  private dayFor(key: string): DatePickerDay {
    return (
      this.days().find((day) => day.key === key) ?? {
        key,
        day: Number(key.slice(8)),
        outside: true,
        disabled: this.dayIsDisabled(key),
      }
    );
  }

  private dayIsDisabled(key: string): boolean {
    const date = this.parse(key);
    if (!date) return true;
    const min = this.minDate();
    const max = this.maxDate();
    return (
      (min !== null && date.getTime() < min.getTime()) ||
      (max !== null && date.getTime() > max.getTime())
    );
  }

  /**
   * The first selectable day from `start` *onwards*.
   *
   * Walks forward across month boundaries rather than searching one month,
   * because a `min` in the future can leave an entire month unselectable — and a
   * search confined to it returns nothing, which would put the cursor on a
   * disabled day or leave month navigation silently dead.
   *
   * Bounded at two years so a range with nothing selectable in it terminates
   * instead of running until the year runs out.
   */
  private firstSelectableFrom(start: Date): string | null {
    for (let offset = 0; offset < 730; offset += 1) {
      const key = dayKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset));
      if (!this.dayIsDisabled(key)) return key;
    }
    return null;
  }

  private firstSelectableKey(): string | null {
    return this.firstSelectableFrom(this.todayDate());
  }

  /**
   * A local `Date` from `YYYY-MM-DD`, or `null` if it is not one.
   *
   * Built from the parts rather than `new Date(string)`, which reads a bare date
   * as UTC and would hand back the previous day for anyone west of Greenwich —
   * and the round-trip rejects 31 February, which `Date` would quietly roll into
   * March.
   */
  private parse(key: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return dayKey(date) === key ? date : null;
  }
}
