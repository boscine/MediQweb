import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  clearToasts,
  latestToast,
  toasts,
} from '../../../core/services/toast.service.spec-helpers';
import { MOCK_SECRETARY_PROFILE } from '../../secretary.mock-data';
import { SecretarySession } from '../../secretary-session';
import { pinToDeskDay } from '../../secretary.spec-helpers';
import type { Appointment } from '../../secretary.models';
import { SecretaryAppointments } from './secretary-appointments';

describe('SecretaryAppointments', () => {
  /** The doctor every row on this page belongs to. */
  const DESK = MOCK_SECRETARY_PROFILE.assignedDoctorId!;

  let fixture: ComponentFixture<SecretaryAppointments>;
  let session: SecretarySession;

  // Disarms the dismissal timers the toasts arm.
  afterEach(() => clearToasts());

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [SecretaryAppointments],
      // The table links into the patient routes, so a router has to exist even
      // though the test never navigates.
      providers: [SecretarySession, provideRouter([])],
    });
    session = TestBed.inject(SecretarySession);
    pinToDeskDay(session);
    fixture = TestBed.createComponent(SecretaryAppointments);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  function page(): any {
    return fixture.componentInstance;
  }

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function text(): string {
    return host().textContent ?? '';
  }

  function button(label: string): HTMLButtonElement | undefined {
    return [...host().querySelectorAll('button')].find((b) => b.textContent?.trim() === label) as
      HTMLButtonElement | undefined;
  }

  /** Every button in the Actions cell of every rendered row. */
  function rowActions(): string[] {
    return [...host().querySelectorAll('tbody tr')].flatMap((row) =>
      [...row.querySelectorAll('.actions button')].map((b) => b.textContent?.trim() ?? ''),
    );
  }

  /**
   * The Actions cell of one appointment's row.
   *
   * By index rather than by searching the DOM for the id: `ui-table` renders
   * `[rows]` in order, so the row at the appointment's position in the page's own
   * list is that appointment's row — and asserting on the whole table instead
   * would miss that *one* row lost its button while the others kept it.
   */
  function actionsFor(id: string): string[] {
    const index = page()
      .appointments()
      .findIndex((a: Appointment) => a.id === id);
    expect(index, `no row for ${id}`).toBeGreaterThanOrEqual(0);
    const row = [...host().querySelectorAll('tbody tr')][index];
    return [...row.querySelectorAll('.actions button')].map((b) => b.textContent?.trim() ?? '');
  }

  /**
   * The heading of whichever dialog is currently open, or `''`.
   *
   * A `<dialog>` is hidden with the `open` attribute, not removed, so this has to
   * look at the attribute. Checking page text instead would find "Cancel" in a
   * table button and never notice the dialog had closed.
   */
  function openDialogTitle(): string {
    const dialog = [...host().querySelectorAll('dialog')].find((d) => d.hasAttribute('open'));
    return dialog?.querySelector('.ui-modal__title')?.textContent ?? '';
  }

  function statusOf(id: string): string | undefined {
    return session.appointments().find((a) => a.id === id)?.status;
  }

  /** A booked appointment on this desk. */
  function booked(): Appointment {
    return session.appointments().find((a) => a.status === 'booked')!;
  }

  // --- The list

  it('lists the assigned doctor appointments, and no others', () => {
    expect(page().appointments().length).toBe(session.appointments().length);
    expect(page().appointments().length).toBeGreaterThan(0);
    for (const appointment of page().appointments()) {
      expect(appointment.doctorId).toBe(DESK);
    }
  });

  it('filters by patient name', () => {
    page().query.set('maria');
    fixture.detectChanges();
    expect(page().appointments().length).toBeGreaterThan(0);
    for (const appointment of page().appointments()) {
      expect(session.patientName(appointment.patientId).toLowerCase()).toContain('maria');
    }
  });

  it('filters by reason', () => {
    page().query.set('eczema');
    fixture.detectChanges();
    expect(page().appointments().length).toBeGreaterThan(0);
  });

  it('filters by status', () => {
    page().statusFilter.set('cancelled');
    fixture.detectChanges();
    for (const appointment of page().appointments()) {
      expect(appointment.status).toBe('cancelled');
    }
  });

  it('offers no doctor filter, because there is only one doctor to filter by', () => {
    // A dropdown whose every option is the same doctor is a control that can only
    // confuse: it looks like the list can be widened again.
    expect(text()).not.toContain('Filter by doctor');
  });

  it('combines the search box with the filters', () => {
    page().query.set('maria');
    page().statusFilter.set('confirmed');
    fixture.detectChanges();
    expect(page().appointments().length).toBeGreaterThan(0);
    for (const appointment of page().appointments()) {
      expect(session.patientName(appointment.patientId).toLowerCase()).toContain('maria');
      expect(appointment.status).toBe('confirmed');
    }
  });

  it('explains an empty result rather than showing a bare table', () => {
    page().query.set('nobody by this name');
    fixture.detectChanges();
    expect(text()).toContain('No appointments match your filters');
  });

  it('names the patient on every row and the doctor on no row', () => {
    // The doctor is the same on every row, so the column that repeated one name is
    // gone — and with the booking card gone there is no longer anywhere on this page
    // that names them either.
    expect(host().querySelector('th')?.textContent).not.toContain('Doctor');
    for (const appointment of page().appointments()) {
      expect(page().patientName(appointment)).toBeTruthy();
    }
    expect(text()).not.toContain(session.doctors()[0].doctor.name);
  });

  // --- The desk's queue

  it('opens by saying how much is waiting to be confirmed', () => {
    // With the booking form gone this line is the only thing on the page that says
    // what the desk is for, and it has to agree with the store the dashboard's own
    // tile reads from.
    expect(page().awaitingConfirmationCount()).toBe(session.awaitingConfirmation().length);
    expect(page().awaitingConfirmationCount()).toBeGreaterThan(0);
    expect(text()).toContain(`${page().awaitingConfirmationCount()}`);
    expect(text()).toContain('waiting to be confirmed');
  });

  it('clears the queue line once there is nothing to confirm', () => {
    // "0 appointments are booked and waiting to be confirmed" is a line
    // announcing no work, which is noise on an idle desk.
    for (const appointment of session.awaitingConfirmation()) {
      session.confirm(appointment.id);
    }
    fixture.detectChanges();

    expect(page().awaitingConfirmationCount()).toBe(0);
    expect(host().querySelector('.row-pending')).toBeNull();
  });

  // --- What this desk cannot do

  it('offers no way to create an appointment', () => {
    // Not merely a hidden button: the form, its fields and its submit are all gone,
    // so there is nothing to fill in and nothing that would create a record.
    expect(host().querySelector('.book')).toBeNull();
    expect(host().querySelector('#book-patient')).toBeNull();
    expect(host().querySelector('#book-date')).toBeNull();
    expect(host().querySelector('#book-duration')).toBeNull();
    expect(button('Book appointment')).toBeUndefined();
    expect(text()).not.toContain('Book an appointment');
    // The store does not expose a way either, so the absence is not the view's
    // doing alone.
    expect((session as unknown as Record<string, unknown>)['book']).toBeUndefined();
  });

  it('offers no way to move an appointment to another time', () => {
    expect(button('Reschedule')).toBeUndefined();
    expect(rowActions()).not.toContain('Reschedule');
    expect(text()).not.toContain('Reschedule appointment');
    expect(text()).not.toContain('Move appointment');
    expect((session as unknown as Record<string, unknown>)['reschedule']).toBeUndefined();
  });

  it('offers no way to close a visit, which is the doctor recording what happened', () => {
    expect(button('Complete')).toBeUndefined();
    expect(text()).not.toContain('Mark no-show');
  });

  it('states the division of labour at the foot of the page', () => {
    // An absence of controls reads as an oversight unless the page says otherwise.
    expect(text()).toContain('not actions at this desk');
    expect(text()).toContain("are the doctor's to");
  });

  // --- Confirming

  it('offers Confirm only on a booked appointment', () => {
    for (const status of ['booked'] as const) {
      expect(page().canConfirm({ status } as Appointment), status).toBe(true);
    }
    for (const status of ['confirmed', 'completed', 'cancelled', 'no-show'] as const) {
      expect(page().canConfirm({ status } as Appointment), status).toBe(false);
    }
  });

  it('renders a Confirm button on each booked row and no others', () => {
    const expected = page()
      .appointments()
      .filter((a: Appointment) => a.status === 'booked').length;
    expect(expected).toBeGreaterThan(0);
    expect(rowActions().filter((label) => label === 'Confirm').length).toBe(expected);
  });

  it('confirms an appointment and says so', () => {
    const target = booked();
    page().confirm(target);
    fixture.detectChanges();

    expect(statusOf(target.id)).toBe('confirmed');
    expect(latestToast()?.tone).toBe('success');
    expect(latestToast()?.title).toBe('Appointment confirmed');
    expect(latestToast()?.message).toContain(session.patientName(target.patientId));
  });

  it('takes the Confirm button away once the appointment is confirmed', () => {
    const target = booked();
    expect(actionsFor(target.id)).toContain('Confirm');

    page().confirm(target);
    fixture.detectChanges();

    expect(actionsFor(target.id)).not.toContain('Confirm');
    // Cancel is still there: a confirmed appointment can still be called off.
    expect(actionsFor(target.id)).toContain('Cancel');
  });

  it('empties the queue line as the last appointment is confirmed', () => {
    while (session.awaitingConfirmation().length) {
      page().confirm(session.awaitingConfirmation()[0]);
      fixture.detectChanges();
    }
    expect(host().querySelector('.row-pending')).toBeNull();
  });

  it('reports a double-confirm as already confirmed, not as something changing', () => {
    // A double-click is the ordinary way the store refuses, because the row the
    // second click was given is already stale. Answering "it may have changed"
    // would send somebody looking for a problem they caused by being impatient.
    const target = booked();
    page().confirm(target);
    fixture.detectChanges();
    toasts().dismissAll();

    page().confirm(target);
    fixture.detectChanges();

    // Info rather than error: nothing went wrong.
    expect(latestToast()?.tone).toBe('info');
    expect(latestToast()?.title).toBe('Already confirmed');
    expect(statusOf(target.id)).toBe('confirmed');
  });

  it('says what the appointment is instead when it changed to something else', () => {
    // The other refusal: a stale row whose appointment has been closed. Naming the
    // status tells the Secretary what actually happened, where "it may have
    // changed" leaves them to guess.
    const target = booked();
    session.cancel(target.id);
    fixture.detectChanges();

    page().confirm(target);
    fixture.detectChanges();

    expect(latestToast()?.tone).toBe('error');
    expect(latestToast()?.title).toBe('Not confirmed');
    expect(latestToast()?.message).toContain('cancelled');
    expect(statusOf(target.id)).toBe('cancelled');
  });

  // --- Cancelling

  it('offers Cancel for as long as the patient is still expected', () => {
    for (const status of ['booked', 'confirmed'] as const) {
      expect(page().canCancel({ status } as Appointment), status).toBe(true);
    }
    for (const status of ['completed', 'cancelled', 'no-show'] as const) {
      expect(page().canCancel({ status } as Appointment), status).toBe(false);
    }
  });

  it('asks before cancelling, and cancelling does not happen on its own', () => {
    const live = session.appointments().find((a) => a.status === 'confirmed')!;
    page().requestCancel(live);
    fixture.detectChanges();

    expect(statusOf(live.id)).toBe('confirmed');
    expect(openDialogTitle()).toContain('Cancel appointment');
  });

  it('cancels only once the dialog is answered', () => {
    const live = session.appointments().find((a) => a.status === 'confirmed')!;
    page().requestCancel(live);
    page().confirmCancel();
    fixture.detectChanges();
    expect(statusOf(live.id)).toBe('cancelled');
  });

  it('leaves the appointment alone when the dialog is dismissed', () => {
    const live = session.appointments().find((a) => a.status === 'confirmed')!;
    page().requestCancel(live);
    page().cancelCancel();
    page().confirmCancel();
    fixture.detectChanges();

    expect(openDialogTitle()).not.toContain('Cancel appointment');
    expect(statusOf(live.id)).toBe('confirmed');
  });

  it('keeps the row after cancelling, rather than deleting the history', () => {
    const live = session.appointments().find((a) => a.status === 'confirmed')!;
    const before = page().appointments().length;
    page().requestCancel(live);
    page().confirmCancel();
    fixture.detectChanges();
    expect(page().appointments().length).toBe(before);
  });

  it('offers no action at all on a completed appointment', () => {
    const done = session.appointments().find((a) => a.status === 'completed')!;
    expect(page().canConfirm(done)).toBe(false);
    expect(page().canCancel(done)).toBe(false);
  });

  it('dismisses the confirmation message', () => {
    const live = session.appointments().find((a) => a.status === 'confirmed')!;
    page().requestCancel(live);
    page().confirmCancel();
    fixture.detectChanges();
    expect(latestToast()?.title).toBe('Appointment cancelled');

    toasts().dismiss(latestToast()!.id);
    fixture.detectChanges();
    expect(latestToast()).toBeNull();
  });

  it('says the data is a sample, so a screenshot is not mistaken for a product', () => {
    expect(text()).toContain('Sample data');
  });
});
