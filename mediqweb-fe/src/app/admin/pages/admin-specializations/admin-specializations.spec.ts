import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { clearToasts, latestToast } from '../../../core/services/toast.service.spec-helpers';
import { AdminSession } from '../../admin-session';
import { AdminSpecializations } from './admin-specializations';

describe('AdminSpecializations', () => {
  let fixture: ComponentFixture<AdminSpecializations>;
  let session: AdminSession;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [AdminSpecializations], providers: [AdminSession] });
    session = TestBed.inject(AdminSession);
    fixture = TestBed.createComponent(AdminSpecializations);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  // Disarms the dismissal timers the toasts arm.
  afterEach(() => clearToasts());

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function page(): any {
    return fixture.componentInstance;
  }

  it('lists every specialization from the session', () => {
    expect(page().specializations().length).toBe(session.specializations().length);
  });

  it('counts the doctors assigned to each specialization', () => {
    const cardio = page()
      .specializations()
      .find((s: any) => s.id === 'spec-cardio');
    const doctors = session.doctors().filter((d) => d.specializationId === 'spec-cardio');
    expect(cardio.doctorCount).toBe(doctors.length);
  });

  it('filters by name', () => {
    page().query.set('cardio');
    fixture.detectChanges();
    expect(page().specializations().length).toBe(1);
  });

  it('shows an empty state when a search matches nothing', () => {
    page().query.set('zzz');
    fixture.detectChanges();
    expect(text()).toContain('No specialties match');
  });

  it('refuses to save an empty form', () => {
    const before = session.specializations().length;
    page().submit();
    fixture.detectChanges();
    expect(session.specializations().length).toBe(before);
    expect(page().nameError()).toBe('Enter a name.');
  });

  it('adds a specialization and announces it', () => {
    page().form.setValue({ name: 'Neurology', description: 'Brain and nerves.' });
    page().submit();
    fixture.detectChanges();
    expect(session.specializations().some((s) => s.name === 'Neurology')).toBe(true);
    expect(latestToast()?.tone).toBe('success');
    expect(latestToast()?.message).toContain('Neurology');
    // Closed before the toast is raised, so it is not behind the dialog's
    // backdrop while it is on screen.
    expect(page().editorOpen()).toBe(false);
  });

  it('prefills the form when editing', () => {
    const existing = session.specializations()[0];
    page().openEdit(existing);
    fixture.detectChanges();
    expect(page().isEditing()).toBe(true);
    expect(page().form.getRawValue().name).toBe(existing.name);
  });

  it('renames rather than adding when editing', () => {
    const existing = session.specializations()[0];
    const before = session.specializations().length;
    page().openEdit(existing);
    page().form.setValue({ name: 'Renamed', description: 'Changed.' });
    page().submit();
    fixture.detectChanges();
    expect(session.specializations().length).toBe(before);
    expect(session.specializations().find((s) => s.id === existing.id)!.name).toBe('Renamed');
  });

  it('starts the editor blank when adding', () => {
    page().openCreate();
    expect(page().isEditing()).toBe(false);
    expect(page().form.getRawValue().name).toBe('');
  });

  it('explains why specialties cannot be removed', () => {
    expect(text()).toContain('cannot be removed');
  });
});
