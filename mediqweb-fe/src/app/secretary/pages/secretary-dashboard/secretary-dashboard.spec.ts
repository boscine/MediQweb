import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SecretarySession } from '../../secretary-session';
import { pinToDeskDay } from '../../secretary.spec-helpers';
import { SecretaryDashboard } from './secretary-dashboard';

describe('SecretaryDashboard', () => {
  let fixture: ComponentFixture<SecretaryDashboard>;
  let session: SecretarySession;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [SecretaryDashboard],
      // The page links into the patient and doctor routes, so a router has to
      // exist even though the test never navigates.
      providers: [SecretarySession, provideRouter([])],
    });
    session = TestBed.inject(SecretarySession);
    pinToDeskDay(session);
    fixture = TestBed.createComponent(SecretaryDashboard);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  function page(): any {
    return fixture.componentInstance;
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('counts todays appointments, all of them this desk', () => {
    expect(page().todayCount()).toBe(session.todaysAppointments().length);
    expect(page().today().length).toBeGreaterThan(0);
    expect(
      new Set(
        page()
          .today()
          .map((a: any) => a.doctorId),
      ).size,
    ).toBe(1);
  });

  it('names the assigned doctor on the stats, so the numbers are not the clinic ones', () => {
    // "Across all doctors" was true of this page and false of everything else in
    // the area. The count belongs to one doctor, so the card says whose it is.
    const doctor = session.doctors()[0].doctor;
    expect(doctor.name).toBeTruthy();
    expect(page().assignedDoctor().id).toBe(doctor.id);
    expect(text()).toContain(doctor.name);
    expect(text()).not.toContain('Across all doctors');
  });

  it('counts the bookings still waiting on a confirmation', () => {
    expect(page().awaitingCount()).toBe(
      session.appointments().filter((a) => a.status === 'booked').length,
    );
  });

  it('counts this desk patients, not every patient on file', () => {
    expect(page().patientCount()).toBe(session.patients().length);
    expect(text()).toContain('On this doctor');
  });

  it('counts what has been completed this week instead of doctors available', () => {
    // The "N doctors available" stat counted to one on this desk, every morning,
    // which is not a fact anybody acts on. What the desk can act on is how much
    // of the week is already done.
    expect(page().doctorCount).toBeUndefined();
    expect(page().availableDoctors).toBeUndefined();
    expect(page().completedCount()).toBe(session.completedThisWeek().length);
    expect(text()).toContain('Seen in the last 7 days');
  });

  it("lists today's appointments by time", () => {
    const times = page()
      .today()
      .map((a: any) => a.startsAt);
    expect([...times].sort()).toEqual(times);
  });

  it('names the patient on every row of the day list, and the doctor once', () => {
    // The day list no longer repeats the doctor's name per row: there is one
    // doctor, and the stat card above already says who.
    for (const appointment of page().today()) {
      expect(text()).toContain(session.patientName(appointment.patientId));
    }
    const reasons = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('.agenda__reason'),
    ].map((node) => node.textContent?.trim() ?? '');
    for (const reason of reasons) {
      expect(reason).not.toContain(session.doctors()[0].doctor.name);
    }
  });

  it('links each appointment to the patient details', () => {
    const hrefs = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('.agenda__patient'),
    ].map((a) => a.getAttribute('href'));
    expect(hrefs.length).toBe(page().today().length);
    expect(hrefs[0]).toMatch(/^\/secretary\/patients\//);
  });

  it('no longer lists doctors who are free, because there is only one doctor', () => {
    // The card this column ended with asked "who can I still book?" — a question
    // for a clinic-wide desk. A one-row answer is not a list, so the card is gone.
    expect(page().bookedToday).toBeUndefined();
    expect(text()).not.toContain('Available doctors');
    expect(text()).not.toContain('No doctors are taking bookings');
  });

  it('shows the next appointment, not a past one', () => {
    const next = page().next();
    expect(next).toBe(session.nextAppointment());
    expect(new Date(next.startsAt).getTime()).toBeGreaterThanOrEqual(session.now().getTime());
    expect(text()).toContain(session.patientName(next.patientId));
  });

  it('reacts to an appointment being booked elsewhere', () => {
    const before = page().todayCount();
    const target = page().today()[0];
    session.cancel(target.id);
    fixture.detectChanges();
    expect(page().todayCount()).toBe(before - 1);
  });

  it('reacts to an appointment being cancelled elsewhere', () => {
    const before = page().awaitingCount();
    const booked = session.appointments().find((a) => a.status === 'booked')!;
    session.cancel(booked.id);
    fixture.detectChanges();
    expect(page().awaitingCount()).toBe(before - 1);
  });

  it('tags the agenda card so the shared empty state keeps its inset', () => {
    // The card turns its own padding off so the rows' dividers run to the card
    // edges. That leaves the empty state with nothing carrying the horizontal
    // inset the heading has, so it sat flush against the card border. The shared
    // partial insets it again through `.agenda-card` — and that rule reaches the
    // card only if the template still carries the class, which nothing else would
    // notice if it stopped.
    const host = (fixture.nativeElement as HTMLElement).querySelector('ui-card.agenda-card');
    expect(host).not.toBeNull();
    // Asserted together because they are only related by accident: the tag is
    // what carries the shared rule, and the padding being off is the reason it is
    // needed. A card that grew its own padding would make the rule redundant and
    // the test would say so rather than passing on the tag alone.
    expect(host!.querySelector('.ui-card--padding-none')).not.toBeNull();
  });

  it('points at the appointment list rather than hosting a booking form', () => {
    // Booking needs a patient, a doctor, a time and a reason — a screen of its
    // own. The dashboard offers the route to it, not a cut-down version.
    const hrefs = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('a.statFooter, a.see-all'),
    ].map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/secretary/appointments');
    expect(text()).not.toContain('Book appointment');
  });

  it('says the data is a sample, so a screenshot is not mistaken for a product', () => {
    expect(text()).toContain('Sample data');
  });

  it('says so plainly when the desk has no doctor, instead of four empty cards', () => {
    // An unassigned desk is not a quiet day. This is the first screen somebody
    // lands on, so it is where the reason has to be.
    (session as any).profileState.update((profile: any) => ({
      ...profile,
      assignedDoctorId: null,
    }));
    fixture.detectChanges();

    expect(text()).toContain('not assigned to a doctor');
    expect(text()).not.toContain('Nothing booked in for today');
    expect(page().assignedDoctor()).toBeNull();
  });
});
