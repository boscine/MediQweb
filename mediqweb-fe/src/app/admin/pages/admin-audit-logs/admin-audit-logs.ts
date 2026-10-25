import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  Button,
  Card,
  Dropdown,
  FilterBar,
  MockNotice,
  StatusBadge,
  Table,
  TableCell,
  type BadgeTone,
  type DropdownItem,
  type TableColumn,
} from '../../../shared/components';
import { AdminSession } from '../../admin-session';
import type { AuditEntry, AuditSeverity } from '../../admin.models';

type SeverityFilter = 'all' | AuditSeverity;

const SEVERITY_ITEMS: DropdownItem[] = [
  { id: 'all', label: 'All severities' },
  { id: 'info', label: 'Routine' },
  { id: 'warning', label: 'Needs attention' },
  { id: 'danger', label: 'Problem' },
];

/** Severity and its badge tone are the same set, so one map serves both. */
const SEVERITY_TONE: Record<AuditSeverity, BadgeTone> = {
  info: 'info',
  warning: 'warning',
  danger: 'danger',
};

const SEVERITY_LABEL: Record<AuditSeverity, string> = {
  info: 'Routine',
  warning: 'Needs attention',
  danger: 'Problem',
};

/**
 * Read-only record of who changed what.
 *
 * Nothing on this page mutates state: an audit log that could be edited would
 * not be worth reading. Export is present but disabled, because producing a file
 * of a real log is a server concern and faking one would be misleading.
 */
@Component({
  selector: 'app-admin-audit-logs',
  imports: [DatePipe, Button, Card, Dropdown, StatusBadge, Table, TableCell, FilterBar, MockNotice],
  templateUrl: './admin-audit-logs.html',
  styleUrl: './admin-audit-logs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAuditLogs {
  private readonly session = inject(AdminSession);

  protected readonly query = signal('');
  protected readonly severity = signal<SeverityFilter>('all');

  protected readonly severityItems = SEVERITY_ITEMS;

  protected readonly columns: TableColumn<AuditEntry>[] = [
    { key: 'at', header: 'When', sortable: true },
    { key: 'actor', header: 'Who', sortable: true },
    { key: 'action', header: 'Action', sortable: true },
    { key: 'target', header: 'Target', sortable: true, hideBelow: 'md' },
    { key: 'severity', header: 'Severity', sortable: true },
  ];

  protected readonly entries = computed(() => {
    const term = this.query().trim().toLowerCase();
    const severity = this.severity();
    return this.session
      .auditEntries()
      .filter((entry) => severity === 'all' || entry.severity === severity)
      .filter((entry) => {
        if (!term) return true;
        return [entry.actor, entry.action, entry.target].some((field) =>
          field.toLowerCase().includes(term),
        );
      })
      .sort((a, b) => b.at.localeCompare(a.at));
  });

  protected readonly totalCount = computed(() => this.session.auditEntries().length);

  protected onSeverityChange(item: DropdownItem): void {
    this.severity.set(item.id as SeverityFilter);
  }

  protected tone(severity: AuditSeverity): BadgeTone {
    return SEVERITY_TONE[severity];
  }

  protected label(severity: AuditSeverity): string {
    return SEVERITY_LABEL[severity];
  }
}
