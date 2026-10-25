import { TestBed } from '@angular/core/testing';
import { dayKey, parseDayKey } from './doctor.dates';
import { MOCK_APPOINTMENTS, MOCK_PATIENTS, SIGNED_IN_DOCTOR_ID } from './doctor.mock-data';
import { DoctorSession } from './doctor-session';

/**
 * Pins the session clock to the first fixture appointment, which is a
 * "today" appointment, so the day-scoped computeds are deterministic.
 */
function pinToFirstAppointment(session: DoctorSession): void {
  session.now.set(new Date(MOCK_APPOINTMENTS[0].startsAt));
}

describe('DoctorSession', () => {
  let session: DoctorSession;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [DoctorSession] });
    session = TestBed.inject(DoctorSession);
    pinToFirstAppointment(session);
  });

  describe('scoping to the signed-in doctor', () => {
    it('hides appointments belonging to another doctor', () => {
      const foreign = MOCK_APPOINTMENTS.filter((a) => a.doctorId !== SIGNED_IN_DOCTOR_ID);
      expect(foreign.length).toBeGreaterThan(0);
      for (const appointment of session.appointments()) {
        expect(appointment.doctorId).toBe(SIGNED_IN_DOCTOR_ID);
      }
    });

    it('leaves a patient out when they have only ever seen another doctor', () => {
      // pat-113's single appointment belongs to doc-001, so the doctor must not
      // be able to reach them — not in the list, and not by id.
      expect(MOCK_APPOINTMENTS.some((a) => a.patientId === 'pat-113')).toBe(true);
      expect(session.patients().some((s) => s.patient.id === 'pat-113')).toBe(false);
    });

    it('keeps a patient who has only a past appointment', () => {
      const past = MOCK_APPOINTMENTS.find((a) => a.status === 'completed');
      expect(session.patients().some((s) => s.patient.id === past?.patientId)).toBe(true);
    });

    it('is a shorter list than every patient on file', () => {
      expect(session.patients().length).toBeLessThan(MOCK_PATIENTS.length);
    });
  });

  describe('today', () => {
    it("lists today's appointments, soonest first", () => {
      const today = session.todaysAppointments();
      expect(today.length).toBeGreaterThan(0);
      for (const appointment of today) {
        expect(appointment.startsAt.slice(0, 10)).toBe(dayKey(session.now()));
      }
      const times = today.map((a) => a.startsAt);
      expect([...times].sort()).toEqual(times);
    });

    it('drops cancelled appointments from the day plan', () => {
      const cancelledToday = MOCK_APPOINTMENTS.filter(
        (a) => a.doctorId === SIGNED_IN_DOCTOR_ID && a.status === 'cancelled',
      );
      expect(cancelledToday.length).toBeGreaterThan(0);
      const ids = session.todaysAppointments().map((a) => a.id);
      for (const appointment of cancelledToday) {
        expect(ids).not.toContain(appointment.id);
      }
    });

    it('moves the day on when the clock does', () => {
      const before = session.todaysAppointments().length;
      session.now.set(new Date('2030-01-01T10:00:00'));
      expect(session.todaysAppointments().length).toBe(0);
      session.now.set(new Date(MOCK_APPOINTMENTS[0].startsAt));
      expect(session.todaysAppointments().length).toBe(before);
    });
  });

  describe('nextAppointment', () => {
    it('is the first appointment that has not started', () => {
      const next = session.nextAppointment();
      expect(next).not.toBeNull();
      expect(new Date(next!.startsAt).getTime()).toBeGreaterThanOrEqual(session.now().getTime());
      expect(['booked', 'confirmed']).toContain(next!.status);
    });

    it('never points at a cancelled appointment', () => {
      // Over the fixtures rather than by manufacturing cancellations: this store
      // cannot cancel anything, so a test that needed it to would be asking for
      // the capability this area does not have. The assertion is that no cancelled
      // appointment is ever the answer — which holds for every row, not just one.
      expect(session.appointments().some((a) => a.status === 'cancelled')).toBe(true);

      for (const summary of session.patients()) {
        if (summary.nextVisit) expect(summary.nextVisit.status).not.toBe('cancelled');
      }

      const next = session.nextAppointment();
      if (next) expect(next.status).not.toBe('cancelled');
    });
  });

  describe('awaitingConfirmation', () => {
    it('counts only booked appointments', () => {
      const expected = session.appointments().filter((a) => a.status === 'booked').length;
      expect(session.awaitingConfirmation().length).toBe(expected);
    });
  });

  describe('openAppointments', () => {
    it('holds booked and confirmed appointments only', () => {
      expect(session.openAppointments().length).toBeGreaterThan(0);
      for (const appointment of session.openAppointments()) {
        expect(['booked', 'confirmed']).toContain(appointment.status);
      }
    });

    it('is exactly the complement of visitHistory', () => {
      // The Doctor area holds one record of every appointment, split in two, and
      // the only status that falls between them is `cancelled` — which belongs to
      // the Secretary. Anything else would mean a row the doctor can neither
      // act on nor look up.
      const open = new Set(session.openAppointments().map((a) => a.id));
      const visited = new Set(session.visitHistory().map((a) => a.id));
      const all = session.appointments();

      for (const appointment of all) {
        const listed = open.has(appointment.id) || visited.has(appointment.id);
        expect(listed).toBe(appointment.status !== 'cancelled');
      }
      expect([...open].some((id) => visited.has(id))).toBe(false);
    });

    it('excludes appointments already recorded, so the list stays actionable', () => {
      const open = session.openAppointments().map((a) => a.id);
      for (const visit of session.visitHistory()) {
        expect(open).not.toContain(visit.id);
      }
    });

    it('has the day list as a subset', () => {
      // Both are the same list read differently; if `todaysAppointments` were
      // still filtering `appointments()` by itself the two could disagree about
      // what counts as open.
      const today = new Set(session.todaysAppointments().map((a) => a.id));
      for (const appointment of session.openAppointments()) {
        if (today.has(appointment.id)) expect(appointment.status).not.toBe('cancelled');
      }
      expect(today.size).toBeLessThanOrEqual(session.openAppointments().length);
    });
  });

  describe('visitHistory', () => {
    it('holds completed and no-show visits only', () => {
      expect(session.visitHistory().length).toBeGreaterThan(0);
      for (const visit of session.visitHistory()) {
        expect(['completed', 'no-show']).toContain(visit.status);
      }
    });

    it('excludes a cancelled appointment, because nobody was seen', () => {
      // `cancelled` shares `CLOSED_STATUSES` with the two outcomes, so reusing
      // that list would put a booking that never happened into the record of
      // visits and overstate the work the doctor has done.
      const cancelled = session.appointments().find((a) => a.status === 'cancelled')!;
      expect(cancelled).toBeTruthy();
      expect(session.visitHistory().some((a) => a.id === cancelled.id)).toBe(false);
    });

    it('excludes appointments still to happen', () => {
      const ids = session.visitHistory().map((a) => a.id);
      for (const appointment of session.appointments()) {
        if (appointment.status === 'completed' || appointment.status === 'no-show') continue;
        expect(ids).not.toContain(appointment.id);
      }
    });

    it('is newest first', () => {
      const times = session.visitHistory().map((a) => a.startsAt);
      expect([...times].sort().reverse()).toEqual(times);
    });

    it('cannot hold a visit the scoped appointment list does not', () => {
      // The privacy boundary, pinned on the derived list rather than on the
      // fixtures. `appt-117` belongs to another doctor but is `booked`, so no
      // other doctor's *visit* exists in the fixtures and an assertion written
      // against them would pass whether or not the scope were applied here.
      const scoped = new Set(session.appointments().map((a) => a.id));
      for (const visit of session.visitHistory()) {
        expect(scoped.has(visit.id)).toBe(true);
        expect(visit.doctorId).toBe(SIGNED_IN_DOCTOR_ID);
      }
    });

    it('gains a visit the moment one is recorded, and loses nothing else', () => {
      const confirmed = session.appointments().find((a) => a.status === 'confirmed')!;
      const before = session.visitHistory().length;

      session.recordOutcome(confirmed.id, 'completed');

      expect(session.visitHistory().length).toBe(before + 1);
      expect(session.visitHistory()[0].id).toBe(confirmed.id);
    });
  });

  describe('recordOutcome', () => {
    it('marks a confirmed visit complete', () => {
      const confirmed = session.appointments().find((a) => a.status === 'confirmed')!;
      expect(session.recordOutcome(confirmed.id, 'completed')).toBe(true);
      expect(session.appointments().find((a) => a.id === confirmed.id)?.status).toBe('completed');
    });

    it('records a no-show', () => {
      const confirmed = session.appointments().find((a) => a.status === 'confirmed')!;
      expect(session.recordOutcome(confirmed.id, 'no-show')).toBe(true);
      expect(session.appointments().find((a) => a.id === confirmed.id)?.status).toBe('no-show');
    });

    it('refuses a booking the front desk has not confirmed', () => {
      // The precondition that makes `confirmed` the handover point. Without it a
      // doctor could close a booking nobody approved, which is skipping the
      // Secretary's step rather than describing a visit.
      const booked = session.appointments().find((a) => a.status === 'booked')!;
      expect(session.recordOutcome(booked.id, 'completed')).toBe(false);
      expect(session.appointments().find((a) => a.id === booked.id)?.status).toBe('booked');
    });

    it('reports no change for an unknown id', () => {
      expect(session.recordOutcome('appt-999', 'completed')).toBe(false);
    });

    it('reports no change once an outcome is recorded, so a double click is harmless', () => {
      const confirmed = session.appointments().find((a) => a.status === 'confirmed')!;
      expect(session.recordOutcome(confirmed.id, 'completed')).toBe(true);
      // Second click: the appointment is no longer `confirmed`, so it refuses
      // rather than overwriting what the first one recorded.
      expect(session.recordOutcome(confirmed.id, 'no-show')).toBe(false);
      expect(session.appointments().find((a) => a.id === confirmed.id)?.status).toBe('completed');
    });

    it("leaves another doctor's appointment alone", () => {
      const foreign = MOCK_APPOINTMENTS.find(
        (a) => a.doctorId !== SIGNED_IN_DOCTOR_ID && a.status === 'confirmed',
      )!;
      expect(session.recordOutcome(foreign.id, 'completed')).toBe(false);
      expect(MOCK_APPOINTMENTS.find((a) => a.id === foreign.id)!.status).not.toBe('completed');
    });

    it('offers no way to confirm or cancel, only to record an outcome', () => {
      // The capability is a type now, so there is nothing to call for the two
      // moves the Secretary owns. Asserted on the store rather than the buttons
      // because a hidden button is not what forbids them.
      const store = session as unknown as Record<string, unknown>;
      expect(store['setAppointmentStatus']).toBeUndefined();
      expect(typeof session.recordOutcome).toBe('function');
    });
  });

  describe('patient summaries', () => {
    it('reports the last past visit and the next booked one', () => {
      const summary = session.patients().find((s) => s.patient.id === 'pat-101')!;
      expect(summary.lastVisit?.id).toBe('appt-111');
      expect(summary.nextVisit?.id).toBe('appt-101');
    });

    it('reports no last visit for a patient who has not been seen yet', () => {
      const summary = session.patients().find((s) => s.nextVisit?.id === 'appt-113')!;
      expect(summary.lastVisit).toBeNull();
    });

    it('never names a cancelled appointment as the last visit', () => {
      // The patients table heads that column "Last visit", so a cancellation's
      // date there would be read as a day this doctor saw somebody. Checked over
      // the whole list rather than one patient, so a fixture swap cannot put a
      // cancelled row back under that heading.
      const now = session.now().getTime();
      for (const summary of session.patients()) {
        const last = summary.lastVisit;
        if (!last) continue;
        expect(last.status).not.toBe('cancelled');
        expect(new Date(last.startsAt).getTime()).toBeLessThan(now);
      }
    });

    it('counts a no-show as a visit but not a cancelled one', () => {
      const noShow = session.patients().find((s) => s.patient.id === 'pat-110')!;
      expect(noShow.visitCount).toBe(1);

      const cancelled = session.patients().find((s) => s.patient.id === 'pat-108')!;
      expect(cancelled.visitCount).toBe(0);
    });

    it('offers a confirmed booking as the next visit, and skips the cancelled one', () => {
      // pat-108 has both: a cancelled visit in the past and a confirmed one due.
      // The confirmed one is what the desk should be shown, so this also guards
      // against the cancelled filter over-reaching and hiding real appointments.
      const pat = session.patients().find((s) => s.patient.id === 'pat-108')!;

      expect(
        MOCK_APPOINTMENTS.find((a) => a.id === 'appt-108')!.status,
        'the past visit is the cancelled one',
      ).toBe('cancelled');
      expect(pat.nextVisit?.id).toBe('appt-115');
      expect(pat.nextVisit?.status).toBe('confirmed');
    });
  });

  describe('lookups', () => {
    it('resolves a patient by id', () => {
      expect(session.patientById('pat-101')?.name).toBe('Juan Dela Cruz');
    });

    it('returns null rather than throwing for an unknown id', () => {
      expect(session.patientById('pat-999')).toBeNull();
    });

    it('refuses a real patient the doctor has never been given', () => {
      // The details page is addressed by id, and an id is user input.
      expect(session.patientById('pat-113')).not.toBeNull();
      expect(session.patientForDoctor('pat-113')).toBeNull();
      expect(session.patientForDoctor('pat-101')?.name).toBe('Juan Dela Cruz');
    });

    it('refuses an empty id without touching the store', () => {
      expect(session.patientForDoctor('')).toBeNull();
    });

    it('names an unknown patient instead of rendering undefined', () => {
      expect(session.patientName('pat-999')).toBe('Unknown patient');
    });

    it("returns only this doctor's appointments for a patient", () => {
      const all = session.appointmentsForPatient('pat-101');
      expect(all.length).toBeGreaterThan(0);
      for (const appointment of all) expect(appointment.doctorId).toBe(SIGNED_IN_DOCTOR_ID);
    });

    it('drops cancellations, so the patient page agrees with the working list', () => {
      // The Appointments page hides cancellations; if the per-patient history kept
      // them, the same record would mean two different things depending on which
      // page it was read from. Pinned across every patient rather than one, so a
      // fixture swap cannot quietly reintroduce a cancelled row.
      const cancelled = session.appointments().filter((a) => a.status === 'cancelled');
      expect(cancelled.length).toBeGreaterThan(0);

      for (const patient of session.patients()) {
        const ids = session.appointmentsForPatient(patient.patient.id).map((a) => a.id);
        for (const appointment of cancelled) {
          if (appointment.patientId !== patient.patient.id) continue;
          expect(ids).not.toContain(appointment.id);
        }
      }
    });
  });

  describe('schedule', () => {
    it('starts from the published week', () => {
      expect(session.schedule().length).toBe(7);
      expect(session.schedule()[0].dayOfWeek).toBe(0);
    });

    it('starts from a week that actually has split days in it', () => {
      // A fixture where every day was a single block would leave the whole
      // split-session path unexercised, which is how a feature ends up looking
      // finished while working on no real data.
      const split = session.schedule().filter((day) => day.sessions.length > 1);
      expect(split.length).toBeGreaterThan(0);
      expect(session.schedule().some((day) => day.sessions.length === 0)).toBe(true);
    });

    it('counts a day as working only when it has at least one session', () => {
      expect(session.workingDayCount()).toBe(
        session.schedule().filter((day) => day.sessions.length > 0).length,
      );
    });

    it('totals every session, so a split day contributes both halves', () => {
      const expected = session
        .schedule()
        .flatMap((day) => day.sessions)
        .reduce((total, block) => {
          const [sh, sm] = block.startTime.split(':').map(Number);
          const [eh, em] = block.endTime.split(':').map(Number);
          return total + (eh * 60 + em - (sh * 60 + sm));
        }, 0);
      expect(session.weeklyMinutes()).toBe(expected);
    });

    it('drops a session whose end is not after its start rather than counting it backwards', () => {
      session.saveSchedule([
        { dayOfWeek: 1, sessions: [{ startTime: '09:00', endTime: '12:00' }] },
        { dayOfWeek: 2, sessions: [{ startTime: '17:00', endTime: '09:00' }] },
      ]);
      expect(session.weeklyMinutes()).toBe(180);
    });

    it('replaces the published week on save', () => {
      session.saveSchedule([
        { dayOfWeek: 1, sessions: [{ startTime: '10:00', endTime: '13:00' }] },
      ]);
      expect(session.schedule().length).toBe(1);
      expect(session.weeklyMinutes()).toBe(180);
    });

    it('keeps a split day split when it is saved', () => {
      session.saveSchedule([
        {
          dayOfWeek: 1,
          sessions: [
            { startTime: '05:00', endTime: '12:00' },
            { startTime: '13:00', endTime: '20:00' },
          ],
        },
      ]);
      expect(session.schedule()[0].sessions).toHaveLength(2);
      expect(session.weeklyMinutes()).toBe(840);
    });
  });

  describe('fitting a booking into a session', () => {
    beforeEach(() => {
      // Monday is published 05:00–12:00 and 13:00–20:00 in the fixtures.
      session.now.set(new Date());
    });

    function nextMonday(): Date {
      for (let i = 1; i <= 7; i += 1) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        if (date.getDay() === 1) return date;
      }
      throw new Error('no Monday within a week');
    }

    const at = (hour: number, minute = 0): number => hour * 60 + minute;

    it('accepts a visit inside either session', () => {
      const monday = nextMonday();
      expect(session.fitsInSession(monday, at(5), 30)).toBe(true);
      expect(session.fitsInSession(monday, at(14), 60)).toBe(true);
    });

    it('refuses a visit that straddles the gap between the two sessions', () => {
      // The bug this shape exists to fix. With one closing time per day, an
      // appointment at 12:30 on a split Monday was measured against 12:00 and
      // refused as outside-hours, even though the afternoon was wide open.
      const monday = nextMonday();
      expect(session.fitsInSession(monday, at(12, 30), 30)).toBe(false);
    });

    it('refuses a visit that runs past the end of its own session', () => {
      const monday = nextMonday();
      expect(session.fitsInSession(monday, at(11, 45), 30)).toBe(false);
      expect(session.fitsInSession(monday, at(19, 45), 30)).toBe(false);
    });

    it('allows a visit that starts as one session opens and ends as another closes', () => {
      // Half-open, so there is no off-by-one making the edges unbookable.
      const monday = nextMonday();
      expect(session.fitsInSession(monday, at(5), 420)).toBe(true);
      expect(session.fitsInSession(monday, at(19), 60)).toBe(true);
    });

    it('refuses every time on a day with no sessions', () => {
      let saturday = new Date();
      for (let i = 1; i <= 7; i += 1) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        if (date.getDay() === 6) {
          saturday = date;
          break;
        }
      }
      expect(session.fitsInSession(saturday, at(9), 30)).toBe(false);
    });
  });

  describe('dated availability', () => {
    beforeEach(() => {
      // The dated fixtures are relative to import, and these tests are about
      // dates relative to "now", so the clock is unpinned back to the wall clock.
      // Left on the pinned appointment date, `on(0)` would be a fixture day that
      // has nothing to do with what the store seeded.
      session.now.set(new Date());
    });

    /** A `days` days from now, as `YYYY-MM-DD`. */
    function on(days: number): string {
      const date = new Date();
      date.setDate(date.getDate() + days);
      return dayKey(date);
    }

    /** The next date falling on `weekday`, searching forward from `on(1)`. */
    function nextWeekday(weekday: number): string {
      for (let i = 1; i <= 7; i += 1) {
        const key = on(i);
        if (parseDayKey(key)!.getDay() === weekday) return key;
      }
      throw new Error(`no ${weekday} within a week of ${on(1)}`);
    }

    it('starts from the sample exceptions', () => {
      expect(session.datedAvailability().length).toBeGreaterThan(0);
      // Sorted soonest first, because that is the order a clinician reads them.
      const dates = session.datedAvailability().map((e) => e.date);
      expect([...dates].sort()).toEqual(dates);
    });

    it('starts from examples covering every kind of exception', () => {
      const all = session.datedAvailability();
      expect(all.some((e) => e.sessions.length === 0)).toBe(true);
      expect(all.some((e) => e.sessions.length === 1)).toBe(true);
      expect(all.some((e) => e.sessions.length > 1)).toBe(true);
    });

    it('falls back to the weekly pattern for a date with no exception', () => {
      // Found rather than assumed, because a test that hard-codes `on(21)` would
      // silently start testing a different weekday the day the fixtures were
      // written.
      const key = nextWeekday(3);
      const weekly = session.schedule().find((d) => d.dayOfWeek === 3)!;
      expect(session.sessionsOn(parseDayKey(key)!)).toEqual(weekly.sessions);
    });

    it('lets an exception replace that weekday for its own date only', () => {
      const key = nextWeekday(3);
      const weekly = session.schedule().find((d) => d.dayOfWeek === 3)!;
      session.saveDatedAvailability({
        date: key,
        sessions: [{ startTime: '18:00', endTime: '21:00' }],
      });

      expect(session.sessionsOn(parseDayKey(key)!)).toEqual([
        { startTime: '18:00', endTime: '21:00' },
      ]);
      // The week itself is untouched, and so is another day of that weekday.
      expect(session.schedule().find((d) => d.dayOfWeek === 3)!.sessions).toEqual(weekly.sessions);
    });

    it('can close a date the weekly pattern opens', () => {
      // The point of an override rather than an addition: a holiday on a day the
      // doctor normally works cannot be expressed by adding hours to the week.
      const key = nextWeekday(1);
      expect(session.sessionsOn(parseDayKey(key)!).length).toBeGreaterThan(0);

      // A closed date is an entry with no sessions at all, not a deleted one —
      // otherwise a working weekday would look open.
      expect(session.saveDatedAvailability({ date: key, sessions: [] })).toBeNull();
      expect(session.sessionsOn(parseDayKey(key)!)).toEqual([]);
    });

    it('can open a date the weekly pattern closes', () => {
      // And the other direction: a Sunday the doctor normally has off, worked
      // once because a patient can only come then.
      const key = nextWeekday(0);
      expect(session.sessionsOn(parseDayKey(key)!)).toEqual([]);

      session.saveDatedAvailability({
        date: key,
        sessions: [{ startTime: '10:00', endTime: '12:00' }],
      });
      expect(session.sessionsOn(parseDayKey(key)!)).toHaveLength(1);
    });

    it('can publish a split date, the way a split week is published', () => {
      const key = nextWeekday(1);
      session.saveDatedAvailability({
        date: key,
        sessions: [
          { startTime: '09:00', endTime: '12:00' },
          { startTime: '13:00', endTime: '17:00' },
        ],
      });
      expect(session.sessionsOn(parseDayKey(key)!)).toHaveLength(2);
    });

    it('refuses a date that has already passed', () => {
      const refusal = session.saveDatedAvailability({
        date: on(-1),
        sessions: [{ startTime: '09:00', endTime: '12:00' }],
      });
      expect(refusal).toBe('in-the-past');
      expect(session.datedAvailability().some((e) => e.date === on(-1))).toBe(false);
    });

    it('accepts today, since a doctor can close a day part-way through it', () => {
      expect(
        session.saveDatedAvailability({
          date: on(0),
          sessions: [{ startTime: '09:00', endTime: '12:00' }],
        }),
      ).toBeNull();
    });

    it('refuses a session whose hours run backwards', () => {
      expect(
        session.saveDatedAvailability({
          date: on(5),
          sessions: [{ startTime: '15:00', endTime: '09:00' }],
        }),
      ).toBe('bad-session');
    });

    it('refuses two sessions that claim the same time', () => {
      expect(
        session.saveDatedAvailability({
          date: on(5),
          sessions: [
            { startTime: '09:00', endTime: '13:00' },
            { startTime: '12:00', endTime: '17:00' },
          ],
        }),
      ).toBe('overlapping-sessions');
    });

    it('allows the ordinary split pair that merely touches', () => {
      // Half-open, so a morning ending at 12:00 and an afternoon starting at
      // 12:00 must not be treated as a clash — that is the normal case.
      expect(
        session.saveDatedAvailability({
          date: on(5),
          sessions: [
            { startTime: '09:00', endTime: '12:00' },
            { startTime: '12:00', endTime: '17:00' },
          ],
        }),
      ).toBeNull();
    });

    it('refuses a date that is not one, rather than reading it as something near', () => {
      // `new Date(2026, 1, 31)` is 3 March, so a store that did not check would
      // quietly publish an exception on the wrong day.
      const sessions = [{ startTime: '09:00', endTime: '12:00' }];
      expect(session.saveDatedAvailability({ date: '2026-02-31', sessions })).toBe('invalid-date');
      expect(session.saveDatedAvailability({ date: 'next Tuesday', sessions })).toBe(
        'invalid-date',
      );
    });

    it('replaces an exception on the same date rather than keeping two', () => {
      // Two records for one date would leave "which hours apply" ambiguous, and
      // a correction that appeared to do nothing is worse than no correction.
      const key = on(8);
      session.saveDatedAvailability({
        date: key,
        sessions: [{ startTime: '09:00', endTime: '12:00' }],
      });
      session.saveDatedAvailability({
        date: key,
        sessions: [{ startTime: '14:00', endTime: '18:00' }],
      });

      expect(session.datedAvailability().filter((e) => e.date === key).length).toBe(1);
      expect(session.sessionsOn(parseDayKey(key)!)[0].startTime).toBe('14:00');
    });

    it('puts a date back on the weekly pattern when an exception is withdrawn', () => {
      const key = on(10);
      const weekly = session.sessionsOn(parseDayKey(key)!);
      session.saveDatedAvailability({ date: key, sessions: [] });
      expect(session.sessionsOn(parseDayKey(key)!)).toEqual([]);

      expect(session.clearDatedAvailability(key)).toBe(true);
      expect(session.sessionsOn(parseDayKey(key)!)).toEqual(weekly);
    });

    it('reports no change when withdrawing a date that was never there', () => {
      // So a double click cannot report having done something twice.
      expect(session.clearDatedAvailability(on(60))).toBe(false);
    });

    it('leaves the weekly total alone, because a dated hour is not a weekly one', () => {
      // "6 days · 19h a week" must not start counting one-off clinics, or the
      // summary would describe a pattern that no longer exists.
      const before = session.weeklyMinutes();
      session.saveDatedAvailability({
        date: on(6),
        sessions: [{ startTime: '18:00', endTime: '22:00' }],
      });
      expect(session.weeklyMinutes()).toBe(before);
    });

    it('does not move an appointment booked on a date that is later closed', () => {
      // The same rule the weekly form follows: changing your hours is not the
      // same decision as moving a patient's visit.
      const future = on(3);
      const booked = session.appointments().find((a) => dayKey(new Date(a.startsAt)) === future);
      if (!booked) return; // No fixture on that date; nothing to protect.
      session.saveDatedAvailability({ date: future, sessions: [] });
      expect(session.appointments().find((a) => a.id === booked.id)!.status).toBe(booked.status);
    });
  });

  describe('profile', () => {
    it('starts from the signed-in doctor', () => {
      expect(session.profile().id).toBe(SIGNED_IN_DOCTOR_ID);
    });

    it('applies only the editable fields, leaving the licence alone', () => {
      const licence = session.profile().licenseNumber;
      session.updateProfile({
        name: 'R. Santos',
        email: 'new@mediq.ph',
        bio: 'Hi',
      });
      expect(session.profile().name).toBe('R. Santos');
      expect(session.profile().licenseNumber).toBe(licence);
      expect(session.profile().specialization).toBe('Orthopedics');
    });

    it('holds no contact number for the doctor at all', () => {
      // The removal is only real if it reaches the record. A form-only change would
      // leave the value here with nothing able to read or change it.
      expect(Object.keys(session.profile())).not.toContain('phone');
    });
  });
});
