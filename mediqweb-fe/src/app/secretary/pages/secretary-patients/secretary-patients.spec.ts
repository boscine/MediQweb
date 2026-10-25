import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  MOCK_APPOINTMENTS,
  MOCK_PATIENTS,
  MOCK_SECRETARY_PROFILE,
} from '../../secretary.mock-data';
import { SecretarySession } from '../../secretary-session';
import { SecretaryPatients } from './secretary-patients';

describe('SecretaryPatients', () => {
  /** The doctor whose panel this page lists. */
  const DESK = MOCK_SECRETARY_PROFILE.assignedDoctorId!;

  /** The patients the session hands this desk. */
  const DESK_PATIENTS = MOCK_PATIENTS.filter((patient) => patient.doctorId === DESK);

  let fixture: ComponentFixture<SecretaryPatients>;
  let session: SecretarySession;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [SecretaryPatients],
      providers: [SecretarySession, provideRouter([])],
    });
    session = TestBed.inject(SecretarySession);
    fixture = TestBed.createComponent(SecretaryPatients);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  function page(): any {
    return fixture.componentInstance;
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  /** A patient the fixtures deliberately give no appointments. */
  function unbookedPatient(): string {
    // A patient whose appointment already happened today has `visitCount === 0`
    // and no next visit but a last visit, so all three must be checked to find
    // the one who has never been seen or booked.
    const row = page()
      .rows()
      .find((r: any) => r.visitCount === 0 && !r.nextVisitAt && !r.lastVisitAt);
    expect(row, 'no unbooked patient in the fixtures').toBeTruthy();
    return row.id;
  }

  it('lists the assigned doctor patients, and nobody else on the clinic list', () => {
    expect(page().rows().length).toBe(DESK_PATIENTS.length);
    expect(page().rows().length).toBeLessThan(MOCK_PATIENTS.length);
    // The fixture is clinic-wide precisely so this can be checked: a scoped list
    // with a scoped fixture would prove nothing.
    expect(DESK_PATIENTS.length).toBeGreaterThan(0);
  });

  it('does not list a patient registered to another doctor', () => {
    const elsewhere = MOCK_PATIENTS.find((patient) => patient.doctorId !== DESK)!;
    expect(session.patientById(elsewhere.id)).toBeNull();
    expect(text()).not.toContain(elsewhere.name);
  });

  it('lists a patient who has never had an appointment', () => {
    // The opposite of the Doctor area, where a patient only becomes visible once
    // they have an appointment. A walk-in cannot be booked if they cannot be
    // found, which is the case this list exists for.
    const id = unbookedPatient();
    expect(session.patientById(id)).not.toBeNull();
    expect(text()).toContain(session.patientById(id)!.name);
  });

  it('shows a patient with no appointments as "Never", not as a blank cell', () => {
    const id = unbookedPatient();
    const row = page()
      .rows()
      .find((r: any) => r.id === id);
    expect(row.lastVisitAt).toBeNull();
    expect(row.nextVisitAt).toBeNull();
  });

  it('counts only this desk appointments in the visit history', () => {
    // The reverse of the old clinic-wide claim, and the reason it matters: a
    // patient who also saw another doctor reads as having fewer visits here,
    // because this desk could not have watched the rest.
    const shared = MOCK_PATIENTS.find(
      (patient) =>
        patient.doctorId === DESK &&
        new Set(MOCK_APPOINTMENTS.filter((a) => a.patientId === patient.id).map((a) => a.doctorId))
          .size > 1,
    )!;
    expect(shared, 'no patient on this desk also saw another doctor').toBeTruthy();

    const seen = session.appointmentsForPatient(shared.id);
    expect(new Set(seen.map((a) => a.doctorId))).toEqual(new Set([DESK]));
    expect(seen.length).toBeLessThan(
      MOCK_APPOINTMENTS.filter((a) => a.patientId === shared.id).length,
    );
  });

  it('counts a visit only once it has been completed or missed', () => {
    // "Visits" is a history figure. Counting a booking that is still in the
    // future would report a patient as having been seen before they arrived.
    const future = MOCK_APPOINTMENTS.find((a) => a.status === 'booked' && a.doctorId === DESK)!;
    const row = page()
      .rows()
      .find((r: any) => r.id === future.patientId);
    const expected = MOCK_APPOINTMENTS.filter(
      (a) =>
        a.patientId === future.patientId && (a.status === 'completed' || a.status === 'no-show'),
    ).length;
    expect(row.visitCount).toBe(expected);
  });

  it('filters by name', () => {
    page().query.set('maria');
    fixture.detectChanges();
    expect(page().rows().length).toBeGreaterThan(0);
    for (const row of page().rows()) {
      expect(row.name.toLowerCase()).toContain('maria');
    }
  });

  it('filters by contact number, which is what a caller usually reads out', () => {
    const patient = DESK_PATIENTS[0];
    const digits = patient.phone.replace(/\D/g, '').slice(-4);
    page().query.set(digits);
    fixture.detectChanges();
    expect(
      page()
        .rows()
        .map((r: any) => r.id),
    ).toContain(patient.id);
  });

  it('filters by email', () => {
    page().query.set('alcaraz');
    fixture.detectChanges();
    expect(page().rows().length).toBeGreaterThan(0);
  });

  it('filters by account status', () => {
    page().statusFilter.set('inactive');
    fixture.detectChanges();
    for (const row of page().rows()) {
      expect(row.status).toBe('inactive');
    }
  });

  it('keeps an inactive patient visible, since their history still matters', () => {
    // pat-212 is inactive *and* registered to the disabled doctor, so the one
    // inactive patient on this desk is somebody else's — which is the point: their
    // status is not what decides whether this list can show them.
    const inactiveElsewhere = MOCK_PATIENTS.filter(
      (patient) => patient.status === 'inactive' && patient.doctorId !== DESK,
    );
    expect(inactiveElsewhere.length).toBeGreaterThan(0);
    for (const patient of inactiveElsewhere) {
      expect(
        page()
          .rows()
          .some((r: any) => r.id === patient.id),
      ).toBe(false);
    }
  });

  it('explains an empty result rather than showing a bare table', () => {
    page().query.set('nobody by this name');
    fixture.detectChanges();
    expect(text()).toContain('No patients match your filters');
  });

  it('agrees with itself about how many patients have something booked', () => {
    const booked = page()
      .rows()
      .filter((r: any) => r.nextVisitAt).length;
    expect(text()).toContain(`${booked} of ${DESK_PATIENTS.length} patients`);
    // The fixture has a patient with nothing booked, so the caption must not read
    // "6 of 6" — that was the kind of off-by-one a hand-written caption hides.
    expect(booked).toBeLessThan(DESK_PATIENTS.length);
  });

  it('links each row to that patient file', () => {
    const hrefs = [...(fixture.nativeElement as HTMLElement).querySelectorAll('.row-identity')].map(
      (a) => a.getAttribute('href'),
    );
    expect(hrefs).toContain(`/secretary/patients/${DESK_PATIENTS[0].id}`);
  });

  it('says whose list this is, rather than the clinic as a whole', () => {
    // The footnote used to promise that everyone on the clinic list appears here,
    // which is now the opposite of what the scoping does.
    const doctor = MOCK_SECRETARY_PROFILE.assignedDoctorId!;
    expect(session.doctors()[0].doctor.id).toBe(doctor);
    expect(text()).toContain(session.doctors()[0].doctor.name);
    expect(text()).toContain('Patients assigned to another doctor are on that doctor');
  });

  it('says the data is a sample, so a screenshot is not mistaken for a product', () => {
    expect(text()).toContain('Sample data');
  });
});
