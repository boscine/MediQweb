import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { type ActivatedRouteSnapshot, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import {
  StaffLayout,
  type StaffCrumb,
  type StaffNavEntry,
  type StaffNavItem,
  type StaffProfile,
} from '../shared/layouts';
import { SecretarySession } from './secretary-session';

const DASHBOARD_ROUTE = '/secretary/dashboard';

/**
 * Secretary menu. Declared once and used for both the sidebar and the mobile
 * drawer, so the two cannot drift apart. Logout is not here: the layout always
 * renders it, because every role needs a way out.
 *
 * Declared flat rather than grouped: `nav` below rewrites the Messages entry's
 * badge, and doing that to a `StaffNavEntry` would mean handling the group case
 * as well. When a group is wanted here, it should be added deliberately rather
 * than by loosening this type.
 */
const SECRETARY_NAV: readonly StaffNavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', route: DASHBOARD_ROUTE },
  {
    id: 'appointments',
    label: 'Appointments',
    icon: 'calendar',
    route: '/secretary/appointments',
  },
  { id: 'patients', label: 'Patients', icon: 'users', route: '/secretary/patients' },
  { id: 'schedules', label: 'Schedules', icon: 'clipboard', route: '/secretary/schedules' },
  { id: 'messages', label: 'Messages', icon: 'messages', route: '/secretary/messages' },
  // Above Profile, like the Doctor area's. The icon is the one added for the
  // Doctor history, so the two records read as the same idea in two places.
  { id: 'history', label: 'History', icon: 'history', route: '/secretary/history' },
  { id: 'profile', label: 'Profile', icon: 'settings', route: '/secretary/profile' },
];

/**
 * Route shell for the Secretary area.
 *
 * Mirrors the Doctor shell: it owns the layout, the menu and the identity, then
 * projects a `router-outlet` so every page is its own lazy chunk. It also
 * publishes `SecretarySession`, scoping the mock store to this branch of the app.
 *
 * The identity is read from the session rather than declared as a constant, so
 * editing the Profile page updates the name in the header. With a real AuthService
 * this becomes one read from the current user and nothing else changes.
 *
 * Page titles and breadcrumbs come from each route's `data.heading` rather than
 * from the page components, so a page never has to reach up to configure the
 * layout. For the same reason the layout's `[staffPageActions]` slot is not
 * available to pages: each page renders its own toolbar beneath the heading.
 */
@Component({
  selector: 'app-secretary-shell',
  imports: [RouterOutlet, StaffLayout],
  templateUrl: './secretary-shell.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [SecretarySession],
})
export class SecretaryShell {
  private readonly router = inject(Router);
  private readonly session = inject(SecretarySession);

  protected readonly user = computed<StaffProfile>(() => ({
    name: this.session.profile().name,
    role: 'Secretary',
  }));

  /**
   * The menu, with the Messages badge filled in from the session.
   *
   * A computed rather than the constant, because the badge is a live count: it has
   * to fall as threads are read, and a static array cannot. The count is the same
   * one the list below it is showing, so the two cannot disagree about how much is
   * waiting.
   *
   * Zero renders as no badge rather than a "0" — an empty pill on a nav item reads
   * as something being wrong with the item.
   */
  protected readonly nav = computed<readonly StaffNavEntry[]>(() =>
    SECRETARY_NAV.map((item) =>
      item.id === 'messages'
        ? { ...item, badge: this.session.unreadMessageCount() || undefined }
        : item,
    ),
  );

  /**
   * Navigation counter, bumped after every completed navigation.
   *
   * `routerState.snapshot` is a mutable object, not a signal, so a `computed`
   * reading it would cache its first result forever and the heading would never
   * change after the first page load. Reading the snapshot inside a computed
   * that also reads this counter makes the dependency explicit.
   */
  private readonly navCount = signal(0);

  /**
   * Heading of the deepest matched route that declares one, with the patient's
   * name substituted where the route asks for it.
   */
  protected readonly pageTitle = computed(() => {
    this.navCount();
    const route = this.deepestRoute();
    const heading = route?.data?.['heading'];
    const fallback = typeof heading === 'string' && heading.length ? heading : null;
    return route?.data?.['headingFromPatient'] ? this.patientHeading(fallback) : fallback;
  });

  protected readonly breadcrumbs = computed<StaffCrumb[]>(() => {
    const heading = this.pageTitle();
    // The layout renders the final crumb as plain text, never as a link.
    return heading ? [{ label: 'Dashboard', route: DASHBOARD_ROUTE }, { label: heading }] : [];
  });

  /**
   * Whether this page fills the window rather than scrolling the document.
   *
   * Declared per route alongside `heading`, so a page asks for the viewport-sized
   * shell it needs instead of every page being sized to suit the one that wants it.
   *
   * Read from the deepest matched route rather than from `deepestRoute()`, which
   * deliberately skips any route that declares no `heading`. This page is exactly
   * such a route — it has no heading — so asking the heading-aware walk for it
   * returned the parent instead and the flag was silently never set.
   *
   * The navigation counter is read for the same reason `pageTitle` reads it: the
   * route snapshot is not a signal, so without it this would be decided once at
   * construction and never change as the user moves between pages.
   */
  protected readonly fillViewport = computed(() => {
    this.navCount();
    return this.leafRoute()?.data?.['fillViewport'] === true;
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

  /**
   * The deepest matched route that declares a heading.
   *
   * Returns the route rather than the heading so the caller can also read the
   * other `data` flags the routes declare.
   */
  private deepestRoute(): ActivatedRouteSnapshot | null {
    let route: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    let deepest: ActivatedRouteSnapshot | null = null;
    while (route) {
      if (typeof route.data?.['heading'] === 'string' && route.data['heading'].length) {
        deepest = route;
      }
      route = route.firstChild;
    }
    return deepest;
  }

  /**
   * The deepest matched route, whatever it declares.
   *
   * Distinct from `deepestRoute`, which only returns routes carrying a `heading` so
   * a parent cannot override a child's. That makes it the wrong walk for anything
   * read off a route that has no heading — and the messages page is one, by design.
   */
  private leafRoute(): ActivatedRouteSnapshot | null {
    let route = this.router.routerState.snapshot.root.firstChild;
    while (route?.firstChild) {
      route = route.firstChild;
    }
    return route ?? this.router.routerState.snapshot.root;
  }

  /**
   * The patient's name, for the details page heading.
   *
   * An id this desk cannot open falls back to the route's own heading rather than
   * rendering "undefined" — and because `patientById` only answers for the
   * assigned doctor's patients, an id belonging to somebody else's patient gets
   * the same fallback as an id nobody has, so the address bar cannot be used to
   * read a name off a record this desk may not see. The page body explains why
   * there is nothing there.
   */
  private patientHeading(fallback: string | null): string {
    const route = this.deepestRoute();
    const id = route?.paramMap.get('id');
    return (id ? this.session.patientById(id)?.name : null) ?? fallback ?? 'Patient';
  }
}
