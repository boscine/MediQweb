import { Component, type Type } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Button, Card } from '../components';
import { StaffLayout } from './staff-layout/staff-layout';
import type { StaffProfile } from './staff-layout/staff-layout.types';
import { StaffNav } from './staff-nav/staff-nav';
import type { StaffNavEntry, StaffNavItem } from './staff-nav/staff-nav.types';

/** Route targets for the links under test. */
@Component({ template: '' })
class StubPage {}

const ROUTES = [
  { path: '', component: StubPage },
  { path: 'login', component: StubPage },
  { path: 'admin', component: StubPage },
  { path: 'admin/dashboard', component: StubPage },
  { path: 'admin/patients', component: StubPage },
  { path: 'admin/patients/1', component: StubPage },
];

/** Stands in for a role's menu, e.g. the one an admin page would pass in. */
const ADMIN_NAV: StaffNavEntry[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', route: '/admin/dashboard' },
  { id: 'patients', label: 'Accounts', icon: 'users', route: '/admin/patients', badge: 12 },
  {
    id: 'management',
    label: 'Management',
    icon: 'folder',
    items: [
      { id: 'schedule', label: 'Schedule', icon: 'calendar', route: '/admin' },
      { id: 'settings', label: 'Settings', icon: 'settings', route: '/admin' },
    ],
  },
];

/** A menu with no routes yet, which is the state before the role pages land. */
const STATELESS_NAV: StaffNavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'accounts', label: 'Accounts', icon: 'users' },
  { id: 'locked', label: 'Billing', icon: 'folder', disabled: true },
];

const DOCTOR: StaffProfile = { name: 'Juan dela Cruz', role: 'Doctor' };

function mount<T>(component: Type<T>): ComponentFixture<T> {
  const fixture = TestBed.createComponent(component);
  fixture.detectChanges();
  return fixture;
}

