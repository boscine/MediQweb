import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MOCK_APPOINTMENTS } from '../../doctor.mock-data';
import { DoctorSession } from '../../doctor-session';
import { DoctorDashboard } from './doctor-dashboard';

describe('DoctorDashboard', () => {
  let fixture: ComponentFixture<DoctorDashboard>;
  let session: DoctorSession;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [DoctorDashboard],
      // The page links into the patient routes, so a router has to exist even
      // though the test never navigates.
      providers: [DoctorSession, provideRouter([])],
    });
    session = TestBed.inject(DoctorSession);
    session.now.set(new Date(MOCK_APPOINTMENTS[0].startsAt));
    fixture = TestBed.createComponent(DoctorDashboard);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  function page(): any {
    return fixture.componentInstance;
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it("counts today's appointments", () => {
    expect(page().todayCount()).toBe(session.todaysAppointments().length);
  });

  it('tags the agenda card so the shared empty state keeps its inset', () => {
    // The card turns its own padding off so the rows' dividers run to the card
    // edges, which leaves the empty state with nothing carrying the heading's
    // horizontal inset. The shared partial insets it again through
    // `.agenda-card`, and that rule reaches the card only while the template
    // still carries the class — which nothing else would notice if it stopped.
    const host = (fixture.nativeElement as HTMLElement).querySelector('ui-card.agenda-card');
    expect(host).not.toBeNull();
    expect(host!.querySelector('.ui-card--padding-none')).not.toBeNull();
  });

  it('counts the appointments still waiting on a decision', () => {
    expect(page().awaitingCount()).toBe(
      session.appointments().filter((a) => a.status === 'booked').length,
    );
  });

  it("counts only this doctor's patients", () => {
    expect(page().patientCount()).toBe(session.patients().length);
  });

  it("lists today's appointments by time", () => {
    const items = page().today();
    expect(items.length).toBeGreaterThan(0);
    const times = items.map((a: any) => a.startsAt);
    expect([...times].sort()).toEqual(times);
  });

  it('names each patient in the day list', () => {
    for (const appointment of page().today()) {
      expect(text()).toContain(session.patientName(appointment.patientId));
    }
  });

  it("links each appointment to the patient's details", () => {
    const hrefs = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('.agenda__patient'),
    ].map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/doctor/patients/pat-101');
  });

  it('shows the next patient, not a past one', () => {
    const next = page().next();
    expect(next).toBe(session.nextAppointment());
    expect(text()).toContain(session.patientName(next.patientId));
  });

  it('caps the patient overview at four entries', () => {
    expect(page().upcomingPatients().length).toBeLessThanOrEqual(4);
  });

  it('orders the patient overview by appointment time', () => {
    const times = page()
      .upcomingPatients()
      .map((s: any) => s.nextVisit.startsAt);
    expect([...times].sort()).toEqual(times);
  });

  it('reacts to a visit being recorded', () => {
    // Driven through an action the doctor actually owns. It used to confirm a
    // booking to move the figure, which is no longer something this area can do —
    // and a test that needed a removed capability was a test asserting the wrong
    // division of labour.
    const before = page().completedThisWeek();
    const confirmed = session.appointments().find((a: any) => a.status === 'confirmed')!;
    session.recordOutcome(confirmed.id, 'completed');
    fixture.detectChanges();
    expect(page().completedThisWeek()).toBe(before + 1);
  });

  it('says the data is a sample, so a screenshot is not mistaken for a product', () => {
    expect(text()).toContain('Sample data');
  });
});
