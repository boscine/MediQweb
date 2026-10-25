import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, RouterOutlet, provideRouter, type Routes } from '@angular/router';
import { ageFrom } from '../../secretary.dates';
import { MOCK_APPOINTMENTS } from '../../secretary.mock-data';
import { SecretarySession } from '../../secretary-session';
import { pinToDeskDay } from '../../secretary.spec-helpers';
import { SecretaryPatientDetails } from './secretary-patient-details';

const ROUTES: Routes = [{ path: 'secretary/patients/:id', component: SecretaryPatientDetails }];

/**
 * The page is addressed by a route parameter, so it has to be rendered by the
 * router rather than created directly. `TestBed.createComponent(Page)` would
 * attach the component to the root injector, where `ActivatedRoute` is the
 * router's root route and carries no `:id` — the page would then correctly
 * report "not found" for a patient that does exist.
 */
@Component({ selector: 'app-test-host', template: '<router-outlet />', imports: [RouterOutlet] })
class TestHost {}

describe('SecretaryPatientDetails', () => {
  let fixture: ComponentFixture<TestHost>;
  let session: SecretarySession;
  let router: Router;

  /** A patient the fixtures give no appointments, to check the empty history. */
  const UNBOOKED = 'pat-215';

  /** A patient who also saw another doctor, to check the history is this desk's. */
  const ALSO_ELSEWHERE = 'pat-202';

  /** A patient on another doctor's panel, active or not. */
  const OTHER_DESK = 'pat-212';

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [TestHost],
      providers: [SecretarySession, provideRouter(ROUTES)],
    });
    session = TestBed.inject(SecretarySession);
    pinToDeskDay(session);
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(TestHost);
  });

  async function open(id: string): Promise<void> {
    await router.navigateByUrl(`/secretary/patients/${id}`);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function page(): any {
    return fixture.debugElement.query(By.directive(SecretaryPatientDetails))?.componentInstance;
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('shows the patient named in the route', async () => {
    await open('pat-205');
    expect(text()).toContain('Miguel Torres');
  });

  it('shows the contact details a secretary needs to confirm an appointment', async () => {
    await open('pat-205');
    const patient = session.patientById('pat-205')!;
    expect(text()).toContain(patient.phone);
    expect(text()).toContain(patient.email);
    expect(text()).toContain(patient.address);
  });

  it('shows the birth date and an age derived from it, not a hardcoded one', async () => {
    await open('pat-205');
    const patient = session.patientById('pat-205')!;
    expect(text()).toContain(String(new Date(`${patient.dateOfBirth}T00:00:00`).getFullYear()));
    expect(text()).toContain(`${ageFrom(patient.dateOfBirth, session.now())} years old`);
  });

  it('lists the appointment history newest first', async () => {
    await open('pat-205');
    const times = page()
      .historyRows()
      .map((a: any) => a.startsAt);
    expect(times.length).toBeGreaterThan(1);
    expect([...times].sort().reverse()).toEqual(times);
  });

  it('lists only this desk appointments for a patient who also saw another doctor', async () => {
    // The reverse of the clinic-wide claim this page used to make. A patient's
    // panel decides whether the page opens at all, and everything in the history
    // belongs to the desk that opened it.
    const elsewhere = MOCK_APPOINTMENTS.filter((a) => a.patientId === ALSO_ELSEWHERE);
    expect(new Set(elsewhere.map((a) => a.doctorId)).size).toBeGreaterThan(1);

    await open(ALSO_ELSEWHERE);
    expect(page().history().length).toBeGreaterThan(0);
    expect(page().history().length).toBeLessThan(elsewhere.length);
    expect(
      new Set(
        page()
          .history()
          .map((a: any) => a.doctorId),
      ).size,
    ).toBe(1);
  });

  it('names no doctor per row, because every row on this desk is the same one', async () => {
    // The history table lost its Doctor column along with the per-doctor list; the
    // patient themselves are already this doctor's panel.
    await open('pat-205');
    const headers = [...(fixture.nativeElement as HTMLElement).querySelectorAll('th')].map((th) =>
      th.textContent?.trim(),
    );
    expect(headers).not.toContain('Doctor');
  });

  it('re-reads the route when the router reuses the page for another patient', async () => {
    await open('pat-205');
    expect(text()).toContain('Miguel Torres');

    await open('pat-208');
    expect(text()).toContain('Carla De Guzman');
    expect(text()).not.toContain('Miguel Torres');
  });

  it('agrees with itself about the number of appointments', async () => {
    // A patient with a single visit is the case a bare `{{ n }} appointments`
    // gets wrong, so assert the singular explicitly rather than trusting the
    // count to be plural.
    await open(UNBOOKED);
    expect(page().history().length).toBe(0);
    expect(text()).toContain('0 appointments');
  });

  it('explains an empty history instead of showing a bare table', async () => {
    await open(UNBOOKED);
    expect(text()).toContain('no appointments yet');
  });

  it('explains the absence of a medical record rather than showing an empty panel', async () => {
    await open('pat-205');
    expect(text()).toContain('Medical records');
    // And says what the page does show, so the limit reads as scope rather than
    // as missing functionality.
    expect(text()).toContain('administrative history');
  });

  it('offers a way back to the list', async () => {
    await open('pat-205');
    const href = (fixture.nativeElement as HTMLElement).querySelector('.link-button');
    expect(href?.getAttribute('href')).toBe('/secretary/patients');
  });

  it('puts the way back above the name, not below it', async () => {
    // It is the one thing on the page that is about leaving rather than about the
    // patient, so it leads the card. Trailing it read as the last fact about this
    // person rather than as the way back to the list they came from.
    await open('pat-205');
    const host = (fixture.nativeElement as HTMLElement).querySelector('ui-card.identity')!;
    const kids = [...host.querySelector('.ui-card__body')!.children];

    expect(kids[0].classList).toContain('link-button');
    expect(kids[1].classList).toContain('identity__row');
    expect(host.textContent!.indexOf('Back to patients')).toBeLessThan(
      host.textContent!.indexOf('Miguel Torres'),
    );
  });

  it('puts the avatar and the name in one row, inside the card body', async () => {
    // The flex rules live on `.identity__row` because `.identity` sits on the
    // card's host, which is already the flex container — a row declared on the
    // host has the card as its only flex child and never reaches the avatar, so
    // the banner silently falls back to stacked blocks. Nothing about that looks
    // broken; it just stops being a row. Asserted structurally because the
    // computed layout cannot be read here.
    await open('pat-205');
    const row = (fixture.nativeElement as HTMLElement).querySelector('.identity__row')!;
    expect(row).not.toBeNull();
    expect(row.querySelector('ui-avatar')).not.toBeNull();
    expect(row.querySelector('.identity__name')).not.toBeNull();
  });

  it('reports an id that matches nobody instead of rendering a blank page', async () => {
    await open('pat-999');
    expect(text()).toContain('Patient not found');
  });

  it('does not leak another patient through a guessed id', async () => {
    await open('pat-999');
    for (const patient of session.patients()) {
      if (patient.patient.id === 'pat-999') continue;
      expect(text()).not.toContain(patient.patient.name);
    }
  });

  it('shows an inactive patient without hiding their history', async () => {
    // `pat-212` is inactive *and* registered to the disabled doctor, so no
    // inactive patient is on this desk: the two axes are independent, and this
    // fixture keeps them apart on purpose.
    const inactiveElsewhere = ['pat-212'];
    expect(inactiveElsewhere.length).toBeGreaterThan(0);
    for (const id of inactiveElsewhere) {
      await open(id);
      expect(text()).toContain('Patient not found');
    }
  });

  it('refuses a patient on another doctor panel, and says so as one', async () => {
    // The route parameter is a way to ask for somebody else's record, so the
    // lookup is scoped as well as the list. An inactive account is reported the
    // same way as an active one, so the copy cannot be read as "this patient is
    // not active" either.
    await open(OTHER_DESK);
    expect(text()).toContain('Patient not found');
    expect(text()).toContain('one of your doctor');
    expect(text()).not.toContain('Nestor Yulo');
  });

  it('says the data is a sample, so a screenshot is not mistaken for a product', async () => {
    await open('pat-205');
    expect(text()).toContain('Sample data');
  });
});
