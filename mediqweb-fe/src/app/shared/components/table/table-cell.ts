import { Directive, TemplateRef, inject, input } from '@angular/core';

/**
 * Marks an `<ng-template>` as the custom renderer for one column.
 *
 * ```html
 * <ui-table [columns]="columns" [rows]="patients">
 *   <ng-template uiTableCell="status" let-row>
 *     <ui-status-badge [tone]="row.statusTone">{{ row.status }}</ui-status-badge>
 *   </ng-template>
 * </ui-table>
 * ```
 *
 * Columns with no matching template fall back to `row[column.key]`.
 */
@Directive({
  selector: 'ng-template[uiTableCell]',
})
export class TableCell {
  readonly uiTableCell = input.required<string>({ alias: 'uiTableCell' });
  readonly templateRef = inject<TemplateRef<unknown>>(TemplateRef);
}
