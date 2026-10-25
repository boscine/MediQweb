import {
  addDays,
  addMonths,
  dayKey,
  dayLabel,
  dayWindowEndingOn,
  hourLabel,
  monthKey,
  monthLabel,
  parseDayKey,
  startOfDay,
  startOfMonth,
  WEEKDAYS,
  weekdayIndex,
} from './admin.dates';

describe('dayKey', () => {
  it('formats a date as the zero-padded day it falls on', () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(dayKey(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});

describe('startOfDay', () => {
  it('drops the time of day and keeps the calendar day', () => {
    const midnight = startOfDay(new Date(2026, 6, 15, 23, 59, 59, 999));
    expect(midnight).toEqual(new Date(2026, 6, 15));
  });

  it('leaves the date it was given alone', () => {
    const original = new Date(2026, 6, 15, 14, 0);
    startOfDay(original);
    expect(original.getHours()).toBe(14);
  });
});

describe('addDays', () => {
  it('moves forward and backward by calendar days', () => {
    expect(dayKey(addDays(new Date(2026, 0, 31), 1))).toBe('2026-02-01');
    expect(dayKey(addDays(new Date(2026, 0, 1), -1))).toBe('2025-12-31');
  });

  it('crosses a month and a year boundary', () => {
    expect(dayKey(addDays(new Date(2026, 11, 31), 1))).toBe('2027-01-01');
  });

  it('keeps the clock time across a daylight-saving change', () => {
    // A fixed 86,400,000 ms step would land an hour out after a DST boundary,
    // which would put one day in a window twice and drop another. The clocks
    // below are the two that change in most of the world; a step that survives
    // both cannot be a fixed millisecond count.
    const beforeSpring = new Date(2026, 2, 28, 9, 0);
    const afterSpring = addDays(beforeSpring, 1);
    expect(dayKey(afterSpring)).toBe('2026-03-29');
    expect(afterSpring.getHours()).toBe(9);

    const beforeAutumn = new Date(2026, 9, 24, 9, 0);
    const afterAutumn = addDays(beforeAutumn, 30);
    expect(dayKey(afterAutumn)).toBe('2026-11-23');
    expect(afterAutumn.getHours()).toBe(9);
  });

  it('leaves the date it was given alone', () => {
    const original = new Date(2026, 6, 15);
    addDays(original, 5);
    expect(dayKey(original)).toBe('2026-07-15');
  });
});

describe('dayWindowEndingOn', () => {
  it('runs oldest first and ends on the day given', () => {
    const days = dayWindowEndingOn(new Date(2026, 6, 15, 17, 30), 4);
    expect(days.map(dayKey)).toEqual(['2026-07-12', '2026-07-13', '2026-07-14', '2026-07-15']);
  });

  it('includes the end day, so the window is inclusive at both ends', () => {
    const days = dayWindowEndingOn(new Date(2026, 6, 15), 1);
    expect(days).toHaveLength(1);
    expect(dayKey(days[0])).toBe('2026-07-15');
  });

  it('returns nothing for a window of no days', () => {
    expect(dayWindowEndingOn(new Date(2026, 6, 15), 0)).toEqual([]);
  });

  it('crosses a month boundary', () => {
    const days = dayWindowEndingOn(new Date(2026, 2, 1), 3);
    expect(days.map(dayKey)).toEqual(['2026-02-27', '2026-02-28', '2026-03-01']);
  });
});

describe('parseDayKey', () => {
  it('reads a day as local midnight, not UTC', () => {
    // `new Date('2026-07-02')` parses as UTC, which is the previous day for
    // anyone east of Greenwich. A clinic's 2 July is the 2nd wherever it is.
    const parsed = parseDayKey('2026-07-02');
    expect(parsed).toEqual(new Date(2026, 6, 2));
    expect(parsed?.getHours()).toBe(0);
  });

  it('rejects a day the calendar does not have', () => {
    // `new Date(2026, 1, 31)` is not an error, it is 3 March — which would put
    // a registration in the wrong month without anything complaining.
    expect(parseDayKey('2026-02-31')).toBeNull();
    expect(parseDayKey('2026-13-01')).toBeNull();
    expect(parseDayKey('2026-00-10')).toBeNull();
  });

  it('rejects anything that is not a plain day', () => {
    expect(parseDayKey('')).toBeNull();
    expect(parseDayKey('soon')).toBeNull();
    expect(parseDayKey('2026-07-02T09:00:00')).toBeNull();
    expect(parseDayKey('02/07/2026')).toBeNull();
  });

  it('round-trips a day through dayKey', () => {
    expect(dayKey(parseDayKey('2026-02-28')!)).toBe('2026-02-28');
  });

  it('accepts a real leap day and rejects a fake one', () => {
    expect(parseDayKey('2028-02-29')).not.toBeNull();
    expect(parseDayKey('2026-02-29')).toBeNull();
  });
});

describe('monthKey', () => {
  it('formats a date as the month it falls in', () => {
    expect(monthKey(new Date(2026, 0, 31))).toBe('2026-01');
    expect(monthKey(new Date(2026, 9, 1))).toBe('2026-10');
  });
});

describe('startOfMonth', () => {
  it('lands on the first of the month at midnight', () => {
    expect(startOfMonth(new Date(2026, 6, 15, 22, 0))).toEqual(new Date(2026, 6, 1));
  });
});

describe('addMonths', () => {
  it('moves forward and backward by months', () => {
    expect(monthKey(addMonths(startOfMonth(new Date(2026, 0, 15)), 1))).toBe('2026-02');
    expect(monthKey(addMonths(startOfMonth(new Date(2026, 0, 15)), -1))).toBe('2025-12');
  });

  it('crosses a year boundary', () => {
    expect(monthKey(addMonths(startOfMonth(new Date(2026, 11, 15)), 1))).toBe('2027-01');
  });

  it('lands on the first, so a month counter cannot skip a short month', () => {
    // Rolling the 31st forward by one month gives 3 March in most engines, which
    // would step the bar chart over February entirely.
    expect(addMonths(new Date(2026, 0, 31), 1)).toEqual(new Date(2026, 1, 1));
  });

  it('walks every month of a long span without repeating or skipping one', () => {
    const keys: string[] = [];
    for (
      let cursor = new Date(2024, 0, 1);
      cursor <= new Date(2026, 0, 1);
      cursor = addMonths(cursor, 1)
    ) {
      keys.push(monthKey(cursor));
    }
    expect(keys).toHaveLength(25);
    expect(new Set(keys).size).toBe(25);
    expect(keys).toContain('2024-02');
    expect(keys).toContain('2026-01');
  });
});

describe('monthLabel', () => {
  it('names the month and the year, which stays unambiguous across years', () => {
    expect(monthLabel(new Date(2025, 8, 19))).toBe('Sep 25');
    expect(monthLabel(new Date(2026, 0, 1))).toBe('Jan 26');
  });
});

describe('dayLabel', () => {
  it('names the day and the month', () => {
    expect(dayLabel(new Date(2026, 6, 2))).toBe('2 Jul');
    expect(dayLabel(new Date(2026, 9, 24))).toBe('24 Oct');
  });
});

describe('hourLabel', () => {
  it('zero-pads the hour', () => {
    expect(hourLabel(8)).toBe('08:00');
    expect(hourLabel(16)).toBe('16:00');
    expect(hourLabel(0)).toBe('00:00');
  });
});

describe('weekdayIndex', () => {
  it('starts the week on Monday, not Sunday', () => {
    // 15 July 2026 is a Wednesday, the third day of a working week.
    expect(weekdayIndex(new Date(2026, 6, 13))).toBe(0);
    expect(weekdayIndex(new Date(2026, 6, 14))).toBe(1);
    expect(weekdayIndex(new Date(2026, 6, 15))).toBe(2);
  });

  it('puts Sunday last', () => {
    expect(weekdayIndex(new Date(2026, 6, 19))).toBe(6);
  });

  it('indexes into WEEKDAYS for every day of a full week', () => {
    // A week starting Monday 13 July 2026.
    const names = Array.from(
      { length: 7 },
      (_, offset) => WEEKDAYS[weekdayIndex(new Date(2026, 6, 13 + offset))],
    );
    expect(names).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });
});
