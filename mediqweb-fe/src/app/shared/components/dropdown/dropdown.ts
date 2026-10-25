import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

export interface DropdownItem {
  id: string;
  label: string;
  /** Secondary line, e.g. a patient id or role name. */
  description?: string;
  disabled?: boolean;
}

export type DropdownSize = 'sm' | 'md';
export type DropdownPlacement = 'bottom-start' | 'bottom-end';

let nextId = 0;

/**
 * Single-select listbox with a button trigger.
 *
 * Implemented as `role="combobox"` + `role="listbox"` with
 * `aria-activedescendant`, so the DOM focus stays on the trigger (or the
 * search box) and arrow keys move a virtual cursor. This is the pattern screen
 * readers expect from a custom select and avoids the focus traps of
 * `contenteditable`/`div`-based menus.
 */
@Component({
  selector: 'ui-dropdown',
  templateUrl: './dropdown.html',
  styleUrl: './dropdown.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.ui-dropdown--open]': 'opened()',
  },
})
export class Dropdown {
  readonly items = input<DropdownItem[]>([]);
  readonly selected = input<string | null>(null);
  /** Visible trigger text when nothing is selected. */
  readonly placeholder = input('Select');
  /** Accessible name for the trigger. */
  readonly label = input<string>('');
  readonly size = input<DropdownSize>('md');
  readonly placement = input<DropdownPlacement>('bottom-start');
  readonly disabled = input(false);
  /** Show a filter box above the options. */
  readonly searchable = input(false);
  readonly emptyMessage = input('No options available');

  readonly selectionChange = output<DropdownItem>();
  readonly openedChange = output<boolean>();
  readonly searchChange = output<string>();

  protected readonly opened = signal(false);
  protected readonly activeIndex = signal(-1);
  protected readonly query = signal('');

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly uid = `ui-dropdown-${++nextId}`;

  protected readonly listboxId = `${this.uid}-listbox`;
  protected readonly searchId = `${this.uid}-search`;

  protected readonly visibleItems = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.items();
    return this.items().filter(
      (item) =>
        item.label.toLowerCase().includes(q) || (item.description ?? '').toLowerCase().includes(q),
    );
  });

  protected readonly selectedItem = computed(
    () => this.items().find((item) => item.id === this.selected()) ?? null,
  );

  protected readonly triggerText = computed(() => this.selectedItem()?.label ?? this.placeholder());

  protected readonly activeDescendant = computed(() => {
    const item = this.visibleItems()[this.activeIndex()];
    return item ? this.optionId(item.id) : null;
  });

  protected optionId(id: string): string {
    return `${this.uid}-option-${id}`;
  }

  protected open(focusIndex?: number): void {
    if (this.disabled() || this.opened()) return;
    this.query.set('');
    this.activeIndex.set(focusIndex ?? this.initialIndex());
    this.opened.set(true);
    this.openedChange.emit(true);
    if (this.searchable()) {
      queueMicrotask(() => {
        document.getElementById(this.searchId)?.focus();
      });
    }
  }

  protected close(refocus = false): void {
    if (!this.opened()) return;
    this.opened.set(false);
    this.activeIndex.set(-1);
    this.openedChange.emit(false);
    if (refocus) {
      queueMicrotask(() => {
        const trigger =
          this.host.nativeElement.querySelector<HTMLButtonElement>('.ui-dropdown__trigger');
        trigger?.focus();
      });
    }
  }

  protected toggle(): void {
    this.opened() ? this.close() : this.open();
  }

  private initialIndex(): number {
    const selected = this.selected();
    if (selected) {
      const index = this.visibleItems().findIndex((item) => item.id === selected && !item.disabled);
      if (index >= 0) return index;
    }
    const firstEnabled = this.visibleItems().findIndex((item) => !item.disabled);
    return firstEnabled >= 0 ? firstEnabled : -1;
  }

  protected select(item: DropdownItem): void {
    if (item.disabled) return;
    this.selectionChange.emit(item);
    this.close(true);
  }

  protected onQuery(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.query.set(value);
    this.searchChange.emit(value);
    const firstEnabled = this.visibleItems().findIndex((item) => !item.disabled);
    this.activeIndex.set(firstEnabled >= 0 ? firstEnabled : -1);
  }

  protected move(delta: number): void {
    const items = this.visibleItems();
    if (items.length === 0) return;
    let index = this.activeIndex();
    for (let step = 0; step < items.length; step++) {
      index = (index + delta + items.length) % items.length;
      if (!items[index].disabled) {
        this.activeIndex.set(index);
        return;
      }
    }
  }

  protected moveTo(edge: 'first' | 'last'): void {
    const items = this.visibleItems();
    if (items.length === 0) return;
    const order =
      edge === 'first' ? items.map((_, i) => i) : items.map((_, i) => items.length - 1 - i);
    const found = order.find((i) => !items[i].disabled);
    if (found !== undefined) this.activeIndex.set(found);
  }

  protected commit(): void {
    const item = this.visibleItems()[this.activeIndex()];
    if (item) this.select(item);
  }

  protected onKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!this.opened()) this.open();
        else this.move(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (!this.opened()) this.open();
        else this.move(-1);
        break;
      case 'Home':
        if (this.opened()) {
          event.preventDefault();
          this.moveTo('first');
        }
        break;
      case 'End':
        if (this.opened()) {
          event.preventDefault();
          this.moveTo('last');
        }
        break;
      case 'Enter':
      case ' ':
      case 'Spacebar':
        event.preventDefault();
        if (this.opened()) this.commit();
        else this.open();
        break;
      case 'Escape':
        if (this.opened()) {
          event.preventDefault();
          this.close(true);
        }
        break;
      case 'Tab':
        this.close();
        break;
    }
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.opened()) return;
    if (!this.host.nativeElement.contains(event.target as Node)) this.close();
  }
}
