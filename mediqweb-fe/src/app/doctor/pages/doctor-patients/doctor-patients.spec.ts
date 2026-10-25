import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MOCK_APPOINTMENTS, MOCK_PATIENTS } from '../../doctor.mock-data';
import { DoctorSession } from '../../doctor-session';
import { DoctorPatients } from './doctor-patients';

describe('DoctorPatients', () => {
  let fixture: ComponentFixture<DoctorPatients>;
  let session: DoctorSession;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [DoctorPatients],
      // Every row links into the details route, so a router has to exist even
      // though the test never navigates.
      providers: [DoctorSession, provideRouter([])],
    });
    session = TestBed.inject(DoctorSession);
    session.now.set(new Date(MOCK_APPOINTMENTS[0].startsAt));
    fixture = TestBed.createComponent(DoctorPatients);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  function page(): any {
    return fixture.componentInstance;
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it("lists the doctor's patients", () => {
    expect(page().rows().length).toBe(session.patients().length);
  });

  it('leaves out a patient who has only seen another doctor', () => {
    const unrelated = MOCK_PATIENTS.find((p) => p.id === 'pat-113')!;
    expect(text()).not.toContain(unrelated.name);
  });

  it('keeps an inactive patient, because the history stays with the account', () => {
    const inactive = session.patients().find((s) => s.patient.status === 'inactive')!;
    expect(text()).toContain(inactive.patient.name);
  });

  it('filters by name', () => {
    page().query.set('juan');
    fixture.detectChanges();
    expect(page().rows().length).toBe(1);
  });

  it('filters by contact number', () => {
    const target = session.patients()[0].patient.phone;
    page().query.set(target);
    fixture.detectChanges();
    expect(page().rows().length).toBe(1);
  });

  it('filters by account status', () => {
    page().statusFilter.set('inactive');
    fixture.detectChanges();
    const rows = page().rows();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.status).toBe('inactive');
  });

  it('explains an empty result', () => {
    page().query.set('nobody by this name');
    fixture.detectChanges();
    expect(text()).toContain('No patients match your filters');
  });

  it('says when a patient has never been seen or has nothing booked', () => {
    expect(text()).toContain('Never');
    expect(text()).toContain('Not booked');
  });

  it('gives every sort column a primitive to sort on', () => {
    // `ui-table` compares the raw value; an object here would sort as
    // "[object Object]" and silently never reorder.
    for (const row of page().rows()) {
      expect(typeof row.name).toBe('string');
      expect(typeof row.visitCount).toBe('number');
      expect(row.lastVisitAt === null || typeof row.lastVisitAt === 'string').toBe(true);
      expect(row.nextVisitAt === null || typeof row.nextVisitAt === 'string').toBe(true);
    }
  });

  it('links each row to the details page', () => {
    const hrefs = [...(fixture.nativeElement as HTMLElement).querySelectorAll('.link-action')].map(
      (a) => a.getAttribute('href'),
    );
    expect(hrefs).toContain('/doctor/patients/pat-101');
  });

  it("explains why the list is shorter than the clinic's patient table", () => {
    expect(text()).toContain('Only patients who have booked an appointment with you');
  });
});
