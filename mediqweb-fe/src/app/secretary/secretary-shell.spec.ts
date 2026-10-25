import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router, type Routes } from '@angular/router';
import { StaffLayout } from '../shared/layouts';
import { SecretaryShell } from './secretary-shell';
import { SECRETARY_ROUTES } from './secretary.routes';

/**
 * Mirrors how `app.routes.ts` mounts the area: under `/secretary` via
 * `loadChildren`. Spreading the children at the top level instead would make
 * every path unmatched and silently redirect to sign-in.
 */
const ROUTES: Routes = [
  { path: 'login', children: [] },
  { path: 'secretary', children: SECRETARY_ROUTES },
  { path: '**', redirectTo: 'login' },
];

describe('SecretaryShell', () => {
  let fixture: ComponentFixture<SecretaryShell>;
  let router: Router;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [SecretaryShell],
      providers: [provideRouter(ROUTES)],
    });
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(SecretaryShell);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  function layout(): StaffLayout {
    return fixture.debugElement.children[0].componentInstance as StaffLayout;
  }

  function page(): SecretaryShell {
    return fixture.componentInstance;
  }

  function navLabels(): string[] {
    return layout()
      .nav()
      .flatMap((entry) => ('items' in entry ? entry.items.map((i) => i.label) : [entry.label]));
  }

  it('renders the staff layout as its host', () => {
    expect(layout()).toBeInstanceOf(StaffLayout);
  });

  it('passes the secretary menu to the layout', () => {
    expect(navLabels()).toEqual([
      'Dashboard',
      'Appointments',
      'Patients',
      'Schedules',
      'Messages',
      'History',
      'Profile',
    ]);
  });

  it('puts History above Profile, matching the Doctor area', () => {
    const labels = navLabels();
    expect(labels.indexOf('History')).toBe(labels.indexOf('Profile') - 1);
  });

  it('gives History its own icon, not one already in use', () => {
    // Appointments is a calendar and Schedules is a clipboard. A third
    // time-shaped icon matching either would be a coin toss at 20px.
    const history = layout()
      .nav()
      .flatMap((entry) => ('items' in entry ? entry.items : [entry]))
      .find((item) => item.label === 'History');
    expect(history?.route).toBe('/secretary/history');
    expect(history?.icon).toBe('history');
  });

  it('takes the heading from the matched route', async () => {
    await router.navigate(['/secretary/history']);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(page()['pageTitle']()).toBe('Appointment History');
  });

  it('names this history differently from the doctor`s, because it holds more', () => {
    // The Secretary record includes cancellations that never became visits, so
    // borrowing the Doctor area's "Visit History" would name it wrongly.
    const history = SECRETARY_ROUTES[0].children!.find((r) => r.path === 'history');
    expect(history?.data?.['heading']).toBe('Appointment History');
  });

  it('still shows the Messages page without a heading of its own', async () => {
    // Messages declares no heading so the layout collapses that row; adding a
    // route must not change that.
    await router.navigate(['/secretary/messages']);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(page()['pageTitle']()).toBeNull();
    expect(page()['breadcrumbs']()).toEqual([]);
  });

  it('redirects a bare /secretary to the dashboard', async () => {
    await router.navigate(['/secretary']);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(router.url).toContain('/secretary/dashboard');
  });

  it('identifies the user as a secretary by their real name', () => {
    const user = layout().user();
    expect(user.role).toBe('Secretary');
    expect(user.name).toBe(page()['session'].profile().name);
  });
});
