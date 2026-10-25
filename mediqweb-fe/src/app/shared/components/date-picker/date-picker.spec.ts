import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DatePicker } from './date-picker';

/** Fixed clock so every assertion about "today" is deterministic. */
const TODAY = '2026-10-15';

describe('DatePicker', () => {
  let fixture: ComponentFixture<DatePicker>;
  /**
   * The instance as `any`, so the specs can reach the value signal and the
   * `ControlValueAccessor` methods — the same escape hatch the page specs use
   * for state the public surface deliberately does not expose.
   */
  let picker!: any;

  /** Mounts with the given inputs, defaulting `today` so nothing reads the clock. */
  function mount(inputs: Record<string, unknown> = {}): void {
    fixture = TestBed.createComponent(DatePicker);
    for (const [name, value] of Object.entries({ today: TODAY, ...inputs })) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    picker = fixture.componentInstance;
  }

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function trigger(): HTMLButtonElement {
    return host().querySelector<HTMLButtonElement>('.ui-date-picker__trigger')!;
  }

  function cells(): HTMLElement[] {
    return [...host().querySelectorAll<HTMLElement>('.ui-date-picker__cell')];
  }

  function cell(key: string): HTMLElement {
    return host().querySelector<HTMLElement>(`[id$="day-${key}"]`)!;
  }

  function open(): void {
    trigger().click();
    fixture.detectChanges();
  }

  function key(name: string): void {
    trigger().dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DatePicker] }).compileComponents();
  });

  describe('trigger', () => {
    it('shows a placeholder until a date is chosen', () => {
      mount({ placeholder: 'Choose a date' });
      expect(host().textContent).toContain('Choose a date');
    });

    it('spells the chosen date out rather than using a numeric format', () => {
      // The same page shows this date as "Fri, Nov 14" in a list below, and a
      // picker that switched notation mid-page reads as two different dates.
      mount({});
      picker.writeValue('2026-11-14');
      fixture.detectChanges();
      expect(trigger().textContent!.replace(/\s+/g, ' ').trim()).toBe('Sat, Nov 14');
    });

    it('carries the id it was given, on the button and nowhere else', () => {
      // An `id` input would also land on the host, giving the page two elements
      // with the same id and every query selector picking whichever came first.
      mount({ triggerId: 'my-date' });
      expect(host().querySelectorAll('#my-date').length).toBe(1);
      expect(trigger().id).toBe('my-date');
    });

    it('reports whether it is open', () => {
      mount({});
      expect(trigger().getAttribute('aria-expanded')).toBe('false');
      open();
      expect(trigger().getAttribute('aria-expanded')).toBe('true');
    });

    it('puts its content at the left edge, like the input it stands in for', () => {
      // The global `button` baseline centres its content, so a full-width
      // trigger floated the icon and the date in the middle of the field, lining
      // up with neither the label above nor the inputs below. `text-align` does
      // not help: these are flex items.
      mount({});
      expect(getComputedStyle(trigger()).justifyContent).toBe('flex-start');
    });

    it('does not open when disabled', () => {
      mount({});
      picker.setDisabledState(true);
      fixture.detectChanges();
      expect(trigger().disabled).toBe(true);
      trigger().click();
      fixture.detectChanges();
      expect(host().querySelector('.ui-date-picker__panel')).toBeNull();
    });
  });

  describe('the month grid', () => {
    it('always shows six rows of seven, whatever the month', () => {
      // A grid that changes height under the pointer moves the day being aimed
      // at. February 2027 starts on a Monday and has 28 days — the case most
      // likely to collapse to five rows. Asserted on the markup rather than on
      // geometry: jsdom does no layout, so every box would measure zero.
      mount({ today: '2027-02-10' });
      open();
      const rows = [...host().querySelectorAll('tbody tr')];
      expect(rows.length).toBe(6);
      for (const row of rows) expect(row.querySelectorAll('td').length).toBe(7);
    });

    it('starts on Monday, not Sunday', () => {
      mount({ today: '2026-10-01' });
      open();
      // 1 October 2026 is a Thursday, so the row begins Mon 28 Sep.
      expect(
        cells()
          .slice(0, 7)
          .map((c) => c.textContent!.trim()),
      ).toEqual(['28', '29', '30', '1', '2', '3', '4']);
    });

    it('marks the days belonging to the neighbouring months as outside', () => {
      mount({ today: '2026-10-15' });
      open();
      // October 2026 has 31 days in a 42-cell grid, so 11 belong to September
      // and November — three leading and eight trailing.
      expect(cells().filter((c) => c.classList.contains('is-outside')).length).toBe(11);
    });

    it('does not change month when the pointer passes over a faded day', () => {
      // The grid renders the month from the keyboard cursor, and `mouseenter`
      // used to move that cursor for every cell. Hovering the trailing "1 2 3"
      // of November therefore flipped the whole calendar back to it — the pointer
      // crossing the end of a row changed the month under the user.
      mount({ today: '2026-10-15' });
      open();
      expect(host().querySelector('.ui-date-picker__month')!.textContent!.trim()).toBe(
        'October 2026',
      );

      const trailing = cells().find((c) => c.classList.contains('is-outside'))!;
      trailing.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
      fixture.detectChanges();

      expect(host().querySelector('.ui-date-picker__month')!.textContent!.trim()).toBe(
        'October 2026',
      );
      expect(picker.focusedKey()).toBe(TODAY);
    });

    it('does not change month when a faded day is clicked', () => {
      const seen: (string | null)[] = [];
      mount({ today: '2026-10-15' });
      picker.registerOnChange((value: string | null) => seen.push(value));
      open();

      const trailing = cells().filter((c) => c.classList.contains('is-outside'))[0];
      const outsideKey = trailing.getAttribute('id')!.split('-day-')[1];
      trailing.click();
      fixture.detectChanges();

      expect(seen).toEqual([]);
      expect(picker.focusedKey()).toBe(TODAY);
      expect(host().querySelector('.ui-date-picker__month')!.textContent!.trim()).toBe(
        'October 2026',
      );
      expect(outsideKey).toBeTruthy();
    });

    it('will not move the cursor onto a disabled day by hovering it either', () => {
      mount({ today: TODAY, min: '2026-10-15' });
      open();
      const past = cells().find((c) => c.classList.contains('is-disabled'))!;
      past.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
      fixture.detectChanges();
      expect(picker.focusedKey()).toBe(TODAY);
    });

    it('announces a faded day as disabled, not merely draws it that way', () => {
      mount({ today: TODAY, min: '2026-10-15' });
      open();
      const outside = cells().find((c) => c.classList.contains('is-outside'))!;
      const past = cells().find((c) => c.classList.contains('is-disabled'))!;
      expect(outside.getAttribute('aria-disabled')).toBe('true');
      expect(past.getAttribute('aria-disabled')).toBe('true');
      // A real day in range is not announced as disabled.
      expect(cell('2026-10-20').getAttribute('aria-disabled')).toBeNull();
    });

    it('pages between months', () => {
      mount({ today: TODAY });
      open();
      expect(host().querySelector('.ui-date-picker__month')!.textContent!.trim()).toBe(
        'October 2026',
      );
      key('PageDown');
      expect(host().querySelector('.ui-date-picker__month')!.textContent!.trim()).toBe(
        'November 2026',
      );
      key('PageUp');
      expect(host().querySelector('.ui-date-picker__month')!.textContent!.trim()).toBe(
        'October 2026',
      );
    });

    it('rolls the year over rather than stopping at December', () => {
      mount({ today: '2026-12-01' });
      open();
      key('PageDown');
      expect(host().querySelector('.ui-date-picker__month')!.textContent!.trim()).toBe(
        'January 2027',
      );
    });

    it('pages past a month that has nothing selectable in it', () => {
      // A `max` at the end of this month leaves November entirely unselectable.
      // Searching only inside the target month found nothing and the keypress
      // did nothing at all, which looks like the calendar is frozen.
      mount({ today: '2026-10-20', max: '2026-10-31' });
      open();
      key('PageDown');
      expect(host().querySelector('.ui-date-picker__month')!.textContent!.trim()).not.toBe(
        'November 2026',
      );
      expect(picker.focusedKey()).not.toBeNull();
    });

    it('says which day today is, so it can be told apart from the chosen one', () => {
      mount({ today: TODAY });
      open();
      expect(cell(TODAY).classList.contains('is-today')).toBe(true);
      expect(cell(TODAY).getAttribute('aria-current')).toBe('date');
    });

    it('opens the keyboard cursor on today, not on the first of the month', () => {
      // It used to open on 1 October: the "first selectable day" fallback was
      // always available, so the `?? this.today()` after it could never run. One
      // arrow key then landed on the 2nd and the cursor looked two weeks out.
      mount({ today: TODAY });
      open();
      expect(picker.focusedKey()).toBe(TODAY);
      key('ArrowRight');
      expect(picker.focusedKey()).toBe('2026-10-16');
    });

    it('opens on the chosen date rather than today', () => {
      mount({ today: TODAY });
      picker.writeValue('2026-10-22');
      fixture.detectChanges();
      open();
      expect(picker.focusedKey()).toBe('2026-10-22');
    });

    it('falls back to the first selectable day when today is out of range', () => {
      // A picker whose `min` is in the future has to put the cursor somewhere
      // legal, or the first arrow key lands on a disabled day.
      mount({ today: TODAY, min: '2026-11-01' });
      open();
      expect(picker.focusedKey()).toBe('2026-11-01');
    });
  });

  describe('choosing a date', () => {
    it('pushes the choice out to the form, not just onto the trigger', () => {
      // The half of ControlValueAccessor that is easy to forget. Without it the
      // picker shows a date and the form keeps an empty one, so saving would
      // publish an entry with no date on it.
      const seen: (string | null)[] = [];
      mount({});
      picker.registerOnChange((value: string | null) => seen.push(value));

      open();
      cell('2026-10-20').click();
      fixture.detectChanges();

      expect(seen).toEqual(['2026-10-20']);
      expect(trigger().textContent!.replace(/\s+/g, ' ').trim()).toBe('Tue, Oct 20');
    });

    it('emits valueChange as well, for callers not using forms', () => {
      const seen: string[] = [];
      mount({});
      picker.valueChange.subscribe((value: string) => seen.push(value));
      open();
      cell('2026-10-20').click();
      expect(seen).toEqual(['2026-10-20']);
    });

    it('closes after choosing', () => {
      mount({});
      open();
      cell('2026-10-20').click();
      fixture.detectChanges();
      expect(host().querySelector('.ui-date-picker__panel')).toBeNull();
    });

    it('stays open when closeOnSelect is off', () => {
      mount({ closeOnSelect: false });
      open();
      cell('2026-10-20').click();
      fixture.detectChanges();
      expect(host().querySelector('.ui-date-picker__panel')).not.toBeNull();
    });

    it('clears back to empty', () => {
      mount({});
      picker.writeValue('2026-10-20');
      fixture.detectChanges();
      open();
      host().querySelector<HTMLButtonElement>('.ui-date-picker__link')!.click();
      fixture.detectChanges();

      expect(picker.value()).toBeNull();
      expect(trigger().textContent).toContain('Choose a date');
    });

    it('refuses to choose a disabled day', () => {
      const seen: (string | null)[] = [];
      mount({ min: '2026-10-15' });
      picker.registerOnChange((value: string | null) => seen.push(value));
      open();
      cell('2026-10-10').click();
      fixture.detectChanges();
      expect(seen).toEqual([]);
    });

    it('disables days before min and after max', () => {
      mount({ min: '2026-10-15', max: '2026-10-25' });
      open();
      expect(cell('2026-10-14').classList.contains('is-disabled')).toBe(true);
      expect(cell('2026-10-15').classList.contains('is-disabled')).toBe(false);
      expect(cell('2026-10-25').classList.contains('is-disabled')).toBe(false);
      expect(cell('2026-10-26').classList.contains('is-disabled')).toBe(true);
    });
  });

  describe('marking dates', () => {
    it('marks the keys it is given, and no others', () => {
      mount({ marked: ['2026-10-20', '2026-10-22'] });
      open();
      const marked = cells().filter((c) => c.classList.contains('is-marked'));
      expect(marked.map((c) => c.getAttribute('id')!.split('-day-')[1])).toEqual([
        '2026-10-20',
        '2026-10-22',
      ]);
    });
  });

  describe('keyboard', () => {
    it('opens with Enter', () => {
      mount({});
      key('Enter');
      expect(host().querySelector('.ui-date-picker__panel')).not.toBeNull();
    });

    it('opens on a space too, since a button responds to both', () => {
      mount({});
      key(' ');
      expect(host().querySelector('.ui-date-picker__panel')).not.toBeNull();
    });

    it('moves a day at a time with the arrow keys', () => {
      mount({ today: TODAY });
      open();
      key('ArrowRight');
      expect(host().querySelector('.is-focused')!.getAttribute('id')!.endsWith('2026-10-16')).toBe(
        true,
      );
      key('ArrowLeft');
      key('ArrowLeft');
      expect(host().querySelector('.is-focused')!.getAttribute('id')!.endsWith('2026-10-14')).toBe(
        true,
      );
    });

    it('moves a week at a time with up and down, which is what they mean in a calendar', () => {
      mount({ today: TODAY });
      open();
      key('ArrowDown');
      expect(host().querySelector('.is-focused')!.getAttribute('id')!.endsWith('2026-10-22')).toBe(
        true,
      );
    });

    it('jumps to the ends of the week with Home and End', () => {
      // 15 October 2026 is a Thursday, so its week runs Monday the 12th to
      // Sunday the 18th.
      mount({ today: TODAY });
      open();
      key('Home');
      expect(host().querySelector('.is-focused')!.getAttribute('id')!.endsWith('2026-10-12')).toBe(
        true,
      );
      key('End');
      expect(host().querySelector('.is-focused')!.getAttribute('id')!.endsWith('2026-10-18')).toBe(
        true,
      );
    });

    it('chooses the focused day with Enter', () => {
      const seen: (string | null)[] = [];
      mount({ today: TODAY });
      picker.registerOnChange((value: string | null) => seen.push(value));
      open();
      key('ArrowRight');
      key('Enter');
      expect(seen).toEqual(['2026-10-16']);
    });

    it('closes on Escape without choosing anything', () => {
      const seen: (string | null)[] = [];
      mount({ today: TODAY });
      picker.registerOnChange((value: string | null) => seen.push(value));
      open();
      key('Escape');
      fixture.detectChanges();
      expect(host().querySelector('.ui-date-picker__panel')).toBeNull();
      expect(seen).toEqual([]);
    });

    it('closes when Tab is pressed, so the next field is reachable', () => {
      mount({ today: TODAY });
      open();
      key('Tab');
      fixture.detectChanges();
      expect(host().querySelector('.ui-date-picker__panel')).toBeNull();
    });

    it('points the trigger at the focused day for a screen reader', () => {
      mount({ today: TODAY });
      open();
      expect(trigger().getAttribute('aria-activedescendant')).toContain('2026-10-15');
      key('Escape');
      fixture.detectChanges();
      expect(trigger().getAttribute('aria-activedescendant')).toBeNull();
    });

    it('carries a description and an invalid state onto the trigger', () => {
      // The component cannot know what `FormField` rendered beside it, so the
      // caller supplies the id. Without this the hint explaining what the week
      // already says is on screen and announced by nobody.
      mount({ today: TODAY, describedBy: 'my-date-help', invalid: true });
      expect(trigger().getAttribute('aria-describedby')).toBe('my-date-help');
      expect(trigger().getAttribute('aria-invalid')).toBe('true');

      mount({ today: TODAY });
      expect(trigger().getAttribute('aria-describedby')).toBeNull();
      expect(trigger().hasAttribute('aria-invalid')).toBe(false);
    });
  });

  describe('robustness', () => {
    it('rejects a key that is not a real date', () => {
      // `new Date('2026-02-31')` is 3 March, so a picker that trusted its own
      // value would quietly publish a holiday on the wrong day.
      mount({ today: TODAY });
      picker.writeValue('2026-02-31');
      fixture.detectChanges();
      expect(picker.value()).toBe('2026-02-31');
      open();
      // It simply does not highlight anything, rather than highlighting 3 March.
      expect(host().querySelector('.is-selected')).toBeNull();
    });

    it('ignores a value the form pushes that is not a date', () => {
      mount({ today: TODAY });
      picker.writeValue('next Tuesday');
      fixture.detectChanges();
      open();
      expect(host().querySelector('.is-selected')).toBeNull();
    });

    it('closes on a click outside itself', () => {
      mount({ today: TODAY });
      open();
      document.body.click();
      fixture.detectChanges();
      expect(host().querySelector('.ui-date-picker__panel')).toBeNull();
    });
  });
});
