import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { clearToasts, latestToast } from '../../../core/services/toast.service.spec-helpers';
import { dayKey, parseDayKey } from '../../doctor.dates';
import { DoctorSession } from '../../doctor-session';
import { DoctorSchedule } from './doctor-schedule';

describe('DoctorSchedule', () => {
  let fixture: ComponentFixture<DoctorSchedule>;
  let session: DoctorSession;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [DoctorSchedule], providers: [DoctorSession] });
    session = TestBed.inject(DoctorSession);
    fixture = TestBed.createComponent(DoctorSchedule);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  // Disarms the dismissal timers the toasts arm, so nothing is left pending.
  afterEach(() => clearToasts());

  function page(): any {
    return fixture.componentInstance;
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  /** A `YYYY-MM-DD` day key `days` from now. */
  function on(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return dayKey(date);
  }

  /** The next date falling on `weekday`, searching forward from tomorrow. */
  function nextWeekday(weekday: number): string {
    for (let i = 1; i <= 7; i += 1) {
      const key = on(i);
      if (parseDayKey(key)!.getDay() === weekday) return key;
    }
    throw new Error(`no weekday ${weekday} within a week`);
  }

  /** The `YYYY-MM-DD` a picker cell stands for, read from its own id. */
  function cellKey(cell: HTMLElement): string {
    // Ids are `${uid}-day-${key}`; the key is what comes after the last dash-run,
    // so slicing on '-day-' rather than splitting keeps the uid out of it.
    return cell.getAttribute('id')!.split('-day-')[1];
  }

  /** Switches a weekly session on or off. */
  function setSession(day: number, session: number, on: boolean): void {
    page().sessionRow(day, session).get('enabled').setValue(on);
    fixture.detectChanges();
  }

  /** Sets the date on the one-off form. */
  function setDate(value: string): void {
    page().dated.get('date').setValue(value);
    fixture.detectChanges();
  }

  /** Switches a session on the one-off form on or off. */
  function setDatedSession(session: number, on: boolean): void {
    page().datedSessionRow(session).get('enabled').setValue(on);
    fixture.detectChanges();
  }

  function setDatedTime(session: number, part: 'startTime' | 'endTime', value: string): void {
    page().datedSessionRow(session).get(part).setValue(value);
    fixture.detectChanges();
  }

  function setSessionTime(
    day: number,
    session: number,
    part: 'startTime' | 'endTime',
    value: string,
  ): void {
    page().sessionRow(day, session).get(part).setValue(value);
    fixture.detectChanges();
  }

  // --- The weekly form

  it('offers a row for each day of the week', () => {
    expect(page().days.controls.length).toBe(7);
    expect(text()).toContain('Sunday');
    expect(text()).toContain('Saturday');
  });

  it('offers a morning and an afternoon session on every day', () => {
    // The feature itself: a doctor working two sessions a day has to be able to
    // say so, and one Opens/Closes pair cannot say it.
    for (let day = 0; day < 7; day += 1) {
      expect(page().dayRow(day).controls.sessions.controls.length).toBe(2);
    }
    expect(text()).toContain('Morning');
    expect(text()).toContain('Afternoon');
  });

  it('offers a morning of 05:00 to 12:00 and an afternoon of 13:00 to 20:00', () => {
    // The clinic's hours, stated once. Pinned because a session whose defaults
    // drift from the ones the clinic publishes would quietly open the day at the
    // wrong time for anyone who saved without touching the inputs.
    const MORNING_DAYS = [1, 2, 4, 5];
    const AFTERNOON_DAYS = [1, 2, 3, 4, 5];
    for (let day = 0; day < 7; day += 1) {
      expect(page().sessionRow(day, 0).getRawValue()).toEqual({
        enabled: MORNING_DAYS.includes(day),
        startTime: '05:00',
        endTime: '12:00',
      });
      expect(page().sessionRow(day, 1).getRawValue()).toEqual({
        enabled: AFTERNOON_DAYS.includes(day),
        startTime: '13:00',
        endTime: '20:00',
      });
    }
  });

  it('leaves an hour clear between the two sessions', () => {
    // Half-open, so 12:00 and 13:00 do not clash and the gap is never published
    // as bookable.
    setSession(6, 1, true);
    expect(page().showOverlapError(6)).toBe(false);
    page().save();
    fixture.detectChanges();
    expect(latestToast()?.tone).toBe('success');
  });

  it('starts from the published week, session by session', () => {
    const monday = session.schedule().find((d) => d.dayOfWeek === 1)!;
    monday.sessions.forEach((block, index) => {
      expect(page().sessionRow(1, index).getRawValue()).toEqual({
        enabled: true,
        startTime: block.startTime,
        endTime: block.endTime,
      });
    });
  });

  it('starts with a closed day showing no sessions switched on', () => {
    // A day is worked when at least one session is on, so a closed day is the
    // absence of sessions rather than a flag that could disagree with them.
    const sunday = session.schedule().find((d) => d.dayOfWeek === 0)!;
    expect(sunday.sessions).toEqual([]);
    expect(page().isDayOpen(0)).toBe(false);
    expect(page().daySummary(0)).toBe('Not working');
  });

  it('treats a day with one session worked as a working day', () => {
    // Wednesday in the fixtures is an afternoon-only clinic day.
    const wednesday = session.schedule().find((d) => d.dayOfWeek === 3)!;
    expect(wednesday.sessions).toHaveLength(1);
    expect(page().isDayOpen(3)).toBe(true);
    expect(page().isSessionOn(3, 0)).toBe(false);
    expect(page().isSessionOn(3, 1)).toBe(true);
  });

  it('shows what a day adds up to, naming both halves of a split day', () => {
    const summary = page().daySummary(1);
    expect(summary).not.toBe('Not working');
    // Both sessions are represented, so the split is visible without reading
    // either pair of inputs.
    expect(summary.split(',').length).toBe(2);
  });

  it('recalculates the draft total as sessions are switched', () => {
    const before = page().draftSummary();
    setSession(6, 0, true);
    expect(page().draftSummary()).not.toBe(before);
  });

  it('adds both halves of a split day to the weekly total', () => {
    const before = page().draftSummary();
    setSession(6, 0, true);
    setSessionTime(6, 0, 'startTime', '09:00');
    setSessionTime(6, 0, 'endTime', '12:00');
    setSession(6, 1, true);
    setSessionTime(6, 1, 'startTime', '13:00');
    setSessionTime(6, 1, 'endTime', '17:00');
    page().save();
    fixture.detectChanges();

    const saturday = session.schedule().find((d) => d.dayOfWeek === 6)!;
    expect(saturday.sessions).toHaveLength(2);
    expect(page().draftSummary()).not.toBe(before);
  });

  it('saves a split week', () => {
    setSessionTime(1, 0, 'startTime', '08:00');
    setSessionTime(1, 0, 'endTime', '11:00');
    setSession(1, 1, true);
    setSessionTime(1, 1, 'startTime', '14:00');
    setSessionTime(1, 1, 'endTime', '18:00');
    page().save();
    fixture.detectChanges();

    const monday = session.schedule().find((d) => d.dayOfWeek === 1)!;
    expect(monday.sessions).toEqual([
      { startTime: '08:00', endTime: '11:00' },
      { startTime: '14:00', endTime: '18:00' },
    ]);
    expect(latestToast()?.tone).toBe('success');
    expect(latestToast()?.message).toContain('this session only');
  });

  it('publishes a day with no sessions worked as closed', () => {
    setSession(3, 1, false);
    page().save();
    fixture.detectChanges();
    expect(session.schedule().find((d) => d.dayOfWeek === 3)!.sessions).toEqual([]);
  });

  it('refuses a session whose end is not after its start', () => {
    setSessionTime(1, 0, 'startTime', '15:00');
    setSessionTime(1, 0, 'endTime', '09:00');
    page().save();
    fixture.detectChanges();

    expect(page().form.invalid).toBe(true);
    expect(latestToast()?.tone).toBe('warning');
    expect(latestToast()?.title).toContain('Nothing saved');
  });

  it('never blames an overlap when the real fault is the times', () => {
    // The inline paragraph is for a fault of the *day* rather than of either
    // input, because `FormField` has nowhere to put it. It used to render
    // whenever the form was invalid for any reason, so a session ending before
    // it starts was reported as "the morning and afternoon sessions cannot
    // overlap" — a claim about a clash that did not exist.
    setSessionTime(1, 0, 'startTime', '15:00');
    setSessionTime(1, 0, 'endTime', '09:00');
    page().save();
    fixture.detectChanges();

    expect(page().form.invalid).toBe(true);
    expect(page().hasOverlapError()).toBe(false);
    expect(host().querySelector('.form-error')).toBeNull();
    // The fault is still reported — on the field it belongs to, and in the toast.
    expect(page().showSessionError(1, 0)).toBe(true);
    expect(latestToast()?.message).toContain('later than the start time');
  });

  it('shows the overlap message only when the sessions really do clash', () => {
    setSession(1, 1, true);
    setSessionTime(1, 0, 'startTime', '09:00');
    setSessionTime(1, 0, 'endTime', '14:00');
    setSessionTime(1, 1, 'startTime', '13:00');
    page().save();
    fixture.detectChanges();

    expect(page().hasOverlapError()).toBe(true);
    expect(host().querySelector('.form-error')?.textContent).toContain('cannot overlap');
  });

  it('never blames an overlap on the dated form either', () => {
    setDate(on(7));
    setDatedTime(0, 'startTime', '15:00');
    setDatedTime(0, 'endTime', '09:00');
    page().saveDated();
    fixture.detectChanges();

    expect(page().hasDatedOverlapError()).toBe(false);
    expect(latestToast()?.message).toContain('later than the start time');
  });

  it('points the picker at the hint that explains the week', () => {
    // The hint sits beside the control and says what the week already does; a
    // screen reader has to be told it is there.
    setDate(nextWeekday(3));
    expect(page().weeklyBaseline()).toBeTruthy();
    const trigger = host().querySelector('#dated-date');
    expect(trigger?.getAttribute('aria-describedby')).toBe(page().datedHelpId);
  });

  it('shows the error on a session that was touched, not before', () => {
    setSessionTime(1, 0, 'startTime', '15:00');
    setSessionTime(1, 0, 'endTime', '09:00');
    expect(page().showSessionError(1, 0)).toBe(false);

    page().save();
    fixture.detectChanges();
    expect(page().showSessionError(1, 0)).toBe(true);
  });

  it('refuses a day whose two sessions overlap', () => {
    // Two blocks that claim the same time cannot both be true, and saving them
    // would produce a day whose openings and closings contradict each other.
    const mondayBefore = session.schedule().find((d) => d.dayOfWeek === 1)!.sessions;
    setSession(1, 1, true);
    setSessionTime(1, 0, 'startTime', '09:00');
    setSessionTime(1, 0, 'endTime', '14:00');
    setSessionTime(1, 1, 'startTime', '13:00');
    setSessionTime(1, 1, 'endTime', '17:00');
    page().save();
    fixture.detectChanges();

    expect(page().showOverlapError(1)).toBe(true);
    expect(latestToast()?.message).toContain('cannot overlap');
    // The published week is untouched, which is the whole claim. Compared
    // against the fixture rather than against a literal, because Monday's
    // afternoon already starts at 13:00 and a literal could not tell an
    // unchanged store from a wrongly-saved one.
    expect(session.schedule().find((d) => d.dayOfWeek === 1)!.sessions).toEqual(mondayBefore);
  });

  it('allows the ordinary split pair that merely touches at the boundary', () => {
    // Half-open: a morning ending at 12:00 and an afternoon starting at 12:00 is
    // the normal shape of a split day, and refusing it would make this form
    // unusable for the thing it exists to express.
    setSession(1, 1, true);
    setSessionTime(1, 0, 'endTime', '12:00');
    setSessionTime(1, 1, 'startTime', '12:00');
    expect(page().showOverlapError(1)).toBe(false);

    page().save();
    fixture.detectChanges();
    expect(latestToast()?.tone).toBe('success');
  });

  it('does not validate a session that is switched off', () => {
    // An unused afternoon must not block a perfectly good morning.
    setSession(1, 1, false);
    setSessionTime(1, 1, 'startTime', '15:00');
    setSessionTime(1, 1, 'endTime', '09:00');
    expect(page().form.valid).toBe(true);

    page().save();
    expect(latestToast()?.tone).toBe('success');
  });

  it('actually disables a switched-off session rather than only dimming it', () => {
    // A `[disabled]` attribute bound to a reactive form input is read once, so
    // toggling would otherwise leave the inputs editable while looking closed.
    setSession(1, 1, false);
    expect(page().sessionRow(1, 1).get('startTime').disabled).toBe(true);

    setSession(1, 1, true);
    expect(page().sessionRow(1, 1).get('startTime').disabled).toBe(false);
  });

  it('keeps a switched-off session hours for when it is switched on again', () => {
    setSessionTime(1, 1, 'startTime', '15:30');
    setSession(1, 1, false);
    setSession(1, 1, true);
    expect(page().sessionRow(1, 1).getRawValue().startTime).toBe('15:30');
  });

  it('ignores an invalid session in the draft total rather than counting it backwards', () => {
    const before = page().draftSummary();
    setSessionTime(1, 0, 'startTime', '15:00');
    setSessionTime(1, 0, 'endTime', '09:00');
    expect(page().draftSummary()).not.toContain('-');
    expect(page().draftSummary()).not.toBe(before);
  });

  it('restores the published week on reset', () => {
    const monday = session.schedule().find((d) => d.dayOfWeek === 1)!;
    setSessionTime(1, 0, 'startTime', '08:00');
    page().reset();
    fixture.detectChanges();
    expect(page().sessionRow(1, 0).getRawValue().startTime).toBe(monday.sessions[0].startTime);
  });

  it('discards an unsaved edit without touching the published week', () => {
    setSessionTime(1, 0, 'endTime', '23:00');
    page().reset();
    expect(session.schedule().find((d) => d.dayOfWeek === 1)!.sessions[0].endTime).not.toBe(
      '23:00',
    );
  });

  it('says the change is not persisted', () => {
    expect(text()).toContain('Sample data');
  });

  it('warns that moving a day does not move its bookings', () => {
    expect(text()).toContain('does not move the appointments already booked');
  });

  it('explains how a split day is expressed, so two sessions are not a puzzle', () => {
    expect(text()).toContain('Work a split day');
  });

  // --- Dated exceptions

  describe('one-off dates', () => {
    it('bounds the picker to today, so a past date cannot be chosen', () => {
      // The picker disables days before today, and the store still refuses one —
      // both asserted, because a rule enforced only in the UI is not a rule.
      const trigger = host().querySelector<HTMLButtonElement>('#dated-date')!;
      expect(page().today).toBe(on(0));

      trigger.click();
      fixture.detectChanges();
      const cells = [...host().querySelectorAll('.ui-date-picker__cell')];
      const today = cells.filter((c) => c.classList.contains('is-today'))[0];
      expect(today).toBeTruthy();
      expect(today!.classList.contains('is-disabled')).toBe(false);

      // Everything before today in the grid is disabled rather than merely
      // greyed, so it cannot be clicked at all.
      const before = cells.filter(
        (c) => c.getAttribute('id')! < (today!.getAttribute('id') as string),
      );
      expect(before.length).toBeGreaterThan(0);
      for (const cell of before) expect(cell.classList.contains('is-disabled')).toBe(true);
    });

    it('marks the dates that already carry an exception', () => {
      // The reason this picker exists rather than the browser's: on a page whose
      // whole job is overriding dates, the first question is which nearby dates
      // have already been dealt with.
      //
      // Compared against the exceptions inside the month on screen, not against
      // all of them. The grid shows one month at a time and the fixture dates are
      // 9, 16 and 23 days out from whatever day the suite runs on, so from late
      // in a month the exceptions fall into the following one and are not on
      // screen. Counting them all made this fail on 343 of 730 days across 2026
      // and 2027 while the picker behaved correctly throughout.
      //
      // On a month end the first month can hold none of them at all — every
      // fixture lands in the next month — so this asserts that what IS on screen
      // is marked, and makes no claim that anything is on screen. The next test
      // is where "every exception is reachable and marked" is asserted.
      host().querySelector<HTMLButtonElement>('#dated-date')!.click();
      fixture.detectChanges();

      const onScreen = new Set(
        [...host().querySelectorAll('.ui-date-picker__cell')].map((c) => cellKey(c as HTMLElement)),
      );
      const expected = session
        .datedAvailability()
        .map((e) => e.date)
        .filter((date) => onScreen.has(date));

      const marked = [...host().querySelectorAll('.ui-date-picker__cell.is-marked')].map((c) =>
        cellKey(c as HTMLElement),
      );
      expect(marked.sort()).toEqual([...expected].sort());
      expect(page().markedDates()).toEqual(session.datedAvailability().map((e) => e.date));
    });

    it('reaches every exception by stepping the month, and marks it there', () => {
      // The other half of the test above, and the one that holds on every day of
      // the year: an exception the displayed month does not reach is not dropped,
      // it is one click of the month arrow away. This is also what proves the
      // first test is not passing vacuously — it compares against all of them.
      host().querySelector<HTMLButtonElement>('#dated-date')!.click();
      fixture.detectChanges();

      const expected = session.datedAvailability().map((e) => e.date);
      expect(expected.length).toBeGreaterThan(0);

      const seen = new Set<string>();

      // One step is enough for the fixtures' furthest date, and two is allowed so
      // a fixture reaching further still gets its month opened rather than failing
      // on a bound the test picked.
      for (let step = 0; step < 3; step += 1) {
        for (const date of session.datedAvailability().map((e) => e.date)) {
          const cell = host().querySelector<HTMLElement>(
            `[id$="-day-${date}"].ui-date-picker__cell`,
          );
          if (cell) expect(cell.classList.contains('is-marked')).toBe(true);
        }

        const marked = [...host().querySelectorAll('.ui-date-picker__cell.is-marked')].map((c) =>
          cellKey(c as HTMLElement),
        );
        for (const date of marked) seen.add(date);
        if (seen.size === expected.length) break;

        host()
          .querySelector<HTMLButtonElement>('.ui-date-picker__step[aria-label="Next month"]')!
          .click();
        fixture.detectChanges();
      }

      expect([...seen].sort()).toEqual([...expected].sort());
    });

    it('offers the same two sessions as the weekly form', () => {
      // A split week and a split exception described in different words would be
      // the kind of drift that ends with two answers to "what are your hours".
      expect(page().dated.controls.sessions.controls.length).toBe(2);
    });

    it('publishes a date with a single session', () => {
      const key = on(7);
      setDate(key);
      setDatedSession(1, false);
      setDatedTime(0, 'startTime', '14:00');
      setDatedTime(0, 'endTime', '18:00');
      page().saveDated();
      fixture.detectChanges();

      expect(session.datedAvailability().find((e) => e.date === key)!.sessions).toEqual([
        { startTime: '14:00', endTime: '18:00' },
      ]);
      expect(latestToast()?.tone).toBe('success');
      expect(latestToast()?.message).toContain('this session only');
    });

    it('publishes a split date, the way a split week is published', () => {
      const key = on(7);
      setDate(key);
      setDatedSession(0, true);
      setDatedTime(0, 'startTime', '09:00');
      setDatedTime(0, 'endTime', '12:00');
      setDatedSession(1, true);
      setDatedTime(1, 'startTime', '13:00');
      setDatedTime(1, 'endTime', '17:00');
      page().saveDated();
      fixture.detectChanges();

      expect(session.datedAvailability().find((e) => e.date === key)!.sessions).toHaveLength(2);
    });

    it('publishes a closed date, which is the reason this exists', () => {
      const key = on(7);
      setDate(key);
      setDatedSession(0, false);
      setDatedSession(1, false);
      page().saveDated();
      fixture.detectChanges();

      expect(session.datedAvailability().find((e) => e.date === key)!.sessions).toEqual([]);
      expect(latestToast()?.message).toContain('is closed');
    });

    it('says what the week already says, so an exception reads as a difference', () => {
      setDate(nextWeekday(3));
      expect(page().baselineHint()).toContain('That Wednesday is usually');
    });

    it('clears the form after a save, ready for the next date', () => {
      setDate(on(7));
      page().saveDated();
      fixture.detectChanges();
      expect(page().dated.get('date').value).toBe('');
      expect(page().isEditingDate()).toBe(false);
    });

    it('disables the hours of a switched-off session rather than only dimming them', () => {
      setDatedSession(0, false);
      expect(page().datedSessionRow(0).get('startTime').disabled).toBe(true);
      setDatedSession(0, true);
      expect(page().datedSessionRow(0).get('startTime').disabled).toBe(false);
    });

    it('refuses a dated entry whose sessions overlap', () => {
      setDate(on(7));
      setDatedSession(0, true);
      setDatedTime(0, 'startTime', '09:00');
      setDatedTime(0, 'endTime', '14:00');
      setDatedSession(1, true);
      setDatedTime(1, 'startTime', '13:00');
      setDatedTime(1, 'endTime', '17:00');
      page().saveDated();
      fixture.detectChanges();

      expect(page().showDatedOverlapError()).toBe(true);
      expect(latestToast()?.message).toContain('cannot overlap');
      expect(session.datedAvailability().some((e) => e.date === on(7))).toBe(false);
    });

    it('asks for a date before it will publish anything', () => {
      page().saveDated();
      fixture.detectChanges();
      expect(latestToast()?.tone).toBe('warning');
      expect(latestToast()?.message).toContain('Choose the date');
    });

    it('says why a date in the past was refused rather than just failing', () => {
      // The input holds a perfectly good date, so this is not a field error —
      // it is a rule about time, and the sentence has to say which.
      setDate(on(-2));
      page().saveDated();
      fixture.detectChanges();
      expect(latestToast()?.tone).toBe('warning');
      expect(latestToast()?.message).toContain('already passed');
    });

    it('loads an entry back to edit it, and says it is editing rather than adding', () => {
      const entry = session.datedAvailability().find((e) => e.sessions.length > 1)!;
      page().editDated(entry);
      fixture.detectChanges();

      expect(page().editingDate()).toBe(entry.date);
      expect(page().dated.get('date').value).toBe(entry.date);
      expect(page().datedSubmitLabel()).toBe('Update this date');
      expect(text()).toContain('Cancel');
    });

    it('puts a saved session in the slot its time of day belongs to', () => {
      // The fixture is a single afternoon block running past the usual close.
      // Loading it by array position put it in the Morning box, so the form read
      // "Morning 1:00 PM – 9:00 PM" and saving it published an afternoon clinic
      // as a morning one.
      const evening = session.datedAvailability().find((e) => e.sessions.length === 1)!;
      expect(evening.sessions[0].startTime).toBe('13:00');

      page().editDated(evening);
      fixture.detectChanges();

      expect(page().isDatedSessionOn(0)).toBe(false);
      expect(page().isDatedSessionOn(1)).toBe(true);
      expect(page().datedSessionRow(1).getRawValue().startTime).toBe('13:00');
    });

    it('puts a saved session back where it was, so an edit round-trips', () => {
      const evening = session.datedAvailability().find((e) => e.sessions.length === 1)!;
      page().editDated(evening);
      setDatedTime(1, 'endTime', '22:00');
      page().saveDated();
      fixture.detectChanges();

      const saved = session.datedAvailability().find((e) => e.date === evening.date)!;
      expect(saved.sessions).toEqual([{ startTime: '13:00', endTime: '22:00' }]);
    });

    it('switches on exactly as many sessions as the saved entry has', () => {
      const split = session.datedAvailability().find((e) => e.sessions.length > 1)!;
      page().editDated(split);
      fixture.detectChanges();

      expect(page().isDatedSessionOn(0)).toBe(true);
      expect(page().isDatedSessionOn(1)).toBe(true);
      expect(page().datedSessionRow(0).getRawValue().startTime).toBe(split.sessions[0].startTime);
    });

    it('shows a closed entry as neither session worked', () => {
      const closed = session.datedAvailability().find((e) => e.sessions.length === 0)!;
      page().editDated(closed);
      fixture.detectChanges();

      expect(page().isDatedSessionOn(0)).toBe(false);
      expect(page().isDatedSessionOn(1)).toBe(false);
      expect(page().isDateOpen()).toBe(false);
    });

    it('updates the same date when editing, rather than adding a second one', () => {
      const entry = session.datedAvailability()[0];
      const before = session.datedAvailability().length;
      page().editDated(entry);
      setDatedTime(0, 'endTime', '21:30');
      page().saveDated();
      fixture.detectChanges();

      expect(session.datedAvailability().length).toBe(before);
      expect(session.datedAvailability().filter((e) => e.date === entry.date).length).toBe(1);
      expect(latestToast()?.title).toBe('Date updated');
    });

    it('abandons the edit on cancel, without touching what was published', () => {
      const entry = session.datedAvailability()[0];
      const original = entry.sessions[0]?.endTime;
      page().editDated(entry);
      setDatedTime(0, 'endTime', '23:00');
      page().resetDated();
      fixture.detectChanges();

      expect(page().editingDate()).toBeNull();
      const saved = session.datedAvailability().find((e) => e.date === entry.date)!;
      expect(saved.sessions[0]?.endTime).toBe(original);
    });

    it('puts a date back on the weekly hours when the exception is removed', () => {
      const key = on(11);
      const weekly = session.sessionsOn(parseDayKey(key)!);
      setDate(key);
      setDatedSession(0, false);
      setDatedSession(1, false);
      page().saveDated();
      fixture.detectChanges();

      const entry = session.datedAvailability().find((e) => e.date === key)!;
      page().clearDated(entry);
      fixture.detectChanges();

      expect(session.sessionsOn(parseDayKey(key)!)).toEqual(weekly);
      expect(latestToast()?.title).toBe('Date removed');
      // Says it is back on the weekly hours, because "removed" otherwise reads
      // as though the day itself was deleted.
      expect(latestToast()?.message).toContain('back to your weekly hours');
    });

    it('does not ask before removing, but does say what it did', () => {
      // Removing an exception is not the same kind of act as cancelling a
      // patient, so there is no dialog — but it is still reported.
      page().clearDated(session.datedAvailability()[0]);
      fixture.detectChanges();

      expect(host().querySelector('dialog')).toBeNull();
      expect(latestToast()?.tone).toBe('info');
    });

    it('reports honestly when there is nothing to remove', () => {
      page().clearDated({ date: on(60), sessions: [] });
      fixture.detectChanges();
      // An error rather than a success: the click did not do what it said.
      expect(latestToast()?.tone).toBe('error');
      expect(latestToast()?.title).toBe('Nothing to remove');
    });

    it('shows what each published exception says about that day', () => {
      const closed = session.datedAvailability().find((e) => e.sessions.length === 0)!;
      const split = session.datedAvailability().find((e) => e.sessions.length > 1)!;
      expect(text()).toContain('Closed all day');
      expect(page().describeSessions(split.sessions).split(',').length).toBe(2);
      expect(closed.date).toBeTruthy();
    });

    it('leaves the weekly total unchanged, because a dated hour is not a weekly one', () => {
      const before = page().published();
      setDate(on(7));
      page().saveDated();
      fixture.detectChanges();
      expect(page().published()).toBe(before);
    });

    it('leaves appointments alone, which is the Secretary decision not this one', () => {
      const before = session
        .appointments()
        .map((a) => `${a.id}:${a.status}`)
        .join('|');
      setDate(on(7));
      page().saveDated();
      fixture.detectChanges();
      expect(
        session
          .appointments()
          .map((a) => `${a.id}:${a.status}`)
          .join('|'),
      ).toBe(before);
    });

    it('says so when there is nothing except the weekly pattern', () => {
      session.datedAvailability().forEach((e) => session.clearDatedAvailability(e.date));
      fixture.detectChanges();
      expect(text()).toContain('No one-off dates yet');
    });

    it('says a dated entry replaces that weekday, which is what makes it an override', () => {
      expect(text()).toContain('replaces that weekday');
    });

    it('shows the date that was chosen, on whichever side of the date line it is', () => {
      // `DatePipe` parses a bare `YYYY-MM-DD` as UTC and prints it in local time,
      // so rendering one through it showed the day *before* the one published for
      // anyone west of Greenwich. The date is built locally instead, and this
      // holds the two derivations together so they cannot drift apart again.
      for (const offset of [1, 2, 9, 23, 40]) {
        const key = on(offset);
        const date = new Date(`${key}T00:00:00`);
        const expected = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
        const month = [
          'Jan',
          'Feb',
          'Mar',
          'Apr',
          'May',
          'Jun',
          'Jul',
          'Aug',
          'Sep',
          'Oct',
          'Nov',
          'Dec',
        ][date.getMonth()];
        expect(page().formatDate(key)).toBe(`${expected}, ${month} ${date.getDate()}`);
      }
    });
  });
});
