import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router, type Routes } from '@angular/router';
import { StaffLayout } from '../shared/layouts';
import { MOCK_APPOINTMENTS } from './doctor.mock-data';
import { DoctorSession } from './doctor-session';
import { DoctorShell } from './doctor-shell';
import { DOCTOR_ROUTES } from './doctor.routes';

/**
 * Mirrors how `app.routes.ts` mounts the area: under `/doctor` via
 * `loadChildren`. Spreading the children at the top level instead would make
 * every path unmatched and silently redirect to sign-in.
 */
const ROUTES: Routes = [
  { path: 'login', children: [] },
  { path: 'doctor', children: DOCTOR_ROUTES },
  { path: '**', redirectTo: 'login' },
];

describe('DoctorShell', () => {
  let fixture: ComponentFixture<DoctorShell>;
  let router: Router;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [DoctorShell],
      providers: [provideRouter(ROUTES)],
    });
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(DoctorShell);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  function layout(): StaffLayout {
    return fixture.debugElement.children[0].componentInstance as StaffLayout;
  }

  function page(): DoctorShell {
    return fixture.componentInstance;
  }

  it('renders the staff layout as its host', () => {
    expect(layout()).toBeInstanceOf(StaffLayout);
  });

  it('passes the doctor menu to the layout', () => {
    const nav = layout().nav();
    const labels = nav.flatMap((entry) =>
      'items' in entry ? entry.items.map((i) => i.label) : [entry.label],
    );
    expect(labels).toEqual([
      'Dashboard',
      'Appointments',
      'Patients',
      'Schedule',
      'Visit History',
      'Profile',
    ]);
  });

  it('puts Visit History above Profile, because it is work and not a setting', () => {
    const nav = layout().nav();
    const labels = nav.flatMap((entry) =>
      'items' in entry ? entry.items.map((i) => i.label) : [entry.label],
    );
    expect(labels.indexOf('Visit History')).toBe(labels.indexOf('Profile') - 1);
  });

  it('gives Visit History its own icon, not one already in use', () => {
    // Appointments is a calendar and Schedule is a clipboard. A third
    // time-shaped icon that matched either would be a coin toss at 20px.
    const nav = layout().nav();
    const history = nav
      .flatMap((entry) => ('items' in entry ? entry.items : [entry]))
      .find((item) => item.label === 'Visit History');
    expect(history?.route).toBe('/doctor/history');
    expect(history?.icon).toBe('history');
  });

  it('sends the brand mark to the doctor dashboard, not the sign-in page', () => {
    expect(layout().brandLink()).toBe('/doctor/dashboard');
  });

  it('publishes DoctorSession to child routes', () => {
    // Provided on the shell itself, so a child component resolves the same
    // instance the shell-scoped store owns rather than a second one.
    const fromShell = fixture.debugElement.injector.get(DoctorSession);
    expect(fromShell).toBeInstanceOf(DoctorSession);
  });

  it('identifies the user as a doctor by their real name', () => {
    const user = layout().user();
    expect(user.role).toBe('Doctor');
    expect(user.name).toBe(page()['session'].profile().name);
  });

  it('updates the header name when the profile changes', () => {
    const session = page()['session'] as DoctorSession;
    session.updateProfile({
      name: 'R. Santos',
      email: 'rafael.santos@mediq.ph',
      bio: '',
    });
    fixture.detectChanges();
    expect(layout().user().name).toBe('R. Santos');
  });

  describe('headings from route data', () => {
    async function headingAt(url: string): Promise<{ title: string | null; crumbs: unknown[] }> {
      const ok = await router.navigateByUrl(url);
      expect(ok).toBe(true);
      fixture.detectChanges();
      return { title: page()['pageTitle'](), crumbs: page()['breadcrumbs']() };
    }

    it('takes the heading from the matched route', async () => {
      const { title } = await headingAt('/doctor/appointments');
      expect(title).toBe('Appointments');
    });

    it('builds a breadcrumb trail ending at the current page', async () => {
      const { crumbs } = await headingAt('/doctor/schedule');
      expect(crumbs).toEqual([
        { label: 'Dashboard', route: '/doctor/dashboard' },
        { label: 'Schedule' },
      ]);
    });

    it('sends a bare /doctor to the dashboard', async () => {
      await router.navigateByUrl('/doctor');
      fixture.detectChanges();
      expect(page()['pageTitle']()).toBe('Doctor Dashboard');
    });

    it('names the patient on the details page', async () => {
      const { title } = await headingAt('/doctor/patients/pat-101');
      expect(title).toBe('Juan Dela Cruz');
    });

    it('falls back to a generic heading for an id that matches nobody', async () => {
      const { title } = await headingAt('/doctor/patients/pat-999');
      expect(title).toBe('Patient');
    });

    it('re-resolves the heading when the router reuses the shell for another patient', async () => {
      await headingAt('/doctor/patients/pat-101');
      const { title } = await headingAt('/doctor/patients/pat-103');
      expect(title).toBe('Pedro Reyes');
    });
  });

  it('keeps a stable clock so headings survive the day boundary', async () => {
    // The first fixture is a "today" appointment; the shell never reads the
    // clock, but pinning it keeps the session deterministic for anything that
    // does.
    const session = page()['session'] as DoctorSession;
    session.now.set(new Date(MOCK_APPOINTMENTS[0].startsAt));
    await router.navigateByUrl('/doctor/dashboard');
    fixture.detectChanges();
    expect(page()['pageTitle']()).toBe('Doctor Dashboard');
  });

  it('returns to sign-in on logout, since there is no session to clear', async () => {
    layout().logout.emit();
    await fixture.whenStable();
    expect(router.url).toBe('/login');
  });
});
