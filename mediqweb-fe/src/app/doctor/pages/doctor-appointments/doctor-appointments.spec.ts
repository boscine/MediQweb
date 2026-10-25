import { computed } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  clearToasts,
  latestToast,
  toasts,
} from '../../../core/services/toast.service.spec-helpers';
import { MOCK_APPOINTMENTS } from '../../doctor.mock-data';
import { DoctorSession } from '../../doctor-session';
import { DoctorAppointments } from './doctor-appointments';

describe('DoctorAppointments', () => {
  let fixture: ComponentFixture<DoctorAppointments>;
  let session: DoctorSession;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [DoctorAppointments],
      // The table links into the patient routes, so a router has to exist even
      // though the test never navigates.
      providers: [DoctorSession, provideRouter([])],
    });
    session = TestBed.inject(DoctorSession);
    session.now.set(new Date(MOCK_APPOINTMENTS[0].startsAt));
    fixture = TestBed.createComponent(DoctorAppointments);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  // Disarms the dismissal timers the toasts arm.
  afterEach(() => clearToasts());

  function page(): any {
    return fixture.componentInstance;
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function button(label: string): HTMLButtonElement | undefined {
    return [...host().querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent?.trim() === label,
    );
  }

  function clickButton(label: string): void {
    const found = button(label);
    expect(found).toBeTruthy();
    found!.click();
    fixture.detectChanges();
  }

  /** Every button in the Actions cell of every rendered row. */
  function rowActions(): string[] {
    return [...host().querySelectorAll('tbody tr')].flatMap((row) =>
      [...row.querySelectorAll('.actions button')].map((b) => b.textContent?.trim() ?? ''),
    );
  }

  function statusOf(id: string): string | undefined {
    return session.appointments().find((a) => a.id === id)?.status;
  }

  it('lists only the appointments still to happen', () => {
    expect(page().appointments().length).toBe(session.openAppointments().length);
    expect(page().appointments().length).toBeLessThan(session.appointments().length);
  });

  // --- What this list is not

  it('leaves a recorded visit off the list, because the History page holds it', () => {
    const recorded = session
      .appointments()
      .filter((a) => a.status === 'completed' || a.status === 'no-show');
    expect(recorded.length).toBeGreaterThan(0);

    const shown = page()
      .appointments()
      .map((a: any) => a.id);
    for (const appointment of recorded) {
      expect(shown).not.toContain(appointment.id);
    }
  });

  it('never shows a cancelled appointment, which is the Secretary’s record', () => {
    const cancelled = session.appointments().filter((a) => a.status === 'cancelled');
    expect(cancelled.length).toBeGreaterThan(0);

    for (const appointment of page().appointments()) {
      expect(appointment.status).not.toBe('cancelled');
    }
    expect(text()).not.toContain('Cancelled');
  });

  // The filter used to offer Completed, Cancelled and No-show. Each of them
  // promised rows that are never rendered, so choosing one returned a permanently
  // empty table — which reads as a broken page rather than as an empty result.
  it('offers no status in the filter that cannot appear in the list', () => {
    const offered = (page().statusOptions as { id: string }[]).map((item) => item.id);
    expect(offered).toEqual(['all', 'booked', 'confirmed']);
  });

  it('points a doctor looking for a past visit at the History page', () => {
    // The list no longer holds finished appointments, so a doctor who opens it
    // after a consultation has nowhere to look unless the page says where it went.
    expect(text()).toContain('Visit History');
    expect(host().querySelector('a[href="/doctor/history"]')).not.toBeNull();
  });

  it('filters by patient name', () => {
    page().query.set('juan');
    fixture.detectChanges();
    expect(page().appointments().length).toBeGreaterThan(0);
    for (const appointment of page().appointments()) {
      expect(session.patientName(appointment.patientId).toLowerCase()).toContain('juan');
    }
  });

  it('filters by reason', () => {
    page().query.set('knee');
    fixture.detectChanges();
    expect(page().appointments().length).toBeGreaterThan(0);
  });

  it('filters by status', () => {
    page().statusFilter.set('confirmed');
    fixture.detectChanges();
    expect(page().appointments().length).toBeGreaterThan(0);
    for (const appointment of page().appointments()) {
      expect(appointment.status).toBe('confirmed');
    }
  });

  it('counts the working list without comparing it to itself', () => {
    // Was "9 of 16", comparing the open count against every appointment the
    // doctor had ever had — including the finished rows this page no longer
    // lists. Once the list holds only what is still to happen, "9 of 9" would
    // say nothing, so the second count appears only when a filter is in play.
    const total = session.openAppointments().length;
    expect(page().caption()).toBe(`${total} appointments still to happen`);
  });

  it('compares against the working list only once a filter is in play', () => {
    const total = session.openAppointments().length;
    const booked = session.openAppointments().filter((a) => a.status === 'booked').length;

    page().statusFilter.set('booked');
    fixture.detectChanges();
    expect(page().caption()).toBe(`${booked} of ${total} appointments still to happen`);

    page().query.set('juan');
    fixture.detectChanges();
    expect(page().caption()).toContain(`of ${total} appointments still to happen`);

    page().statusFilter.set('all');
    fixture.detectChanges();
    expect(page().caption()).toContain(`of ${total} appointments still to happen`);

    // Both filters have to be cleared: the search box is a filter too, and
    // clearing only the dropdown would leave the caption counting a subset.
    page().query.set('');
    fixture.detectChanges();
    expect(page().caption()).toBe(`${total} appointments still to happen`);
  });

  it('reads "appointment" in the singular when one is left', () => {
    // The store's list cannot be trimmed without breaking every other test in this
    // file, and swapping the function on the shared session would not be picked
    // up anyway: `caption` is a memoised computed that read it in `beforeEach`
    // and has no signal to tell it the function changed. So this builds its own
    // component against a one-appointment list.
    const solo = TestBed.inject(DoctorSession);
    (solo as { openAppointments: unknown }).openAppointments = computed(() =>
      solo
        .appointments()
        .filter((a) => a.status === 'confirmed')
        .slice(0, 1),
    );

    const soloFixture = TestBed.createComponent(DoctorAppointments);
    soloFixture.detectChanges();
    expect((soloFixture.componentInstance as any).caption()).toBe('1 appointment still to happen');
  });

  it('explains an empty result rather than showing a bare table', () => {
    const total = session.openAppointments().length;
    page().query.set('nobody by this name');
    fixture.detectChanges();
    expect(text()).toContain('No appointments match your filters');

    // Zero pluralises: "0 appointment" reads as a count that failed to load, and
    // the empty message above it is the one saying the filter is the reason.
    expect(page().caption()).toBe(`0 of ${total} appointments still to happen`);
  });

  it('completes a confirmed appointment', () => {
    const confirmed = session.appointments().find((a) => a.status === 'confirmed')!;
    page().complete(confirmed);
    fixture.detectChanges();
    expect(statusOf(confirmed.id)).toBe('completed');
    expect(latestToast()?.title).toBe('Visit recorded');
  });

  it('records a no-show', () => {
    const confirmed = session.appointments().find((a) => a.status === 'confirmed')!;
    page().markNoShow(confirmed);
    fixture.detectChanges();
    expect(statusOf(confirmed.id)).toBe('no-show');
    // A warning rather than a success: the write worked, but it is bad news about
    // the appointment and would otherwise read as a neutral "done".
    expect(latestToast()?.tone).toBe('warning');
  });

  it('records an outcome immediately, with no confirmation dialog', () => {
    const confirmed = session.appointments().find((a) => a.status === 'confirmed')!;
    page().complete(confirmed);
    fixture.detectChanges();

    // Recording an outcome is immediate, with no confirmation dialog: it is a
    // record of something the doctor just saw, not a decision to be asked about.
    expect(statusOf(confirmed.id)).toBe('completed');
    expect(host().querySelector('dialog')).toBeNull();
  });

  it('dismisses the confirmation', () => {
    const confirmed = session.appointments().find((a) => a.status === 'confirmed')!;
    page().complete(confirmed);
    fixture.detectChanges();
    expect(latestToast()).not.toBeNull();

    toasts().dismiss(latestToast()!.id);
    fixture.detectChanges();
    expect(latestToast()).toBeNull();
  });

  // --- What this desk is not allowed to do

  it('offers no Confirm, because only a Secretary approves an appointment', () => {
    const booked = session.appointments().find((a) => a.status === 'booked')!;
    expect(page().canRecord(booked)).toBe(false);
    expect(button('Confirm')).toBeUndefined();
    expect(text()).not.toContain('Confirm');
  });

  it('offers no Cancel, because calling a booking off is the front desk decision', () => {
    // The handler and its dialog are gone with it, not merely unreachable.
    expect(page().requestCancel).toBeUndefined();
    expect(page().confirmCancel).toBeUndefined();
    expect(page().canCancel).toBeUndefined();
    expect(host().querySelector('dialog')).toBeNull();
    expect(button('Cancel appointment')).toBeUndefined();
  });

  it('shows only Complete and No-show, and only on a confirmed appointment', () => {
    const labels = rowActions();
    expect(new Set(labels)).toEqual(new Set(['Complete', 'No-show']));

    // One pair per confirmed appointment, and no other row carries an action.
    const confirmed = page()
      .appointments()
      .filter((a: any) => a.status === 'confirmed').length;
    expect(labels.length).toBe(confirmed * 2);
  });

  it('refuses to record an outcome on a booking the front desk never confirmed', () => {
    // Defence in depth behind the hidden buttons: the rule lives in the store, so
    // reaching past the template still gets a refusal rather than a write.
    const booked = session.appointments().find((a) => a.status === 'booked')!;
    expect(session.recordOutcome(booked.id, 'completed')).toBe(false);
    expect(statusOf(booked.id)).toBe('booked');
  });

  it('says which decisions belong to the Secretary', () => {
    // The absence of Confirm and Cancel reads as a gap unless the page says
    // otherwise. This is the sentence that stops that.
    expect(text()).toContain(
      'A Secretary at the front desk confirms an appointment and calls it off',
    );
  });
});
