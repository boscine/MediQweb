import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router, type Routes } from '@angular/router';
import { AdminSession } from './admin-session';
import { AdminShell } from './admin-shell';
import { ADMIN_ROUTES } from './admin.routes';
import { StaffLayout } from '../shared/layouts';

/**
 * Mirrors how `app.routes.ts` mounts the area: under `/admin` via
 * `loadChildren`. Spreading the children at the top level instead would make
 * every path unmatched and silently redirect to sign-in.
 */
const ROUTES: Routes = [
  { path: 'login', children: [] },
  { path: 'admin', children: ADMIN_ROUTES },
  { path: '**', redirectTo: 'login' },
];

describe('AdminShell', () => {
  let fixture: ComponentFixture<AdminShell>;
  let router: Router;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [AdminShell],
      providers: [provideRouter(ROUTES)],
    });
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(AdminShell);
    fixture.detectChanges();
  });

  function layout(): StaffLayout {
    return fixture.debugElement.children[0].componentInstance as StaffLayout;
  }

  it('renders the staff layout as its host', () => {
    expect(layout()).toBeInstanceOf(StaffLayout);
  });

  it('passes the admin menu to the layout', () => {
    const nav = layout().nav();
    const labels = nav.flatMap((entry) =>
      'items' in entry ? entry.items.map((i) => i.label) : [entry.label],
    );
    expect(labels).toEqual(
      expect.arrayContaining([
        'Dashboard',
        'Doctors',
        'Secretaries',
        'Patients',
        'Specialties',
        'Audit Logs',
        'Settings',
      ]),
    );
  });

  it('publishes AdminSession to child routes', () => {
    // Provided on the shell itself, so a child component resolves the same
    // instance the shell-scoped store owns rather than a second one.
    const fromShell = fixture.debugElement.injector.get(AdminSession);
    expect(fromShell).toBeInstanceOf(AdminSession);
  });

  describe('headings from route data', () => {
    async function headingAt(url: string): Promise<{ title: string | null; crumbs: unknown[] }> {
      const ok = await router.navigateByUrl(url);
      expect(ok).toBe(true);
      fixture.detectChanges();
      const shell = fixture.componentInstance;
      return { title: shell['pageTitle'](), crumbs: shell['breadcrumbs']() };
    }

    it('starts with no heading because no route is matched yet', () => {
      expect(fixture.componentInstance['pageTitle']()).toBeNull();
    });

    it('takes the heading from the matched route', async () => {
      const { title } = await headingAt('/admin/audit-logs');
      expect(title).toBe('Audit Logs');
    });

    it('builds a breadcrumb trail ending at the current page', async () => {
      const { crumbs } = await headingAt('/admin/accounts/doctors');
      expect(crumbs).toEqual([
        { label: 'Dashboard', route: '/admin/dashboard' },
        { label: 'Doctors' },
      ]);
    });

    it('sends a bare /admin to the dashboard', async () => {
      await router.navigateByUrl('/admin');
      fixture.detectChanges();
      expect(fixture.componentInstance['pageTitle']()).toBe('Admin Dashboard');
    });
  });

  it('returns to sign-in on logout, since there is no session to clear', async () => {
    layout().logout.emit();
    await fixture.whenStable();
    expect(router.url).toBe('/login');
  });
});
