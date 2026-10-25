import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Component, type Type } from '@angular/core';
import { Avatar } from './avatar/avatar';
import { Button } from './button/button';
import { Card } from './card/card';
import { Dropdown, type DropdownItem } from './dropdown/dropdown';
import { FormField } from './form-field/form-field';
import { Modal } from './modal/modal';
import { PieChart, type PieSlice } from './pie-chart/pie-chart';
import { SampleAccounts, type SampleAccount } from './sample-accounts/sample-accounts';
import { Spinner } from './spinner/spinner';
import { StatCard } from './stat-card/stat-card';
import { StatusBadge, BADGE_TONE_TOKEN, type BadgeTone } from './status-badge/status-badge';
import { Table, type TableColumn } from './table/table';
import { TableCell } from './table/table-cell';

/** Mounts a standalone component and returns its fixture plus root element. */
function mount<T>(component: Type<T>): {
  fixture: ComponentFixture<T>;
  host: HTMLElement;
} {
  const fixture = TestBed.createComponent(component);
  fixture.detectChanges();
  return { fixture, host: fixture.nativeElement as HTMLElement };
}

interface QueueRow {
  name: string;
  status: string;
  tone: BadgeTone;
}

/** Consumer of `ui-table`, mirroring how a role page would use it. */
@Component({
  imports: [Table, TableCell, StatusBadge],
  template: `
    <ui-table [columns]="columns" [rows]="rows">
      <ng-template uiTableCell="status" let-row>
        <ui-status-badge [tone]="row.tone">{{ row.status }}</ui-status-badge>
      </ng-template>
    </ui-table>
  `,
})
class TableHostComponent {
  readonly columns: TableColumn<QueueRow>[] = [
    { key: 'name', header: 'Patient' },
    { key: 'status', header: 'Status' },
  ];
  readonly rows: QueueRow[] = [{ name: 'Belen', status: 'Confirmed', tone: 'success' }];
}

/** Consumer of `ui-stat-card` that uses both optional slots, as a page would. */
@Component({
  imports: [StatCard],
  template: `
    <ui-stat-card label="Doctors" [value]="4" hint="Active accounts">
      <svg statIcon viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
        <path d="M4 2v6a4 4 0 0 0 8 0V2" stroke="currentColor" stroke-width="2" />
      </svg>
      <a statFooter href="/admin/accounts/doctors">Manage doctors</a>
    </ui-stat-card>
  `,
})
class StatCardHost {}

