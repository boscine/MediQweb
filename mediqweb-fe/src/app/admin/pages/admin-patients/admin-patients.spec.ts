import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminSession } from '../../admin-session';
import { AdminPatients } from './admin-patients';

describe('AdminPatients', () => {
  let fixture: ComponentFixture<AdminPatients>;
  let session: AdminSession;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [AdminPatients], providers: [AdminSession] });
    session = TestBed.inject(AdminSession);
    fixture = TestBed.createComponent(AdminPatients);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function page(): any {
    return fixture.componentInstance;
  }

  it('lists every patient', () => {
    expect(page().patients().length).toBe(session.patients().length);
  });

  it('filters by name', () => {
    const target = session.patients()[0].name;
    page().query.set(target);
    fixture.detectChanges();
    expect(page().patients().length).toBe(1);
  });

  it('filters by contact number', () => {
    const target = session.patients()[0].phone;
    page().query.set(target);
    fixture.detectChanges();
    expect(page().patients().length).toBe(1);
  });

  it('filters by status', () => {
    page().statusFilter.set('inactive');
    fixture.detectChanges();
    const rows = page().patients();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((p: any) => p.status === 'inactive')).toBe(true);
  });

  it('waits for confirmation before disabling', () => {
    const active = session.patients().find((p) => p.status === 'active')!;
    page().requestDisable(active);
    fixture.detectChanges();
    expect(session.patients().find((p) => p.id === active.id)!.status).toBe('active');
  });

  it('disables on confirmation and re-enables afterwards', () => {
    const active = session.patients().find((p) => p.status === 'active')!;
    page().requestDisable(active);
    page().confirmDisable();
    expect(session.patients().find((p) => p.id === active.id)!.status).toBe('inactive');

    page().enable(active);
    expect(session.patients().find((p) => p.id === active.id)!.status).toBe('active');
  });

  it('does not offer patient creation, which belongs to a Secretary', () => {
    expect(text()).not.toContain('Add patient');
    expect(text()).toContain('opened by a Secretary');
  });

  it('states plainly that the data is a sample', () => {
    expect(text()).toContain('Sample data.');
  });
});
