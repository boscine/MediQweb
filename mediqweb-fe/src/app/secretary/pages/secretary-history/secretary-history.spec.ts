import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SecretarySession } from '../../secretary-session';
import { SecretaryHistory } from './secretary-history';

describe('SecretaryHistory', () => {
  let fixture: ComponentFixture<SecretaryHistory>;
  let session: SecretarySession;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [SecretaryHistory],
      // Every row links into the patient details route, so a router has to exist
      // even though the test never navigates.
      providers: [SecretarySession, provideRouter([])],
    });
    session = TestBed.inject(SecretarySession);
    fixture = TestBed.createComponent(SecretaryHistory);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  function page(): any {
    return fixture.componentInstance;
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function outcomes(): string[] {
    return [...host().querySelectorAll('ui-appointment-status')].map(
      (badge) => badge.textContent?.trim() ?? '',
    );
  }

  it('lists every closed appointment on this desk', () => {
    expect(page().rows().length).toBe(session.deskHistory().length);
    expect(page().rows().length).toBeGreaterThan(0);
  });

  it('holds all three outcomes: completed, no-show and cancelled', () => {
    // All three are answers this desk has to be able to give — a patient turned
    // away, a patient seen, and a patient who never arrived.
    const set = new Set(
      page()
        .rows()
        .map((row: any) => row.outcome),
    );
    expect(set.has('completed')).toBe(true);
    expect(set.has('no-show')).toBe(true);
    expect(set.has('cancelled')).toBe(true);
  });

  it('offers every outcome as a filter', () => {
    expect(page().outcomeOptions.map((item: any) => item.id)).toEqual([
      'all',
      'completed',
      'no-show',
      'cancelled',
    ]);
  });

  it('holds only the assigned doctor`s appointments', () => {
    // Read through `appointments`, which is already scoped. A history leaking
    // another desk's cancellations would be worse than no history at all.
    const desk = new Set(session.appointments().map((a) => a.id));
    for (const row of page().rows()) expect(desk.has(row.id)).toBe(true);
  });

  it('never shows an appointment still to happen', () => {
    const ids = page()
      .rows()
      .map((row: any) => row.id);
    for (const appointment of session.appointments()) {
      if (['completed', 'cancelled', 'no-show'].includes(appointment.status)) continue;
      expect(ids).not.toContain(appointment.id);
    }
  });

  it('shows the most recent first', () => {
    const times = page()
      .rows()
      .map((row: any) => row.startsAt);
    expect([...times].sort().reverse()).toEqual(times);
  });

  it('names the patient and the doctor rather than showing ids', () => {
    // The doctor is read off the desk's own appointments rather than a literal:
    // this fixture desk is not `doc-001`, and a hard-coded id would have
    // compared against the wrong person's name.
    const deskDoctorId = session.appointments()[0].doctorId;
    for (const row of page().rows()) {
      expect(row.patientName).toBe(session.patientName(row.patientId));
      expect(row.doctorName).toBe(session.doctorName(deskDoctorId));
      expect(row.patientName).not.toBe('');
    }
  });

  it('links each row to that patient', () => {
    const links = [...host().querySelectorAll('.row-identity')] as HTMLAnchorElement[];
    expect(links.length).toBe(page().rows().length);
    for (const link of links) expect(link.getAttribute('href')).toContain('/secretary/patients/');
  });

  it('summarises the three outcomes', () => {
    expect(page().caption()).toContain(`${page().completedCount()} completed`);
    expect(page().caption()).toContain(`${page().noShowCount()} no-show`);
    expect(page().caption()).toContain(`${page().cancelledCount()} cancelled`);
  });

  it('describes the rows on screen, not the whole record', () => {
    // The caption sits above the table it summarises; filtered to nothing it used
    // to report the full record's totals above an empty table.
    page().query.set('nobody by this name');
    fixture.detectChanges();

    expect(page().rows().length).toBe(0);
    expect(page().completedCount()).toBe(0);
    expect(page().cancelledCount()).toBe(0);
    expect(page().noShowCount()).toBe(0);
    expect(page().caption()).toBe('0 completed · 0 no-shows · 0 cancelled · 0 appointments shown');
  });

  it('keeps the count and the rows in agreement under every filter', () => {
    for (const outcome of ['all', 'completed', 'no-show', 'cancelled'] as const) {
      page().outcomeFilter.set(outcome);
      fixture.detectChanges();
      expect(page().completedCount() + page().cancelledCount() + page().noShowCount()).toBe(
        page().rows().length,
      );
    }
  });

  it('filters by patient name', () => {
    const first = page().rows()[0];
    page().query.set(first.patientName.split(' ')[0].toLowerCase());
    fixture.detectChanges();
    expect(page().rows().length).toBeGreaterThan(0);
    for (const row of page().rows())
      expect(row.patientName.toLowerCase()).toContain(
        first.patientName.split(' ')[0].toLowerCase(),
      );
  });

  it('filters by reason', () => {
    const reason = page().rows()[0].reason.split(' ')[0].toLowerCase();
    page().query.set(reason);
    fixture.detectChanges();
    expect(page().rows().length).toBeGreaterThan(0);
    for (const row of page().rows()) expect(row.reason.toLowerCase()).toContain(reason);
  });

  it('filters by outcome', () => {
    page().outcomeFilter.set('cancelled');
    fixture.detectChanges();
    for (const row of page().rows()) expect(row.outcome).toBe('cancelled');
    expect(new Set(outcomes())).toEqual(new Set(['cancelled']));
  });

  it('explains an empty result rather than showing a bare table', () => {
    page().query.set('nobody by this name');
    fixture.detectChanges();
    expect(text()).toContain('No appointments match your filters');
  });

  it('records a cancellation the moment this desk makes one', () => {
    // The page's reason for existing: calling an appointment off puts it on the
    // record, because a patient asking why they were turned away needs an answer.
    const confirmed = session.appointments().find((a) => a.status === 'confirmed')!;
    const before = page().rows().length;

    session.cancel(confirmed.id);
    fixture.detectChanges();

    expect(page().rows().length).toBe(before + 1);
    const row = page()
      .rows()
      .find((r: any) => r.id === confirmed.id);
    expect(row.outcome).toBe('cancelled');
  });

  it('says which desk it belongs to and what it holds', () => {
    // The page has to say both, or a Secretary looking for a missed appointment
    // is told by silence that nobody missed it.
    expect(text()).toContain('Only the assigned doctor');
    expect(text()).toContain('the ones the patient did not arrive for');
  });

  it('says the change is not persisted', () => {
    expect(text()).toContain('Sample data');
  });

  describe('with nothing closed yet', () => {
    // The store's fixtures always carry completed and cancelled appointments, and
    // neither `confirmAppointment` nor `cancelAppointment` can un-close one, so
    // this state cannot be reached by driving the real store. Stubbing the
    // dependency is the honest way to test it.
    beforeEach(async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [SecretaryHistory],
        providers: [
          provideRouter([]),
          {
            provide: SecretarySession,
            useValue: { deskHistory: () => [], patientName: () => '', doctorName: () => '' },
          },
        ],
      });
      fixture = TestBed.createComponent(SecretaryHistory);
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('says where an entry would come from rather than showing an empty table', () => {
      expect(page().rows()).toEqual([]);
      expect(text()).toContain('Nothing closed yet');
      expect(text()).toContain('Confirming and cancelling on Appointments');
    });

    it('counts nothing rather than claiming a total', () => {
      expect(page().caption()).toBe(
        '0 completed · 0 no-shows · 0 cancelled · 0 appointments recorded',
      );
    });
  });
});