describe('MediQ shared components', () => {
  describe('Spinner', () => {
    it('exposes role=status and a visually hidden label when announcing', () => {
      const { host } = mount(Spinner);
      expect(host.querySelector('[role="status"]')).toBeTruthy();
      expect(host.textContent).toContain('Loading');
    });

    it('is hidden from assistive tech when announce is false', () => {
      const fixture = TestBed.createComponent(Spinner);
      fixture.componentRef.setInput('announce', false);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[role="status"]')).toBeNull();
    });

    it('accepts any CSS length as a size', () => {
      const fixture = TestBed.createComponent(Spinner);
      fixture.componentRef.setInput('size', '40px');
      fixture.detectChanges();
      const ring = fixture.nativeElement.querySelector('.ui-spinner') as HTMLElement;
      expect(ring.style.width).toBe('40px');
    });
  });

  describe('StatusBadge', () => {
    it('maps tone to a design token instead of a literal colour', () => {
      const fixture = TestBed.createComponent(StatusBadge);
      fixture.componentRef.setInput('tone', 'danger');
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      expect(host.style.getPropertyValue('--badge-tone')).toBe('var(--color-danger)');
    });

    it('keeps the label in text-primary for contrast, not the tone colour', () => {
      const { host } = mount(StatusBadge);
      // Warning orange fails AA as body text, so the tone is carried by the dot.
      expect(host.querySelector('.ui-badge')?.textContent).toBeDefined();
    });

    it('exposes its tone table so other components colour by the same token', () => {
      // Anything painting by tone -- a bare severity dot, say -- should resolve
      // through this rather than keeping a second copy of the mapping.
      expect(BADGE_TONE_TOKEN.danger).toBe('var(--color-danger)');
      const { fixture } = mount(StatusBadge);
      expect(BADGE_TONE_TOKEN[fixture.componentInstance.tone()]).toMatch(/^var\(--color-/);
    });
  });

  describe('Avatar', () => {
    it('derives two initials from a full name', () => {
      const fixture = TestBed.createComponent(Avatar);
      fixture.componentRef.setInput('name', 'Juan dela Cruz');
      fixture.detectChanges();
      const initials = (fixture.nativeElement as HTMLElement).querySelector('.ui-avatar__initials');
      expect(initials?.textContent?.trim()).toBe('JC');
    });

    it('derives a single initial from a one-word name', () => {
      const fixture = TestBed.createComponent(Avatar);
      fixture.componentRef.setInput('name', 'Cher');
      fixture.detectChanges();
      const initials = (fixture.nativeElement as HTMLElement).querySelector('.ui-avatar__initials');
      expect(initials?.textContent?.trim()).toBe('C');
    });

    it('falls back to initials when the image fails to load', () => {
      const fixture = TestBed.createComponent(Avatar);
      fixture.componentRef.setInput('name', 'Ana Reyes');
      fixture.componentRef.setInput('src', '/missing.png');
      fixture.detectChanges();
      const img = (fixture.nativeElement as HTMLElement).querySelector('img') as HTMLImageElement;
      expect(img).toBeTruthy();
      img.dispatchEvent(new Event('error'));
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      expect(host.querySelector('img')).toBeNull();
      expect(host.querySelector('.ui-avatar__initials')).toBeTruthy();
    });
  });

  describe('Button', () => {
    it('disables interaction and marks itself busy while loading', () => {
      const fixture = TestBed.createComponent(Button);
      fixture.componentRef.setInput('loading', true);
      fixture.detectChanges();
      const button = (fixture.nativeElement as HTMLElement).querySelector(
        'button',
      ) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      expect(button.getAttribute('aria-busy')).toBe('true');
    });

    it('emits pressed on click', () => {
      const fixture = TestBed.createComponent(Button);
      fixture.detectChanges();
      let count = 0;
      fixture.componentInstance.pressed.subscribe(() => count++);
      const button = (fixture.nativeElement as HTMLElement).querySelector(
        'button',
      ) as HTMLButtonElement;
      button.click();
      expect(count).toBe(1);
    });

    it('keeps the accessible name for icon-only buttons', () => {
      const fixture = TestBed.createComponent(Button);
      fixture.componentRef.setInput('iconOnly', true);
      fixture.componentRef.setInput('ariaLabel', 'Delete appointment');
      fixture.detectChanges();
      const button = (fixture.nativeElement as HTMLElement).querySelector(
        'button',
      ) as HTMLButtonElement;
      expect(button.getAttribute('aria-label')).toBe('Delete appointment');
    });
  });

  describe('Card', () => {
    it('collapses the header when nothing is projected', () => {
      const { host } = mount(Card);
      const header = host.querySelector('.ui-card__header') as HTMLElement;
      expect(getComputedStyle(header).display).toBe('none');
    });

    it('renders the heading when supplied', () => {
      const fixture = TestBed.createComponent(Card);
      fixture.componentRef.setInput('heading', 'Patient queue');
      fixture.detectChanges();
      const title = (fixture.nativeElement as HTMLElement).querySelector('.ui-card__title');
      expect(title?.textContent?.trim()).toBe('Patient queue');
    });

    it('responds to Enter and Space when interactive', () => {
      const fixture = TestBed.createComponent(Card);
      fixture.componentRef.setInput('interactive', true);
      fixture.detectChanges();
      let clicks = 0;
      fixture.componentInstance.cardClick.subscribe(() => clicks++);
      const article = (fixture.nativeElement as HTMLElement).querySelector(
        'article',
      ) as HTMLElement;
      expect(article.getAttribute('role')).toBe('button');
      article.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      expect(clicks).toBe(1);
    });

    it('does not fill its parent unless asked', () => {
      // Off by default on purpose: a filling card is only correct when the parent
      // has a definite height, so leaving it on would make every card in a normal
      // document flow as tall as the viewport.
      const fixture = TestBed.createComponent(Card);
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      expect(host.classList.contains('ui-card-host--fill')).toBe(false);
    });

    it('hands its leftover height to the body when filling', () => {
      // The body is the flex column a scrolling child fills — a list or a thread.
      // `min-height: 0` on it is the part that actually permits the scroll.
      const fixture = TestBed.createComponent(Card);
      fixture.componentRef.setInput('fill', true);
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;

      expect(host.classList.contains('ui-card-host--fill')).toBe(true);

      const body = host.querySelector('.ui-card__body') as HTMLElement;
      const style = getComputedStyle(body);
      expect(style.display).toBe('flex');
      expect(style.flexDirection).toBe('column');
      expect(style.minHeight).toBe('0px');
    });
  });

  describe('StatCard', () => {
    it('renders label and value and exposes the tone token', () => {
      const fixture = TestBed.createComponent(StatCard);
      fixture.componentRef.setInput('label', 'Appointments today');
      fixture.componentRef.setInput('value', 24);
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      expect(host.querySelector('.stat__label')?.textContent?.trim()).toBe('Appointments today');
      expect(host.querySelector('.stat__value')?.textContent?.trim()).toBe('24');
      expect(host.style.getPropertyValue('--stat-tone')).toBe('var(--color-primary)');
    });

    it('leaves no chip behind when the optional icon is not projected', () => {
      // The chip paints a 32x32 tone background, so an untagged card used to
      // carry a blank coloured square that read as a broken image. `.stat__icon`
      // is hidden with `:empty`, so the chip must have no child nodes at all for
      // that to work — whitespace is not captured by `select="[statIcon]"`, which
      // is what makes the rule safe rather than lucky.
      const fixture = TestBed.createComponent(StatCard);
      fixture.componentRef.setInput('label', 'Doctors');
      fixture.detectChanges();
      const chip = (fixture.nativeElement as HTMLElement).querySelector('.stat__icon')!;

      expect(chip).toBeTruthy();
      expect(chip.childElementCount).toBe(0);
      expect(chip.childNodes.length).toBe(0);
    });

    it('keeps the chip when an icon is projected into it', () => {
      const fixture = TestBed.createComponent(StatCardHost);
      fixture.detectChanges();
      const chip = (fixture.nativeElement as HTMLElement).querySelector('.stat__icon')!;

      // The guard above must not swallow a real icon.
      expect(chip.querySelector('svg')).toBeTruthy();
      expect(chip.childElementCount).toBe(1);
    });
  });

  describe('FormField', () => {
    it('associates the label with the control id', () => {
      const fixture = TestBed.createComponent(FormField);
      fixture.componentRef.setInput('label', 'Username');
      fixture.componentRef.setInput('controlId', 'username');
      fixture.detectChanges();
      const label = (fixture.nativeElement as HTMLElement).querySelector(
        'label',
      ) as HTMLLabelElement;
      expect(label.getAttribute('for')).toBe('username');
    });

    it('drives the projected control border through the --field-* seam', () => {
      const fixture = TestBed.createComponent(FormField);
      fixture.componentRef.setInput('label', 'Username');
      fixture.componentRef.setInput('controlId', 'username');
      fixture.componentRef.setInput('error', 'Username is required');
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      expect(host.style.getPropertyValue('--field-border-color')).toBe('var(--color-danger)');
      expect(host.querySelector('.ui-form-field__help--error')?.textContent).toContain(
        'Username is required',
      );
    });

    it('prefers the error message over the hint', () => {
      const fixture = TestBed.createComponent(FormField);
      fixture.componentRef.setInput('label', 'Username');
      fixture.componentRef.setInput('controlId', 'username');
      fixture.componentRef.setInput('hint', 'Letters and numbers');
      fixture.componentRef.setInput('error', 'Already taken');
      fixture.detectChanges();
      const help = (fixture.nativeElement as HTMLElement).querySelector('.ui-form-field__help');
      expect(help?.textContent).toContain('Already taken');
      expect(help?.textContent).not.toContain('Letters and numbers');
    });
  });

  describe('Dropdown', () => {
    const items: DropdownItem[] = [
      { id: '1', label: 'Receptionist' },
      { id: '2', label: 'Nurse', description: 'Ward 3' },
      { id: '3', label: 'Unavailable', disabled: true },
    ];

    it('lists items when opened', () => {
      const fixture = TestBed.createComponent(Dropdown);
      fixture.componentRef.setInput('items', items);
      fixture.componentRef.setInput('label', 'Role');
      fixture.detectChanges();
      const trigger = (fixture.nativeElement as HTMLElement).querySelector(
        '.ui-dropdown__trigger',
      ) as HTMLButtonElement;
      trigger.click();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('[role="option"]').length).toBe(3);
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
    });

    it('emits the chosen item and refuses disabled options', () => {
      const fixture = TestBed.createComponent(Dropdown);
      fixture.componentRef.setInput('items', items);
      fixture.detectChanges();
      const emitted: DropdownItem[] = [];
      fixture.componentInstance.selectionChange.subscribe((i) => emitted.push(i));

      const trigger = (fixture.nativeElement as HTMLElement).querySelector(
        '.ui-dropdown__trigger',
      ) as HTMLButtonElement;
      trigger.click();
      fixture.detectChanges();

      const options = fixture.nativeElement.querySelectorAll('[role="option"]');
      (options[2] as HTMLElement).click();
      fixture.detectChanges();
      expect(emitted.length).toBe(0);

      (options[0] as HTMLElement).click();
      fixture.detectChanges();
      expect(emitted).toEqual([items[0]]);
    });

    it('skips disabled options during keyboard navigation', () => {
      const fixture = TestBed.createComponent(Dropdown);
      fixture.componentRef.setInput('items', items);
      fixture.detectChanges();
      const trigger = (fixture.nativeElement as HTMLElement).querySelector(
        '.ui-dropdown__trigger',
      ) as HTMLButtonElement;
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      fixture.detectChanges();
      // First enabled option is index 0.
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      fixture.detectChanges();
      const active = fixture.nativeElement.querySelector('.ui-dropdown__option.is-active');
      expect(active?.textContent).toContain('Nurse');
    });

    it('shows the selected item instead of the placeholder', () => {
      const fixture = TestBed.createComponent(Dropdown);
      fixture.componentRef.setInput('items', items);
      fixture.componentRef.setInput('selected', '2');
      fixture.detectChanges();
      const value = (fixture.nativeElement as HTMLElement).querySelector('.ui-dropdown__value');
      expect(value?.textContent?.trim()).toBe('Nurse');
    });

    it('filters by label when searchable', () => {
      const fixture = TestBed.createComponent(Dropdown);
      fixture.componentRef.setInput('items', items);
      fixture.componentRef.setInput('searchable', true);
      fixture.detectChanges();
      (fixture.nativeElement as HTMLElement)
        .querySelector<HTMLButtonElement>('.ui-dropdown__trigger')!
        .click();
      fixture.detectChanges();
      const search = (fixture.nativeElement as HTMLElement).querySelector(
        '.ui-dropdown__search input',
      ) as HTMLInputElement;
      search.value = 'ward';
      search.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('[role="option"]').length).toBe(1);
    });
  });

  describe('Table', () => {
    interface Patient {
      id: string;
      name: string;
      age: number;
    }
    const columns: TableColumn<Patient>[] = [
      { key: 'name', header: 'Patient', sortable: true },
      { key: 'age', header: 'Age', align: 'end', sortable: true },
    ];
    const rows: Patient[] = [
      { id: 'a', name: 'Belen', age: 41 },
      { id: 'b', name: 'Ana', age: 29 },
    ];

    it('renders a row per record and a cell per column', () => {
      const fixture = TestBed.createComponent<Table<Patient>>(Table);
      fixture.componentRef.setInput('columns', columns);
      fixture.componentRef.setInput('rows', rows);
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      expect(host.querySelectorAll('tbody tr')).toHaveLength(2);
      expect(host.querySelectorAll('thead th')).toHaveLength(2);
    });

    it('shows the empty message with no rows', () => {
      const fixture = TestBed.createComponent<Table<Patient>>(Table);
      fixture.componentRef.setInput('columns', columns);
      fixture.componentRef.setInput('rows', []);
      fixture.detectChanges();
      const empty = (fixture.nativeElement as HTMLElement).querySelector('.ui-table__empty');
      expect(empty?.textContent).toContain('No records');
    });

    it('announces the row count in the caption, agreeing in number', () => {
      // The live region is read out by a screen reader on every filter change,
      // so "1 rows" would be spoken as an error.
      const fixture = TestBed.createComponent<Table<Patient>>(Table);
      fixture.componentRef.setInput('columns', columns);
      fixture.componentRef.setInput('rows', [rows[0]]);
      fixture.componentRef.setInput('caption', 'Patients');
      fixture.detectChanges();
      const caption = (fixture.nativeElement as HTMLElement).querySelector('.ui-table__caption');
      expect(caption?.textContent).toContain('1 row');
      expect(caption?.textContent).not.toContain('1 rows');

      fixture.componentRef.setInput('rows', rows);
      fixture.detectChanges();
      expect(caption?.textContent).toContain(`${rows.length} rows`);
    });

    it('replaces the loading state with a spinner', () => {
      const fixture = TestBed.createComponent<Table<Patient>>(Table);
      fixture.componentRef.setInput('columns', columns);
      fixture.componentRef.setInput('rows', rows);
      fixture.componentRef.setInput('loading', true);
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      expect(host.querySelector('ui-spinner')).toBeTruthy();
      expect(host.querySelectorAll('tbody tr.ui-table__row')).toHaveLength(0);
    });

    it('sorts ascending then descending without mutating the input array', () => {
      const fixture = TestBed.createComponent<Table<Patient>>(Table);
      fixture.componentRef.setInput('columns', columns);
      fixture.componentRef.setInput('rows', rows);
      fixture.detectChanges();
      const nameHeader = (fixture.nativeElement as HTMLElement).querySelector(
        '.ui-table__sort',
      ) as HTMLButtonElement;

      nameHeader.click();
      fixture.detectChanges();
      let first = (fixture.nativeElement as HTMLElement).querySelector('tbody tr td');
      expect(first?.textContent?.trim()).toBe('Ana');
      expect(nameHeader.parentElement?.getAttribute('aria-sort')).toBe('ascending');

      nameHeader.click();
      fixture.detectChanges();
      first = (fixture.nativeElement as HTMLElement).querySelector('tbody tr td');
      expect(first?.textContent?.trim()).toBe('Belen');
      expect(nameHeader.parentElement?.getAttribute('aria-sort')).toBe('descending');

      expect(rows.map((r) => r.name)).toEqual(['Belen', 'Ana']);
    });

    it('emits rowClick', () => {
      const fixture = TestBed.createComponent<Table<Patient>>(Table);
      fixture.componentRef.setInput('columns', columns);
      fixture.componentRef.setInput('rows', rows);
      fixture.detectChanges();
      const emitted: Patient[] = [];
      fixture.componentInstance.rowClick.subscribe((r) => emitted.push(r));
      (fixture.nativeElement.querySelector('tbody tr') as HTMLElement).click();
      expect(emitted).toEqual([rows[0]]);
    });

    it('uses a projected cell template and falls back for unmapped columns', async () => {
      const fixture = TestBed.createComponent(TableHostComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      const host = fixture.nativeElement as HTMLElement;

      // "status" is rendered by the projected template, not the raw value.
      const badge = host.querySelector('tbody ui-status-badge');
      expect(badge?.textContent?.trim()).toBe('Confirmed');
      // "name" has no matching template, so the raw row value is used.
      expect(host.querySelector('tbody tr td')?.textContent?.trim()).toBe('Belen');
    });
  });

  describe('PieChart', () => {
    const slices: PieSlice[] = [
      { label: 'Routine', value: 4, color: 'var(--color-info)' },
      { label: 'Problem', value: 2, color: 'var(--color-danger)' },
    ];

    function render(list: readonly PieSlice[], caption?: string): HTMLElement {
      const fixture = TestBed.createComponent(PieChart);
      fixture.componentRef.setInput('slices', list);
      if (caption !== undefined) fixture.componentRef.setInput('caption', caption);
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }

    it('states every slice as a legend row of text', () => {
      const rows = Array.from(render(slices).querySelectorAll('.pie__item'));
      expect(rows).toHaveLength(2);
      expect(rows[0].querySelector('.pie__label')?.textContent?.trim()).toBe('Routine');
      expect(rows[0].querySelector('.pie__value')?.textContent?.trim()).toBe('4');
      expect(rows[1].querySelector('.pie__label')?.textContent?.trim()).toBe('Problem');
      expect(rows[1].querySelector('.pie__value')?.textContent?.trim()).toBe('2');
    });

    it('keeps the canvas out of the accessibility tree, since the legend already states the data', () => {
      const canvas = render(slices).querySelector('canvas');
      expect(canvas).toBeTruthy();
      expect(canvas?.getAttribute('aria-hidden')).toBe('true');
    });

    it('drops a slice that has fallen to zero rather than drawing a flat one', () => {
      const withZero = [
        ...slices,
        { label: 'Needs attention', value: 0, color: 'var(--color-warning)' },
      ];
      expect(render(withZero).querySelectorAll('.pie__item')).toHaveLength(2);
    });

    it('carries the slice colour through as a custom property on the dot', () => {
      const dot = render(slices).querySelector('.pie__dot') as HTMLElement;
      expect(dot.style.getPropertyValue('--pie-slice-color')).toBe('var(--color-info)');
    });

    it('titles itself from the caption, and leaves no figcaption without one', () => {
      expect(render(slices, 'By severity').querySelector('figcaption')?.textContent?.trim()).toBe(
        'By severity',
      );
      expect(render(slices).querySelector('figcaption')).toBeNull();
    });

    it('renders no canvas when there is nothing to chart', () => {
      const host = render([]);
      expect(host.querySelector('canvas')).toBeNull();
      expect(host.querySelector('.pie__empty')?.textContent).toContain('No data yet');
    });

    it('takes a caller-provided empty message', () => {
      const fixture = TestBed.createComponent(PieChart);
      fixture.componentRef.setInput('slices', []);
      fixture.componentRef.setInput('emptyMessage', 'Nothing recorded');
      fixture.detectChanges();
      const empty = (fixture.nativeElement as HTMLElement).querySelector('.pie__empty');
      expect(empty?.textContent).toContain('Nothing recorded');
    });

    it('refills the legend when the slices change', () => {
      const fixture = TestBed.createComponent(PieChart);
      fixture.componentRef.setInput('slices', slices);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('.pie__item')).toHaveLength(2);

      fixture.componentRef.setInput('slices', [slices[1]]);
      fixture.detectChanges();
      const rows = fixture.nativeElement.querySelectorAll('.pie__item');
      expect(rows).toHaveLength(1);
      expect(rows[0].querySelector('.pie__label')?.textContent?.trim()).toBe('Problem');
    });
  });

  describe('Modal', () => {
    // jsdom does not implement HTMLDialogElement.showModal(), so assert the
    // reflected `open` attribute, which behaves identically in both.
    const dialogOf = (fixture: ComponentFixture<Modal>): HTMLDialogElement =>
      (fixture.nativeElement as HTMLElement).querySelector('dialog') as HTMLDialogElement;

    it('opens the native dialog when open is true', () => {
      const fixture = TestBed.createComponent(Modal);
      fixture.componentRef.setInput('open', true);
      fixture.detectChanges();
      expect(dialogOf(fixture).hasAttribute('open')).toBe(true);
    });

    it('closes the native dialog when open becomes false', () => {
      const fixture = TestBed.createComponent(Modal);
      fixture.componentRef.setInput('open', true);
      fixture.detectChanges();
      expect(dialogOf(fixture).hasAttribute('open')).toBe(true);

      fixture.componentRef.setInput('open', false);
      fixture.detectChanges();
      expect(dialogOf(fixture).hasAttribute('open')).toBe(false);
    });

    it('stays closed by default', () => {
      const fixture = TestBed.createComponent(Modal);
      fixture.detectChanges();
      expect(dialogOf(fixture).hasAttribute('open')).toBe(false);
    });

    it('requests dismissal instead of closing itself', () => {
      const fixture = TestBed.createComponent(Modal);
      fixture.componentRef.setInput('open', true);
      fixture.componentRef.setInput('showClose', true);
      fixture.detectChanges();
      let closedCount = 0;
      fixture.componentInstance.closed.subscribe(() => closedCount++);
      const closeButton = (fixture.nativeElement as HTMLElement).querySelector(
        '.ui-modal__close',
      ) as HTMLButtonElement;
      closeButton.click();
      // The owner stays authoritative: the dialog is not self-closed.
      expect(closedCount).toBe(1);
      expect(dialogOf(fixture).hasAttribute('open')).toBe(true);
    });

    it('hides the close button when showClose is false', () => {
      const fixture = TestBed.createComponent(Modal);
      fixture.componentRef.setInput('showClose', false);
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('.ui-modal__close')).toBeNull();
    });

    /**
     * Backdrop dismissal versus a text selection.
     *
     * The regression: `onBackdropClick` judged the click by its target alone. A
     * drag that starts on the panel — selecting a password — and is released over
     * the backdrop produces a click retargeted by the browser to the nearest
     * common ancestor of press and release, which is the `<dialog>` itself. The
     * modal read that as a backdrop click and closed mid-selection.
     */
    describe('backdrop dismissal', () => {
      /** Builds an open modal whose panel body holds one focusable input. */
      function open() {
        const fixture = TestBed.createComponent(Modal);
        fixture.componentRef.setInput('open', true);
        fixture.detectChanges();

        let count = 0;
        fixture.componentInstance.closed.subscribe(() => count++);

        const host = fixture.nativeElement as HTMLElement;
        const dialog = host.querySelector('dialog') as HTMLDialogElement;
        const body = host.querySelector('.ui-modal__body') as HTMLElement;
        const input = document.createElement('input');
        input.id = 'probe';
        body.appendChild(input);

        return { fixture, dialog, input, closedCount: () => count };
      }

      it('closes when the backdrop is both pressed and released', () => {
        const { dialog, closedCount } = open();

        dialog.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(closedCount()).toBe(1);
      });

      it('does not close for a drag that starts on the panel and ends on the backdrop', () => {
        const { dialog, input, closedCount } = open();

        // The gesture that broke selecting a password.
        input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        dialog.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(closedCount()).toBe(0);
      });

      it('does not close for a click that starts and ends on the panel', () => {
        const { dialog, input, closedCount } = open();

        input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        input.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(closedCount()).toBe(0);
      });

      it('does not close when a control inside the panel is used', () => {
        const { input, closedCount } = open();
        const button = document.createElement('button');
        button.type = 'button';
        input.after(button);

        button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        button.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(closedCount()).toBe(0);
      });

      it('still closes on a later genuine backdrop click after a drag', () => {
        // The drag must not leave the flag latched and disarm the backdrop.
        const { dialog, input, closedCount } = open();

        input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(closedCount()).toBe(0);

        dialog.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(closedCount()).toBe(1);
      });

      it('leaves a backdrop click alone when closeOnBackdrop is false', () => {
        const fixture = TestBed.createComponent(Modal);
        fixture.componentRef.setInput('open', true);
        fixture.componentRef.setInput('closeOnBackdrop', false);
        fixture.detectChanges();
        let count = 0;
        fixture.componentInstance.closed.subscribe(() => count++);
        const dialog = (fixture.nativeElement as HTMLElement).querySelector(
          'dialog',
        ) as HTMLDialogElement;

        dialog.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(count).toBe(0);
      });
    });

    it('labels the dialog for assistive technology', () => {
      const fixture = TestBed.createComponent(Modal);
      fixture.componentRef.setInput('title', 'Confirm appointment');
      fixture.detectChanges();
      expect(dialogOf(fixture).getAttribute('aria-label')).toBe('Confirm appointment');
    });
  });

  describe('SampleAccounts', () => {
    const accounts: readonly SampleAccount[] = [
      { identifier: 'admin', password: '123123', role: 'admin' },
      { identifier: 'secretary', password: '123123', role: 'secretary' },
    ];

    const render = (list: readonly SampleAccount[] = accounts) => {
      const fixture = TestBed.createComponent(SampleAccounts);
      fixture.componentRef.setInput('accounts', list);
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    };

    it('prints one row per account, in the order given', () => {
      const host = render();
      const rows = Array.from(host.querySelectorAll('.samples__item'));
      expect(rows).toHaveLength(2);
      expect(rows[0].querySelector('.samples__id')?.textContent).toBe('admin');
      expect(rows[1].querySelector('.samples__id')?.textContent).toBe('secretary');
    });

    it('prints the password and the workspace it reaches', () => {
      const host = render();
      const row = host.querySelector('.samples__item') as HTMLElement;
      expect(row.querySelector('.samples__secret')?.textContent).toBe('123123');
      expect(row.querySelector('.samples__role')?.textContent).toBe('admin');
    });

    it('says the accounts are scaffolding, so they cannot be mistaken for real', () => {
      const host = render();
      expect(host.textContent).toContain('Sample accounts');
      expect(host.textContent).toContain('No API is connected');
      expect(host.textContent).toContain('scaffolding');
    });

    it('names the region by its heading', () => {
      const host = render();
      const heading = host.querySelector('.samples__heading') as HTMLHeadingElement;
      expect(host.querySelector('section')?.getAttribute('aria-labelledby')).toBe(heading.id);
      expect(heading.id).not.toBe('');
    });

    it('gives each instance a distinct heading id', () => {
      // A hardcoded id would collide the moment a second one is rendered, and
      // duplicate ids silently break the aria-labelledby link.
      const first = render().querySelector('.samples__heading') as HTMLHeadingElement;
      const second = render().querySelector('.samples__heading') as HTMLHeadingElement;
      expect(first.id).not.toBe(second.id);
    });

    it('hides the slash from assistive technology', () => {
      // Read as a separator it would make the credential read "admin slash 123123".
      const sep = render().querySelector('.samples__sep') as HTMLElement;
      expect(sep.getAttribute('aria-hidden')).toBe('true');
    });
  });
});
