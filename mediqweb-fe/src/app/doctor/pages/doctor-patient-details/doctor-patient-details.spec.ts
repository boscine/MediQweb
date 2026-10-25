import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterOutlet, type Routes } from '@angular/router';
import { By } from '@angular/platform-browser';
import { Component } from '@angular/core';
import { MOCK_APPOINTMENTS } from '../../doctor.mock-data';
import { DoctorSession } from '../../doctor-session';
import { DoctorPatientDetails } from './doctor-patient-details';

const ROUTES: Routes = [{ path: 'doctor/patients/:id', component: DoctorPatientDetails }];

/**
 * The page is addressed by a route parameter, so it has to be rendered by the
 * router rather than created directly. `TestBed.createComponent(Page)` would
 * attach the component to the root injector, where `ActivatedRoute` is the
 * router's root route and carries no `:id` — the page would then correctly
 * report "not found" for a patient that does exist.
 */
@Component({ selector: 'app-test-host', template: '<router-outlet />', imports: [RouterOutlet] })
class TestHost {}

describe('DoctorPatientDetails', () => {
  let fixture: ComponentFixture<TestHost>;
  let session: DoctorSession;
  let router: Router;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [TestHost],
      providers: [DoctorSession, provideRouter(ROUTES)],
    });
    session = TestBed.inject(DoctorSession);
    session.now.set(new Date(MOCK_APPOINTMENTS[0].startsAt));
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(TestHost);
  });

  async function open(id: string): Promise<void> {
    await router.navigateByUrl(`/doctor/patients/${id}`);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function page(): any {
    return fixture.debugElement.query(By.directive(DoctorPatientDetails))?.componentInstance;
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('shows the patient named in the route', async () => {
    await open('pat-101');
    expect(text()).toContain('Juan Dela Cruz');
  });

  it('shows the contact details a doctor needs before a consultation', async () => {
    await open('pat-101');
    const patient = session.patientById('pat-101')!;
    expect(text()).toContain(patient.phone);
    expect(text()).toContain(patient.email);
    expect(text()).toContain(patient.address);
  });

  it('shows the birth date and an age derived from it, not a hardcoded one', async () => {
    await open('pat-101');
    const patient = session.patientById('pat-101')!;

    // The date renders through the `date` pipe, so assert on the localized form
    // the user actually sees rather than the ISO string in the fixture.
    const shown = new Date(`${patient.dateOfBirth}T00:00:00`).getFullYear();
    expect(text()).toContain(String(shown));

    const born = new Date(`${patient.dateOfBirth}T00:00:00`);
    let expected = session.now().getFullYear() - born.getFullYear();
    if (
      session.now().getMonth() < born.getMonth() ||
      (session.now().getMonth() === born.getMonth() && session.now().getDate() < born.getDate())
    ) {
      expected -= 1;
    }
    expect(text()).toContain(`${expected} years old`);
  });

  it('lists the appointment history newest first', async () => {
    await open('pat-101');
    const times = page()
      .historyRows()
      .map((a: any) => a.startsAt);
    expect(times.length).toBeGreaterThan(1);
    expect([...times].sort().reverse()).toEqual(times);
  });

  it("lists only this doctor's appointments with the patient", async () => {
    await open('pat-101');
    for (const appointment of page().history()) {
      expect(appointment.doctorId).toBe(session.doctorId);
    }
  });

  it('re-reads the route when the router reuses the page for another patient', async () => {
    await open('pat-101');
    expect(text()).toContain('Juan Dela Cruz');

    await open('pat-103');
    expect(text()).toContain('Pedro Reyes');
    expect(text()).not.toContain('Juan Dela Cruz');
  });

  it('agrees with itself about the number of appointments', async () => {
    // A patient with a single visit is the case a bare `{{ n }} appointments`
    // gets wrong, so assert the singular explicitly rather than trusting the
    // count to be plural.
    await open('pat-104');
    expect(page().history().length).toBe(1);
    expect(text()).toContain('1 appointment');
    expect(text()).not.toContain('1 appointments');
  });

  it('explains the absence of a medical record rather than showing an empty panel', async () => {
    await open('pat-101');
    expect(text()).toContain('Medical records');
  });

  it('offers a way back to the list', async () => {
    await open('pat-101');
    const href = (fixture.nativeElement as HTMLElement).querySelector('.link-button');
    expect(href?.getAttribute('href')).toBe('/doctor/patients');
  });

  it('puts the way back above the name, not below it', async () => {
    // The same banner the Secretary's patient page uses, so both record pages
    // lead with the way back and neither trails it as if it were a fact about
    // the patient.
    await open('pat-101');
    const host = (fixture.nativeElement as HTMLElement).querySelector('ui-card.identity')!;
    const kids = [...host.querySelector('.ui-card__body')!.children];

    expect(kids[0].classList).toContain('link-button');
    expect(kids[1].classList).toContain('identity__row');

    // The name is read from the store rather than written out, so changing the
    // fixture cannot leave the assertion quietly comparing the wrong two strings.
    const name = session.patientName('pat-101');
    expect(host.textContent!.indexOf('Back to patients')).toBeLessThan(
      host.textContent!.indexOf(name),
    );
  });

  it('puts the avatar and the name in one row, inside the card body', async () => {
    // The flex rules have to sit on `.identity__row`: `.identity` is the card
    // host, which is already the flex container, so a row declared on the host
    // has the card as its only flex child and never reaches the avatar. The
    // banner then falls back to stacked blocks — which does not look broken, it
    // just stops being a row. Asserted structurally because the computed layout
    // cannot be read here.
    await open('pat-101');
    const row = (fixture.nativeElement as HTMLElement).querySelector('.identity__row')!;
    expect(row).not.toBeNull();
    expect(row.querySelector('ui-avatar')).not.toBeNull();
    expect(row.querySelector('.identity__name')).not.toBeNull();
  });

  it('reports an id that matches nobody instead of rendering a blank page', async () => {
    await open('pat-999');
    expect(text()).toContain('Patient not found');
  });

  it('does not leak an unrelated patient through a guessed id', async () => {
    // pat-113 exists in the store but has only ever been seen by another
    // doctor. A URL is user input, so resolving it must go through the same
    // relationship check the list uses — not a plain id lookup.
    await open('pat-113');
    expect(text()).toContain('Patient not found');
    expect(text()).not.toContain('Danilo Puno');
  });
});
