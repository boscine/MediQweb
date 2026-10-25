import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  contentChildren,
  input,
  output,
  signal,
} from '@angular/core';
import { Spinner } from '../spinner/spinner';
import { TableCell } from './table-cell';

export interface TableColumn<Row = any> {
  /** Property read from the row when no custom cell template is supplied. */
  key: string;
  header: string;
  align?: 'start' | 'center' | 'end';
  sortable?: boolean;
  /** Any CSS width, e.g. `12rem` or `20%`. */
  width?: string;
  /** Hide the column below the given breakpoint. */
  hideBelow?: 'sm' | 'md' | 'lg';
}

export type SortDirection = 'asc' | 'desc';

export interface TableSort<Row = any> {
  key: string;
  direction: SortDirection;
  column: TableColumn<Row>;
}

/**
 * Data table with optional client-side sorting and per-column cell templates.
 *
 * Sorts a computed copy of `rows` rather than mutating the input array, and
 * emits `sortChange` so a caller backed by an API can sort server-side instead
 * (by passing a pre-sorted `rows` and ignoring the internal state).
 *
 * Renders a live-region caption so row-count changes are announced.
 */
@Component({
  selector: 'ui-table',
  imports: [NgTemplateOutlet, Spinner],
  templateUrl: './table.html',
  styleUrl: './table.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Table<Row = any> {
  readonly columns = input.required<TableColumn<Row>[]>();
  readonly rows = input<Row[]>([]);
  /** Stable key for `@for` tracking; falls back to the row index. */
  readonly rowKey = input<string | null>(null);
  readonly caption = input<string>('');
  readonly loading = input(false);
  readonly emptyMessage = input('No records to display');
  readonly striped = input(false);
  readonly stickyHeader = input(false);

  readonly sortChange = output<TableSort<Row>>();
  readonly rowClick = output<Row>();

  private readonly cellTemplates = contentChildren(TableCell);

  protected readonly sortKey = signal<string | null>(null);
  protected readonly sortDirection = signal<SortDirection>('asc');

  protected templateFor(key: string): TemplateRef<unknown> | null {
    return this.cellTemplates().find((t) => t.uiTableCell() === key)?.templateRef ?? null;
  }

  protected readonly sortedRows = computed(() => {
    const key = this.sortKey();
    const rows = [...this.rows()];
    if (!key) return rows;
    const direction = this.sortDirection() === 'asc' ? 1 : -1;
    return rows.sort((a: any, b: any) => {
      const av = a?.[key];
      const bv = b?.[key];
      if (av === bv) return 0;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * direction;
      return String(av).localeCompare(String(bv), undefined, { numeric: true }) * direction;
    });
  });

  protected readonly rowCount = computed(() => this.sortedRows().length);

  protected trackRow = (index: number, row: Row): unknown => {
    const key = this.rowKey();
    return key ? ((row as any)?.[key] ?? index) : index;
  };

  protected isSorted(key: string): boolean {
    return this.sortKey() === key;
  }

  protected ariaSort(key: string): 'ascending' | 'descending' | 'none' {
    if (!this.isSorted(key)) return 'none';
    return this.sortDirection() === 'asc' ? 'ascending' : 'descending';
  }

  protected onSort(column: TableColumn<Row>): void {
    if (!column.sortable) return;
    const key = column.key;
    const direction: SortDirection =
      this.sortKey() === key && this.sortDirection() === 'asc' ? 'desc' : 'asc';
    this.sortKey.set(key);
    this.sortDirection.set(direction);
    this.sortChange.emit({ key, direction, column });
  }

  protected cellValue(row: Row, key: string): unknown {
    return (row as any)?.[key] ?? '';
  }
}
