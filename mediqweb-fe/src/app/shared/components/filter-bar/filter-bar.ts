import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormField } from '../form-field/form-field';

let nextId = 0;

/**
 * Search box plus a slot for extra filters, shared by every list page that needs
 * to narrow a table down.
 *
 * The field is a plain view over a query string rather than a form control, so
 * a page can hold the term in a signal and filter with it. Projected controls
 * sit in the second column and wrap on narrow screens.
 *
 * ```html
 * <ui-filter-bar label="Search patients" [value]="query()" (queryChange)="query.set($event)">
 *   <ui-dropdown [items]="statusOptions" (selectionChange)="onStatus($event)" />
 * </ui-filter-bar>
 * ```
 */
@Component({
  selector: 'ui-filter-bar',
  imports: [FormField],
  templateUrl: './filter-bar.html',
  styleUrl: './filter-bar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterBar {
  /** Accessible name for the search field. */
  readonly label = input.required<string>();
  readonly placeholder = input('Search');
  readonly value = input('');

  readonly queryChange = output<string>();

  protected readonly controlId = `ui-filter-${++nextId}`;

  protected onInput(event: Event): void {
    this.queryChange.emit((event.target as HTMLInputElement).value);
  }
}
