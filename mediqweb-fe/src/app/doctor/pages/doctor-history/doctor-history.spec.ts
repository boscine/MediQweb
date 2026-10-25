import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DoctorSession } from '../../doctor-session';
import { DoctorHistory } from './doctor-history';

describe('DoctorHistory', () => {
  let fixture: ComponentFixture<DoctorHistory>;
  let session: DoctorSession;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [DoctorHistory],
      // Every row links into the patient details route, so a router has to exist
      // even though the test never navigates.
      providers: [DoctorSession, provideRouter([])],
    });
    session = TestBed.inject(DoctorSession);
    fixture = TestBed.createComponent(DoctorHistory);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  function page(): any {
    return fixture.componentInstance;
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function statuses(): string[] {
    return [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('ui-appointment-status'),
    ].map((badge) => badge.textContent?.trim() ?? '');
  }

  function dates(): string[] {
    return page()
      .rows()
      .map((row: any) => row.startsAt);
  }

  it('lists every visit this doctor has recorded', () => {
    expect(page().rows().length).toBe(session.visitHistory().length);
    expect(page().rows().length).toBeGreaterThan(0);
  });

  it('holds only completed and no-show visits', () => {
    // The rule that defines this page. A cancelled appointment shares the
    // "closed" status with the other two but nobody was seen, so it is a booking
    // that did not happen rather than a visit that did.
    for (const row of page().rows()) {
      expect(['completed', 'no-show']).toContain(row.outcome);
    }
    // Checked against the rendered rows rather than the page text, because the
    // footnote below the table names cancelled appointments in order to explain
    // why they are absent.
    expect(new Set(statuses())).toEqual(new Set(['completed', 'no-show']));
  });

  it('never shows an appointment that is still to happen', () => {
    const open = session
      .appointments()
      .filter((a) => a.status === 'booked' || a.status === 'confirmed');
    const ids = page()
      .rows()
      .map((row: any) => row.id);
    for (const appointment of open) expect(ids).not.toContain(appointment.id);
  });

  it('shows the most recent visit first', () => {
    const times = dates();
    expect([...times].sort().reverse()).toEqual(times);
  });

  it('names the patient rather than showing an id', () => {
    for (const row of page().rows()) {
      expect(row.patientName).toBe(session.patientName(row.patientId));
      expect(row.patientName).not.toBe('Unknown patient');
    }
  });

  it('links each row to that patient', () => {
    const links = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('.row-identity'),
    ] as HTMLAnchorElement[];
    expect(links.length).toBe(page().rows().length);
    for (const link of links) expect(link.getAttribute('href')).toContain('/doctor/patients/');
  });

  it('shows the outcome of each visit', () => {
    expect(statuses().length).toBe(page().rows().length);
    expect(new Set(statuses())).toEqual(new Set(['completed', 'no-show']));
  });

  it('summarises how many visits and no-shows there are', () => {
    expect(page().caption()).toContain(`${page().completedCount()} completed`);
    expect(page().caption()).toContain(`${page().noShowCount()} no-show`);
  });

  it('describes the rows on screen, not the whole record', () => {
    // The caption sits above the table it summarises. Filtered to nothing it
    // still read "5 completed · 1 no-show · 6 visits recorded" above an empty
    // table — a claim about rows that were not there.
    page().query.set('nobody by this name');
    fixture.detectChanges();

    expect(page().rows().length).toBe(0);
    expect(page().completedCount()).toBe(0);
    expect(page().noShowCount()).toBe(0);
    expect(page().caption()).toBe('0 completed · 0 no-shows · 0 visits shown');
  });

  it('says it is showing a filtered subset rather than implying the history shrank', () => {
    page().outcomeFilter.set('no-show');
    fixture.detectChanges();
    const total = session.visitHistory().length;
    expect(page().rows().length).toBeLessThan(total);
    expect(page().caption()).toContain('shown');
    expect(page().caption()).not.toContain('recorded');
  });

  it('keeps the count and the rows in agreement under every filter', () => {
    for (const outcome of ['all', 'completed', 'no-show'] as const) {
      page().outcomeFilter.set(outcome);
      fixture.detectChanges();
      expect(page().completedCount() + page().noShowCount()).toBe(page().rows().length);
    }
  });

  it('pluralises the no-show count to match what was actually recorded', () => {
    // Driven by the real count rather than a manufactured one. `recordOutcome`
    // only moves a `confirmed` appointment, so there is no way to reach a history
    // holding exactly one no-show and then assert the singular — the branch that
    // runs is whichever the fixtures happen to produce.
    const count = page().noShowCount();
    expect(page().caption()).toContain(`${count} no-show${count === 1 ? '' : 's'}`);
  });

  it('filters by patient name', () => {
    page().query.set('juan');
    fixture.detectChanges();
    expect(page().rows().length).toBeGreaterThan(0);
    for (const row of page().rows()) expect(row.patientName.toLowerCase()).toContain('juan');
  });

  it('filters by reason', () => {
    page().query.set('imaging');
    fixture.detectChanges();
    expect(page().rows().length).toBeGreaterThan(0);
    for (const row of page().rows()) expect(row.reason.toLowerCase()).toContain('imaging');
  });

  it('filters by outcome', () => {
    page().outcomeFilter.set('no-show');
    fixture.detectChanges();
    for (const row of page().rows()) expect(row.outcome).toBe('no-show');
    expect(new Set(statuses())).toEqual(new Set(['no-show']));
  });

  it('explains an empty result rather than showing a bare table', () => {
    page().query.set('nobody by this name');
    fixture.detectChanges();
    expect(text()).toContain('No visits match your filters');
  });

  it('records a visit the moment the doctor closes one', () => {
    // The page's whole reason to exist: completing an appointment on the
    // Appointments page puts it here without another action.
    const confirmed = session.appointments().find((a) => a.status === 'confirmed')!;
    const before = page().rows().length;

    session.recordOutcome(confirmed.id, 'completed');
    fixture.detectChanges();

    expect(page().rows().length).toBe(before + 1);
    expect(
      page()
        .rows()
        .some((row: any) => row.id === confirmed.id),
    ).toBe(true);
  });

  it('records a no-show the same way', () => {
    const confirmed = session.appointments().find((a) => a.status === 'confirmed')!;
    session.recordOutcome(confirmed.id, 'no-show');
    fixture.detectChanges();

    const row = page()
      .rows()
      .find((r: any) => r.id === confirmed.id);
    expect(row.outcome).toBe('no-show');
  });

  it('says a cancelled appointment is not a visit', () => {
    expect(text()).toContain('A cancelled appointment is not here');
  });

  it('says the change is not persisted', () => {
    expect(text()).toContain('Sample data');
  });

  describe('with no visits recorded yet', () => {
    // The store's fixtures always carry a few completed appointments, and
    // `recordOutcome` only moves a `confirmed` appointment, so this state cannot
    // be reached by driving the real store. Stubbing the dependency is the honest
    // way to test it: the alternative was a test that empties nothing and asserts
    // on a message it never reached.
    beforeEach(async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [DoctorHistory],
        providers: [provideRouter([]), { provide: DoctorSession, useValue: emptySession() }],
      });
      fixture = TestBed.createComponent(DoctorHistory);
      fixture.detectChanges();
      await fixture.whenStable();
    });

    function emptySession(): unknown {
      return { visitHistory: () => [], patientName: () => 'Unknown patient' };
    }

    it('says where a visit comes from, rather than showing an empty table', () => {
      expect(page().rows()).toEqual([]);
      expect(text()).toContain('No visits recorded yet');
      expect(text()).toContain('Recording a visit or a no-show on Appointments');
    });

    it('counts nothing rather than claiming a total', () => {
      expect(page().caption()).toBe('0 completed · 0 no-shows · 0 visits recorded');
    });

    it('still describes an unfiltered empty record as recorded, not shown', () => {
      // No filter is in play, so "recorded" is the honest word even at zero.
      expect(page().caption()).toContain('0 visits recorded');
    });
  });
});
