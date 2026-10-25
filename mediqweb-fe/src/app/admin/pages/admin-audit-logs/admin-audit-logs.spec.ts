import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminSession } from '../../admin-session';
import { AdminAuditLogs } from './admin-audit-logs';

describe('AdminAuditLogs', () => {
  let fixture: ComponentFixture<AdminAuditLogs>;
  let session: AdminSession;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [AdminAuditLogs], providers: [AdminSession] });
    session = TestBed.inject(AdminSession);
    fixture = TestBed.createComponent(AdminAuditLogs);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function page(): any {
    return fixture.componentInstance;
  }

  it('lists every entry, newest first', () => {
    const rows = page().entries();
    expect(rows.length).toBe(session.auditEntries().length);
    const times = rows.map((e: any) => e.at);
    expect(times).toEqual([...times].sort((a, b) => b.localeCompare(a)));
  });

  it('filters by severity', () => {
    page().severity.set('warning');
    fixture.detectChanges();
    const rows = page().entries();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((e: any) => e.severity === 'warning')).toBe(true);
  });

  it('searches across actor, action and target', () => {
    page().query.set('Alex Rivera');
    fixture.detectChanges();
    expect(page().entries().length).toBeGreaterThan(0);

    page().query.set('Added specialization');
    fixture.detectChanges();
    expect(page().entries().length).toBeGreaterThan(0);
  });

  it('reports when nothing matches', () => {
    page().query.set('zzz-nothing');
    fixture.detectChanges();
    expect(text()).toContain('No entries match your filters.');
  });

  it('labels each severity in words rather than a bare colour', () => {
    expect(page().label('info')).toBe('Routine');
    expect(page().label('warning')).toBe('Needs attention');
    expect(page().label('danger')).toBe('Problem');
  });

  it('picks up entries added elsewhere in the area', () => {
    const before = page().entries().length;
    session.addSpecialization('Neurology', 'Brain and nerves.');
    fixture.detectChanges();
    expect(page().entries().length).toBe(before + 1);
  });

  it('disables export rather than faking a file', () => {
    const exportButton = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'),
    ).find((b) => b.textContent?.includes('Export'))!;
    expect(exportButton.disabled).toBe(true);
  });
});
