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
import { DoctorSession } from './doctor-session';

const DASHBOARD_ROUTE = '/doctor/dashboard';

/**
 * Doctor menu. Declared once and used for both the sidebar and the mobile
 * drawer, so the two cannot drift apart. Logout is not here: the layout always
 * renders it, because every role needs a way out.
 */
const DOCTOR_NAV: readonly StaffNavEntry[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', route: DASHBOARD_ROUTE },
  { id: 'appointments', label: 'Appointments', icon: 'calendar', route: '/doctor/appointments' },
  { id: 'patients', label: 'Patients', icon: 'users', route: '/doctor/patients' },
  { id: 'schedule', label: 'Schedule', icon: 'clipboard', route: '/doctor/schedule' },
  // Above Profile, because it is a place to work rather than a setting about the
  // account. The icon is a clock with a rewind arrow, kept distinct from
  // `calendar` (Appointments) and `clipboard` (Schedule) — all three are about
  // time and a plain clock beside those two would be a coin toss.
  { id: 'history', label: 'Visit History', icon: 'history', route: '/doctor/history' },
  { id: 'profile', label: 'Profile', icon: 'settings', route: '/doctor/profile' },
];

/**
 * Route shell for the Doctor area.
 *
 * Mirrors the Admin shell: it owns the layout, the menu and the identity, then
 * projects a `router-outlet` so every page is its own lazy chunk. It also
 * publishes `DoctorSession`, scoping the mock store to this branch of the app.
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
  selector: 'app-doctor-shell',
  imports: [RouterOutlet, StaffLayout],
  templateUrl: './doctor-shell.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [DoctorSession],
})
export class DoctorShell {
  private readonly router = inject(Router);
  private readonly session = inject(DoctorSession);

  protected readonly user = computed<StaffProfile>(() => ({
    name: this.session.profile().name,
    role: 'Doctor',
  }));

  protected readonly nav = DOCTOR_NAV;

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
   * The patient's name, for the details page heading.
   *
   * Resolved through `patientForDoctor`, not a plain id lookup, so the heading
   * obeys the same boundary as the page: a patient this doctor has never been
   * given is not named in the title either. An id that matches nobody falls back
   * to the route's own heading rather than rendering "undefined".
   */
  private patientHeading(fallback: string | null): string {
    const route = this.deepestRoute();
    const id = route?.paramMap.get('id');
    return (id ? this.session.patientForDoctor(id)?.name : null) ?? fallback ?? 'Patient';
  }
}
