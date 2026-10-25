import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Avatar, Brand, Button, Modal } from '../../components';
import { StaffNav } from '../staff-nav/staff-nav';
import { StaffNavEntry, StaffNavItem } from '../staff-nav/staff-nav.types';
import { StaffCrumb, StaffProfile } from './staff-layout.types';

let nextId = 0;

/**
 * Application shell for signed-in staff: header, sidebar and content area.
 *
 * Deliberately knows nothing about authentication. It renders a `StaffProfile`
 * and emits `logout`, so guarding and session teardown stay with the route
 * layer and the future AuthService rather than being smuggled into the layout.
 *
 * The same `nav` array feeds the desktop sidebar and the mobile drawer, so a
 * role's menu is declared once and cannot drift between breakpoints.
 */
@Component({
  selector: 'app-staff-layout',
  imports: [RouterLink, Avatar, Brand, Button, Modal, StaffNav],
  templateUrl: './staff-layout.html',
  styleUrl: './staff-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.staff-layout-host--fill]': 'fillViewport()',
  },
})
export class StaffLayout {
  readonly user = input.required<StaffProfile>();
  /** Per-role menu. Accepts a flat list or explicit groups. */
  readonly nav = input<readonly StaffNavEntry[]>([]);
  /** Highlights an item when it has no route of its own. */
  readonly activeItemId = input<string | null>(null);
  readonly pageTitle = input<string | null>(null);
  readonly breadcrumbs = input<readonly StaffCrumb[]>([]);
  /**
   * Makes the shell exactly one viewport tall and hands the leftover height to the
   * page, so the page scrolls its own panels instead of the window scrolling.
   *
   * For a page that is a working surface rather than a document — a message desk,
   * a calendar, a log — where scrolling the whole window would scroll the
   * conversation header and the composer off the screen.
   *
   * Only applied from `$sidebar-breakpoint` up. Below it the sidebar is a drawer and
   * the main column is one narrow stack, where a viewport-locked shell would clip
   * whatever did not fit; those widths scroll the document as usual.
   */
  readonly fillViewport = input(false);
  /** Destination for the brand mark. */
  readonly brandLink = input('/');
  readonly showLogout = input(true);

  readonly logout = output<void>();
  readonly navSelected = output<StaffNavItem>();

  protected readonly navOpen = signal(false);
  protected readonly logoutConfirmOpen = signal(false);
  protected readonly mainId = `staff-main-${++nextId}`;

  /**
   * Whether the page declared a heading of its own.
   *
   * The row's dead space used to be removed in CSS with
   * `:not(:has(.shell__title)):not(:has(.shell__actions > *))`. That matches in a
   * browser and cannot be asserted: jsdom's `:has()` support is unreliable, and
   * the shell's only guarantee about not leaving a dead band above a heading-less
   * page was resting on a selector that failed roughly one full run in six.
   *
   * Dropping the row's bottom margin says the same thing and needs nothing beyond
   * a boolean. The row is not hidden outright, because a page may project an
   * action and no title — the row is what holds that action, so it has to stay.
   * With no title and no action the actions wrapper is already `:empty` and
   * collapses to nothing, leaving an empty row that neither takes height nor
   * margin.
   */
  protected readonly hasTitle = computed(() => Boolean(this.pageTitle()));

  protected onNavSelected(item: StaffNavItem): void {
    this.navSelected.emit(item);
    // Never leave the drawer covering the page the user just chose.
    this.navOpen.set(false);
  }

  protected closeNav(): void {
    this.navOpen.set(false);
  }

  /**
   * Asks before signing out instead of doing it.
   *
   * Signing out throws away whatever is in the form on screen, and the nav item
   * sits at the bottom of a long menu where it is easy to reach by muscle
   * memory rather than by intent. One click to ask, one to confirm.
   *
   * The drawer is closed first. It is how logout is reached on small screens,
   * and leaving it open would stack two dialogs in the top layer at once.
   */
  protected requestLogout(): void {
    this.navOpen.set(false);
    this.logoutConfirmOpen.set(true);
  }

  protected confirmLogout(): void {
    this.logoutConfirmOpen.set(false);
    this.logout.emit();
  }

  protected cancelLogout(): void {
    this.logoutConfirmOpen.set(false);
  }
}