describe('MediQ shared layouts', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(ROUTES)] });
  });

  describe('StaffNav', () => {
    const host = (fixture: ComponentFixture<StaffNav>) => fixture.nativeElement as HTMLElement;
    const links = (fixture: ComponentFixture<StaffNav>) =>
      Array.from(host(fixture).querySelectorAll<HTMLElement>('.nav__link'));

    it('renders a flat menu without section headings', () => {
      const fixture = mount(StaffNav);
      fixture.componentRef.setInput('nav', STATELESS_NAV);
      fixture.detectChanges();

      expect(links(fixture).length).toBe(4); // 3 items + logout
      expect(host(fixture).querySelector('.nav__group-label')).toBeNull();
    });

    it('renders groups with their heading', () => {
      const fixture = mount(StaffNav);
      fixture.componentRef.setInput('nav', [
        { id: 'main', label: 'Main', items: [STATELESS_NAV[0]] },
        { id: 'other', label: 'Other', items: [STATELESS_NAV[1]] },
      ]);
      fixture.detectChanges();

      const headings = Array.from(
        host(fixture).querySelectorAll<HTMLElement>('.nav__group-label'),
      ).map((el) => el.textContent?.trim());
      expect(headings).toEqual(['Main', 'Other']);
    });

    it('links an item that has a route and marks it current', async () => {
      const fixture = mount(StaffNav);
      fixture.componentRef.setInput('nav', ADMIN_NAV);
      fixture.detectChanges();

      const anchor = host(fixture).querySelector<HTMLAnchorElement>('a.nav__link')!;
      expect(anchor.getAttribute('href')).toBe('/admin/dashboard');
      expect(anchor.tagName).toBe('A');
    });

    it('activates the item matching the current route', async () => {
      const fixture = mount(StaffNav);
      fixture.componentRef.setInput('nav', ADMIN_NAV);
      fixture.detectChanges();

      await TestBed.inject(Router).navigateByUrl('/admin/patients');
      fixture.detectChanges();

      const active = host(fixture).querySelectorAll<HTMLElement>('a.nav__link.is-active');
      expect(active.length).toBe(1);
      expect(active[0].textContent).toContain('Accounts');
      expect(active[0].getAttribute('aria-current')).toBe('page');
    });

    it('does not activate a parent route for its children by default', async () => {
      const fixture = mount(StaffNav);
      fixture.componentRef.setInput('nav', [
        ...ADMIN_NAV,
        { id: 'patient', label: 'Patient', route: '/admin/patients' },
      ]);
      fixture.detectChanges();

      await TestBed.inject(Router).navigateByUrl('/admin/patients/1');
      fixture.detectChanges();

      const active = host(fixture).querySelectorAll<HTMLElement>('a.nav__link.is-active');
      expect(active.length).toBe(0);
    });

    it('activates a prefix match when exactMatch is false', async () => {
      const fixture = mount(StaffNav);
      fixture.componentRef.setInput('nav', [
        { id: 'patients', label: 'Accounts', route: '/admin/patients', exactMatch: false },
      ]);
      fixture.detectChanges();

      await TestBed.inject(Router).navigateByUrl('/admin/patients/1');
      fixture.detectChanges();

      expect(host(fixture).querySelectorAll('a.nav__link.is-active').length).toBe(1);
    });

    it('emits itemSelected for an item that has no route', () => {
      const fixture = mount(StaffNav);
      fixture.componentRef.setInput('nav', STATELESS_NAV);
      fixture.detectChanges();

      const emitted: StaffNavItem[] = [];
      fixture.componentInstance.itemSelected.subscribe((item) => emitted.push(item));

      links(fixture)[1].click();

      expect(emitted.map((item) => item.id)).toEqual(['accounts']);
    });

    it('ignores clicks on a disabled item', () => {
      const fixture = mount(StaffNav);
      fixture.componentRef.setInput('nav', STATELESS_NAV);
      fixture.detectChanges();

      const emitted: StaffNavItem[] = [];
      fixture.componentInstance.itemSelected.subscribe((item) => emitted.push(item));

      links(fixture)[2].click();

      expect(emitted).toEqual([]);
      expect(links(fixture)[2].getAttribute('disabled')).not.toBeNull();
    });

    it('highlights the active item when there is no route to match', () => {
      const fixture = mount(StaffNav);
      fixture.componentRef.setInput('nav', STATELESS_NAV);
      fixture.componentRef.setInput('activeId', 'dashboard');
      fixture.detectChanges();

      expect(links(fixture)[0].classList.contains('is-active')).toBe(true);
    });

    it('shows a badge when the item carries one', () => {
      const fixture = mount(StaffNav);
      fixture.componentRef.setInput('nav', ADMIN_NAV);
      fixture.detectChanges();

      expect(host(fixture).querySelector('.nav__badge')?.textContent?.trim()).toBe('12');
    });

    it('draws the icon for each item', () => {
      const fixture = mount(StaffNav);
      fixture.componentRef.setInput('nav', STATELESS_NAV);
      fixture.detectChanges();

      const icons = Array.from(host(fixture).querySelectorAll<SVGElement>('.nav__icon path'));
      expect(icons.length).toBe(4);
      expect(icons.every((path) => (path.getAttribute('d') ?? '').length > 0)).toBe(true);
    });

    it('offers logout to every role and can be told not to', () => {
      const fixture = mount(StaffNav);
      fixture.componentRef.setInput('nav', STATELESS_NAV);
      fixture.detectChanges();

      let logouts = 0;
      fixture.componentInstance.logout.subscribe(() => logouts++);
      host(fixture).querySelector<HTMLButtonElement>('.nav__link--logout')!.click();
      expect(logouts).toBe(1);

      fixture.componentRef.setInput('showLogout', false);
      fixture.detectChanges();
      expect(host(fixture).querySelector('.nav__link--logout')).toBeNull();
    });
  });

  describe('StaffLayout', () => {
    const build = (): ComponentFixture<StaffLayout> => {
      const fixture = TestBed.createComponent(StaffLayout);
      fixture.componentRef.setInput('user', DOCTOR);
      fixture.detectChanges();
      return fixture;
    };
    const host = (fixture: ComponentFixture<StaffLayout>) => fixture.nativeElement as HTMLElement;
    /** Sidebar instance, as distinct from the copy inside the mobile drawer. */
    const sidebarNav = (fixture: ComponentFixture<StaffLayout>) =>
      host(fixture).querySelector('.shell__sidebar app-staff-nav')!;
    const drawer = (fixture: ComponentFixture<StaffLayout>) =>
      host(fixture).querySelector('dialog')!;
    /** The logout prompt. The drawer is the first dialog in the DOM. */
    const confirmDialog = (fixture: ComponentFixture<StaffLayout>) =>
      host(fixture).querySelectorAll('dialog')[1] as HTMLDialogElement;
    /** A footer action of the logout prompt, by its visible label. */
    const footerButton = (fixture: ComponentFixture<StaffLayout>, label: string) =>
      Array.from(confirmDialog(fixture).querySelectorAll<HTMLButtonElement>('button')).find(
        (button) => button.textContent?.trim() === label,
      )!;
    const confirmLogout = (fixture: ComponentFixture<StaffLayout>) =>
      footerButton(fixture, 'Log out');

    it('shows the signed-in member in the header as plain text', () => {
      const fixture = build();
      const profile = host(fixture).querySelector('.shell__profile')!;

      expect(profile.textContent).toContain('Juan dela Cruz');
      expect(profile.textContent).toContain('Doctor');
      expect(profile.querySelector('ui-avatar')).toBeTruthy();
    });

    it('offers no profile menu, so the identity is not a control', () => {
      // A header that looks actionable but opens nothing costs a tab stop and
      // announces a button that does nothing. The Profile page is in the sidebar.
      const fixture = build();
      const header = host(fixture).querySelector('.shell__header')!;
      const profile = host(fixture).querySelector('.shell__profile')!;

      expect(header.querySelector('ui-dropdown')).toBeNull();
      expect(profile.querySelector('button')).toBeNull();
      expect(profile.getAttribute('tabindex')).toBeNull();
      expect(profile.textContent).not.toContain('My profile');
      expect(profile.textContent).not.toContain('Change password');
    });

    it('renders the same role menu in the sidebar and the mobile drawer', () => {
      const fixture = build();
      fixture.componentRef.setInput('nav', ADMIN_NAV);
      fixture.detectChanges();

      const sidebarItems = Array.from(
        sidebarNav(fixture).querySelectorAll<HTMLElement>('.nav__label'),
      ).map((el) => el.textContent?.trim());
      const drawerItems = Array.from(
        drawer(fixture).querySelectorAll<HTMLElement>('.nav__label'),
      ).map((el) => el.textContent?.trim());

      expect(sidebarItems).toEqual(['Dashboard', 'Accounts', 'Schedule', 'Settings', 'Logout']);
      expect(drawerItems).toEqual(sidebarItems);
      // The grouped section keeps its heading in both places.
      expect(sidebarNav(fixture).querySelector('.nav__group-label')?.textContent?.trim()).toBe(
        'Management',
      );
    });

    it('anchors the drawer to the left edge', () => {
      const fixture = build();
      expect(drawer(fixture).classList).toContain('ui-modal--at-left');
    });

    it('keeps the drawer closed until the menu button is used', () => {
      const fixture = build();
      expect(drawer(fixture).hasAttribute('open')).toBe(false);

      const menu = host(fixture).querySelector<HTMLButtonElement>('.shell__menu')!;
      expect(menu.getAttribute('aria-expanded')).toBe('false');

      menu.click();
      fixture.detectChanges();

      expect(drawer(fixture).hasAttribute('open')).toBe(true);
      expect(menu.getAttribute('aria-expanded')).toBe('true');
    });

    it('closes the drawer once a destination is chosen', () => {
      const fixture = build();
      fixture.componentRef.setInput('nav', STATELESS_NAV);
      fixture.detectChanges();

      const emitted: StaffNavItem[] = [];
      fixture.componentInstance.navSelected.subscribe((item) => emitted.push(item));

      host(fixture).querySelector<HTMLButtonElement>('.shell__menu')!.click();
      fixture.detectChanges();
      drawer(fixture).querySelectorAll<HTMLButtonElement>('.nav__link')[1].click();
      fixture.detectChanges();

      expect(emitted.map((item) => item.id)).toEqual(['accounts']);
      expect(drawer(fixture).hasAttribute('open')).toBe(false);
    });

    it('closes the drawer when the modal reports dismissal', () => {
      const fixture = build();
      host(fixture).querySelector<HTMLButtonElement>('.shell__menu')!.click();
      fixture.detectChanges();
      expect(drawer(fixture).hasAttribute('open')).toBe(true);

      drawer(fixture).querySelector<HTMLButtonElement>('.ui-modal__close')!.click();
      fixture.detectChanges();

      expect(drawer(fixture).hasAttribute('open')).toBe(false);
    });

    it('emits logout rather than signing anyone out itself', () => {
      const fixture = build();
      let logouts = 0;
      fixture.componentInstance.logout.subscribe(() => logouts++);

      sidebarNav(fixture).querySelector<HTMLButtonElement>('.nav__link--logout')!.click();
      fixture.detectChanges();
      confirmLogout(fixture).click();
      fixture.detectChanges();

      expect(logouts).toBe(1);
    });

    it('asks before logging out instead of signing out on the first click', () => {
      // One click to ask, one to confirm. Signing out discards whatever is in
      // the form on screen, and the nav item is easy to hit by muscle memory.
      const fixture = build();
      let logouts = 0;
      fixture.componentInstance.logout.subscribe(() => logouts++);

      expect(confirmDialog(fixture).hasAttribute('open')).toBe(false);

      sidebarNav(fixture).querySelector<HTMLButtonElement>('.nav__link--logout')!.click();
      fixture.detectChanges();

      expect(logouts).toBe(0);
      expect(confirmDialog(fixture).hasAttribute('open')).toBe(true);
    });

    it('keeps the user signed in when the prompt is dismissed', () => {
      // Both routes out of the dialog that are not the danger button: the
      // Cancel button, and Escape or a backdrop click, which emit `closed`.
      for (const dismiss of ['cancel', 'escape', 'backdrop'] as const) {
        const fixture = build();
        let logouts = 0;
        fixture.componentInstance.logout.subscribe(() => logouts++);
        sidebarNav(fixture).querySelector<HTMLButtonElement>('.nav__link--logout')!.click();
        fixture.detectChanges();

        if (dismiss === 'cancel') {
          footerButton(fixture, 'Cancel').click();
        } else if (dismiss === 'escape') {
          confirmDialog(fixture).dispatchEvent(new Event('cancel'));
        } else {
          confirmDialog(fixture).click();
        }
        fixture.detectChanges();

        expect(logouts, dismiss).toBe(0);
        expect(confirmDialog(fixture).hasAttribute('open'), dismiss).toBe(false);
      }
    });

    it('asks the question the way the user would put it', () => {
      const fixture = build();
      sidebarNav(fixture).querySelector<HTMLButtonElement>('.nav__link--logout')!.click();
      fixture.detectChanges();

      const dialog = confirmDialog(fixture);
      expect(dialog.querySelector('.ui-modal__title')?.textContent?.trim()).toBe('Log out');
      expect(dialog.textContent).toContain('Are you sure you want to log out?');
    });

    it('closes the nav drawer before asking, rather than stacking two dialogs', () => {
      // Logout is reached through the drawer on small screens, and two open
      // dialogs in the top layer at once is a mess to dismiss.
      const fixture = build();
      fixture.componentInstance['navOpen'].set(true);
      fixture.detectChanges();
      expect(drawer(fixture).hasAttribute('open')).toBe(true);

      drawer(fixture)
        .querySelector('app-staff-nav')!
        .querySelector<HTMLButtonElement>('.nav__link--logout')!
        .click();
      fixture.detectChanges();

      expect(drawer(fixture).hasAttribute('open')).toBe(false);
      expect(confirmDialog(fixture).hasAttribute('open')).toBe(true);
    });

    it('renders the page title as the only h1', () => {
      const fixture = build();
      fixture.componentRef.setInput('pageTitle', 'Appointments');
      fixture.detectChanges();

      const heading = host(fixture).querySelector('h1')!;
      expect(heading.textContent?.trim()).toBe('Appointments');
      expect(host(fixture).querySelectorAll('h1').length).toBe(1);
    });

    it('omits the heading when the page does not declare a title', () => {
      const fixture = build();
      expect(host(fixture).querySelector('h1')).toBeNull();
    });

    it('marks the final breadcrumb as the current page', () => {
      const fixture = build();
      fixture.componentRef.setInput('breadcrumbs', [
        { label: 'Home', route: '/' },
        { label: 'Accounts', route: '/admin' },
        { label: 'Juan dela Cruz' },
      ]);
      fixture.detectChanges();

      const crumbs = Array.from(host(fixture).querySelectorAll<HTMLElement>('.shell__crumb'));
      expect(crumbs.map((el) => el.textContent?.trim())).toEqual([
        'Home',
        'Accounts',
        'Juan dela Cruz',
      ]);
      expect(crumbs[2].querySelector('[aria-current="page"]')).toBeTruthy();
      // Ancestors stay clickable; only the current page is not a link.
      expect(crumbs[0].querySelector('a')).toBeTruthy();
    });

    it('renders no breadcrumb trail when none is given', () => {
      const fixture = build();
      expect(host(fixture).querySelector('.shell__crumbs')).toBeNull();
    });

    it('points the skip link at the main region', () => {
      const fixture = build();
      const skip = host(fixture).querySelector<HTMLAnchorElement>('.shell__skip')!;
      const main = host(fixture).querySelector('main')!;

      expect(skip.getAttribute('href')).toBe(`#${main.id}`);
      expect(main.id).toBeTruthy();
    });

    it('gives each instance a unique main id', () => {
      const first = build();
      const second = build();
      const idOf = (fixture: ComponentFixture<StaffLayout>) =>
        host(fixture).querySelector('main')!.id;

      expect(idOf(first)).not.toBe(idOf(second));
    });
  });

  describe('content projection', () => {
    @Component({
      imports: [Button, Card, StaffLayout],
      template: `
        <app-staff-layout [user]="user" [nav]="nav" pageTitle="Accounts">
          <ui-button staffPageActions>New account</ui-button>
          <ui-card>Account list goes here.</ui-card>
        </app-staff-layout>
      `,
    })
    class RolePage {
      readonly user = DOCTOR;
      readonly nav: StaffNavEntry[] = ADMIN_NAV;
    }

    it('places page actions in the heading row and content below it', () => {
      const fixture = TestBed.createComponent(RolePage);
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;

      const actions = host.querySelector('.shell__actions ui-button')!;
      const card = host.querySelector('main ui-card')!;
      const headingRow = host.querySelector('.shell__title-row')!;

      expect(actions.textContent).toContain('New account');
      expect(card.textContent).toContain('Account list goes here.');
      expect(headingRow.contains(actions)).toBe(true);
      expect(headingRow.contains(card)).toBe(false);
    });
  });

  describe('a page that fills the window', () => {
    @Component({
      imports: [Button, Card, StaffLayout],
      template: `<app-staff-layout
        [user]="user"
        [nav]="nav"
        [fillViewport]="fill"
        [pageTitle]="title"
      >
        @if (withAction) {
          <button staffPageActions>New account</button>
        }
        <ui-card>Working surface.</ui-card>
      </app-staff-layout>`,
    })
    class FilledPage {
      readonly user = DOCTOR;
      readonly nav: StaffNavEntry[] = ADMIN_NAV;
      /** A plain field, not an input: the test sets it directly. */
      fill = false;
      /** A heading and a projected action, so the heading row's two inputs can
       *  be exercised without needing a second host component. */
      title: string | null = null;
      withAction = false;
    }

    function build(
      fill: boolean,
      title: string | null = null,
      withAction = false,
    ): ComponentFixture<FilledPage> {
      const fixture = TestBed.createComponent(FilledPage);
      fixture.componentInstance.fill = fill;
      fixture.componentInstance.title = title;
      fixture.componentInstance.withAction = withAction;
      fixture.detectChanges();
      return fixture;
    }

    function shellClass(fixture: ComponentFixture<unknown>): string {
      const layout = (fixture.nativeElement as HTMLElement).querySelector('app-staff-layout');
      return layout?.className ?? '';
    }

    it('is off unless a page asks for it', () => {
      expect(shellClass(build(false))).not.toContain('staff-layout-host--fill');
    });

    it('marks the shell when the page asks for it', () => {
      // The class is what the viewport-sized geometry hangs off, so a page that
      // asks and gets no class would scroll the window instead of its own panels.
      expect(shellClass(build(true))).toContain('staff-layout-host--fill');
    });

    it('renders no heading when there is none, and leaves no empty row behind', () => {
      // A page may declare no heading, as the messages page does. The row owns a
      // bottom margin, so if it stayed it would leave a band of dead space above
      // the content — the whole reason for asking for the space in the first place.
      //
      // Asserted on the bound class rather than on `:has()`. The rule used to be
      // `:not(:has(.shell__title)):not(:has(.shell__actions > *))`, which jsdom
      // matches unreliably — this assertion failed about one full run in six with
      // nothing else in the suite changed, and the failure was invisible in any
      // browser.
      const host = build(true).nativeElement as HTMLElement;

      expect(host.querySelector('.shell__title')).toBeNull();
      expect(host.querySelector('.shell__crumbs')).toBeNull();
      const row = host.querySelector('.shell__title-row')!;
      expect(row.classList.contains('shell__title-row--untitled')).toBe(true);
      expect(getComputedStyle(row).marginBottom).toBe('0px');
      // The actions wrapper collapses on its own, so the row takes no height.
      expect(getComputedStyle(host.querySelector('.shell__actions')!).display).toBe('none');
    });

    it('keeps the row’s spacing when the page does declare a heading', () => {
      const host = build(true, 'Accounts').nativeElement as HTMLElement;
      const row = host.querySelector('.shell__title-row')!;

      expect(row.classList.contains('shell__title-row--untitled')).toBe(false);
      // jsdom reports a declaration as written — `var(--space-6)`, not a resolved
      // 24px — so this asserts that the modifier's `0` is not the one applying,
      // rather than pinning a number this environment cannot compute.
      expect(getComputedStyle(row).marginBottom).not.toBe('0px');
    });

    it('still shows a projected action when the page declares no heading', () => {
      // The row is what holds the action, so dropping its margin must not be
      // mistaken for dropping the row. This is why the fix trims the margin
      // rather than hiding the element.
      const host = build(true, null, true).nativeElement as HTMLElement;
      const row = host.querySelector('.shell__title-row')!;

      expect(row.classList.contains('shell__title-row--untitled')).toBe(true);
      expect(row.textContent).toContain('New account');
      expect(getComputedStyle(host.querySelector('.shell__actions')!).display).not.toBe('none');
    });
  });
});
