import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { DAY_NAMES, formatDuration } from '../../secretary.dates';
import { MOCK_DOCTORS, MOCK_SECRETARY_PROFILE } from '../../secretary.mock-data';
import { SecretarySession } from '../../secretary-session';
import { pinToDeskDay } from '../../secretary.spec-helpers';
import { SecretarySchedules } from './secretary-schedules';

describe('SecretarySchedules', () => {
  /** The one doctor whose week this page shows. */
  const DESK = MOCK_SECRETARY_PROFILE.assignedDoctorId!;

  let fixture: ComponentFixture<SecretarySchedules>;
  let session: SecretarySession;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [SecretarySchedules],
      providers: [SecretarySession],
    });
    session = TestBed.inject(SecretarySession);
    pinToDeskDay(session);
    fixture = TestBed.createComponent(SecretarySchedules);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  function page(): any {
    return fixture.componentInstance;
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('shows the assigned doctor week, and no other doctor week', () => {
    // This page used to lay every doctor's week side by side, to answer "who is
    // free on Thursday?". A desk with one doctor has no such question.
    expect(page().doctors().length).toBe(1);
    expect(page().doctors()[0].doctor.id).toBe(DESK);
    expect(text()).toContain(session.doctors()[0].doctor.name);

    for (const doctor of MOCK_DOCTORS.filter((d) => d.id !== DESK)) {
      expect(text()).not.toContain(doctor.name);
    }
  });

  it('offers no doctor filter, because a week cannot be narrowed to one of one', () => {
    // The per-doctor toggle and the "Show every doctor" button went with the
    // multi-doctor list. Both would have been controls with nothing to switch.
    expect(page().selectDoctor).toBeUndefined();
    expect(page().isSelected).toBeUndefined();
    expect(page().reset).toBeUndefined();
    expect(text()).not.toContain('Show every doctor');
  });

  it('does not offer the week as a control, because a doctor publishes it', () => {
    // A row of days that is not a button: it was a toggle, so it took focus and
    // announced itself as actionable for no reason.
    expect((fixture.nativeElement as HTMLElement).querySelector('.week__toggle')).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('[aria-pressed]')).toBeNull();
  });

  it('labels the columns Sunday to Saturday', () => {
    for (const name of DAY_NAMES) {
      expect(text()).toContain(name);
    }
  });

  it('gives the doctor a Sunday-first week', () => {
    const summary = page().doctors()[0];
    const week = page()
      .daysFor(summary)
      .map((d: any) => d.dayOfWeek);
    expect(week).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('shows the published window, and a dash for a closed day', () => {
    const summary = page().doctors()[0];
    for (const day of page().daysFor(summary)) {
      const label = page().window(day);
      if (day.enabled) {
        expect(label).toBe(`${day.startTime} – ${day.endTime}`);
      } else {
        expect(label).toBe('—');
      }
    }
  });

  it('marks the one closed weekday of this doctor', () => {
    // doc-003's Monday is closed, which is what the booking rules are demonstrated
    // against, so the page has to show the closure rather than hide the column.
    const summary = page().doctors()[0];
    const closed = page()
      .daysFor(summary)
      .filter((day: any) => !day.enabled);
    expect(closed).toHaveLength(1);
    expect(text()).toContain('Sunday to Saturday');
  });

  it('summarises the week from the published days, not a constant', () => {
    const summary = page().doctors()[0];
    const open = page()
      .daysFor(summary)
      .filter((d: any) => d.enabled).length;
    const expected = `${open} ${open === 1 ? 'day' : 'days'} · ${formatDuration(
      session.weeklyMinutes(summary.doctor.id),
    )} a week`;
    expect(page().publishedFor(summary)).toBe(expected);
  });

  it('counts the appointments still to come from the store', () => {
    const summary = page().doctors()[0];
    const now = session.now().getTime();
    const expected = session
      .appointmentsForDoctor(summary.doctor.id)
      .filter(
        (a) =>
          (a.status === 'booked' || a.status === 'confirmed') &&
          new Date(a.startsAt).getTime() >= now,
      ).length;
    expect(page().bookedFor(summary)).toBe(expected);
  });

  it('is read-only, and says the conversation belongs to the doctor', () => {
    // No time input exists on the page: the hours are the doctor's to publish.
    expect((fixture.nativeElement as HTMLElement).querySelector('input')).toBeNull();
    expect(text()).toContain('a conversation with the doctor');
  });

  it('explains what an appointment can be booked into', () => {
    expect(text()).toContain('the only hours an appointment can be booked into');
  });

  it('says the data is a sample, so a screenshot is not mistaken for a product', () => {
    expect(text()).toContain('Sample data');
  });
});
