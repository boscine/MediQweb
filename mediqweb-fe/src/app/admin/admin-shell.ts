import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { type ActivatedRouteSnapshot, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import {
  StaffLayout,
  type StaffCrumb,
  type StaffNavEntry,
  type StaffProfile,
} from '../shared/layouts';
import { AdminSession } from './admin-session';

/**
 * The signed-in administrator. Placeholder identity — there is no session yet,
 * so the role and the menu are fixed rather than derived from a token.
 */
const ADMIN: StaffProfile = { name: 'Alex Rivera', role: 'Administrator' };

const DASHBOARD_ROUTE = '/admin/dashboard';

/**
 * Admin menu. Declared once and used for both the sidebar and the mobile
 * drawer, so the two cannot drift apart.
 */
const ADMIN_NAV: readonly StaffNavEntry[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', route: DASHBOARD_ROUTE },
  {
    id: 'accounts',
    label: 'Accounts',
    items: [
      { id: 'doctors', label: 'Doctors', icon: 'users', route: '/admin/accounts/doctors' },
      {
        id: 'secretaries',
        label: 'Secretaries',
        icon: 'users',
        route: '/admin/accounts/secretaries',
      },
      { id: 'patients', label: 'Patients', icon: 'users', route: '/admin/accounts/patients' },
    ],
  },
  {
    id: 'management',
    label: 'Management',
    items: [
      {
        id: 'specializations',
        label: 'Specialties',
        icon: 'folder',
        route: '/admin/specializations',
      },
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      { id: 'audit-logs', label: 'Audit Logs', icon: 'clipboard', route: '/admin/audit-logs' },
      { id: 'settings', label: 'Settings', icon: 'settings', route: '/admin/settings' },
      { id: 'account-details', label: 'Account Details', icon: 'settings', route: '/admin/account/details' },
    ],
  },
];

/**
 * Route shell for the Admin area.
 *
 * Owns the layout, the menu and the identity, then projects a `router-outlet`
 * so every Admin page is its own lazy chunk. It also publishes `AdminSession`
 * for the pages, scoping the mock store to this branch of the app.
 *
 * Page titles and breadcrumbs come from each route's `data.heading` rather than
 * from the page components. That keeps a page's heading declared next to its
 * route, and means a page never has to reach up to configure the layout.
 *
 * The layout's `[staffPageActions]` slot is unavailable to pages for the same
 * reason: the layout is owned here, not by the page. Each page therefore
 * renders its own toolbar beneath the heading.
 */
@Component({
  selector: 'app-admin-shell',
  imports: [RouterOutlet, StaffLayout],
  templateUrl: './admin-shell.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AdminSession],
})
export class AdminShell {
  private readonly router = inject(Router);

  protected readonly user = ADMIN;
  protected readonly nav = ADMIN_NAV;

  /**
   * Navigation counter, bumped after every completed navigation.
   *
   * `routerState.snapshot` is a mutable object, not a signal, so a `computed`
   * reading it would cache its first result forever and the heading would never
   * change after the first page load. Reading the snapshot inside a computed
   * that also reads this counter makes the dependency explicit.
   */
  private readonly navCount = signal(0);

  /** Heading of the deepest matched route that declares one. */
  protected readonly pageTitle = computed(() => {
    this.navCount();
    return this.deepestHeading();
  });

  protected readonly breadcrumbs = computed<StaffCrumb[]>(() => {
    const heading = this.pageTitle();
    // The layout renders the final crumb as plain text, never as a link.
    return heading ? [{ label: 'Dashboard', route: DASHBOARD_ROUTE }, { label: heading }] : [];
  });

  constructor() {
    // Navigation *end*, not start, so the snapshot already points at the new
    // route by the time the heading is recomputed.
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.navCount.update((n) => n + 1));
  }

  /**
   * The layout emits logout but has no session to clear. Returning to sign-in
   * is the honest behaviour until authentication exists; calling the future
   * AuthService here instead is a one-line change.
   */
  protected onLogout(): void {
    void this.router.navigate(['/login']);
  }

  private deepestHeading(): string | null {
    let route: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    let heading: string | null = null;
    while (route) {
      const declared = route.data?.['heading'];
      if (typeof declared === 'string' && declared.length) heading = declared;
      route = route.firstChild;
    }
    return heading;
  }
}
