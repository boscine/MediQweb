import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BADGE_TONE_TOKEN } from '../../../shared/components';
import { AdminSession } from '../../admin-session';
import { AdminDashboard } from './admin-dashboard';

describe('AdminDashboard', () => {
  let fixture: ComponentFixture<AdminDashboard>;
  let session: AdminSession;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [AdminDashboard],
      providers: [AdminSession, provideRouter([])],
    });
    session = TestBed.inject(AdminSession);
    fixture = TestBed.createComponent(AdminDashboard);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function page(): any {
    return fixture.componentInstance;
  }

  /** Everything the chart counts, across its three slices. */
  function total(slices: readonly { value: number }[]): number {
    return slices.reduce((sum, slice) => sum + slice.value, 0);
  }

  /** How many appointments the fixture holds in the given statuses. */
  function shown(...statuses: string[]): number {
    return session
      .appointments()
      .filter((appointment: any) => statuses.includes(appointment.status)).length;
  }

  it('shows a card for each of the four analytics', () => {
    for (const heading of [
      'New patient registrations',
      'Doctor consultation workload',
      'Daily appointment trends',
      'Busy periods',
    ]) {
      expect(text()).toContain(heading);
    }
  });

  it('keeps the appointments pie chart it already had', () => {
    expect((fixture.nativeElement as HTMLElement).querySelector('ui-pie-chart')).not.toBeNull();
    expect(text()).toContain('Appointments');
  });

  it('counts registrations by month across every month on record', () => {
    const series = page().registrations();
    // The fixture's patients registered in six different months; the chart has
    // a bar per month from the earliest of them through this one, so the total
    // across the bars is every patient on file.
    const total = series.reduce((sum: number, bar: { value: number }) => sum + bar.value, 0);
    expect(total).toBe(session.patients().length);

    // The last bar is this month, so the chart always reaches the reader's own
    // "now" rather than stopping at the most recent registration.
    const today = new Date();
    const expectedLast = `${today.toLocaleString('en', { month: 'short' })} ${String(
      today.getFullYear(),
    ).slice(2)}`;
    expect(series.at(-1).label).toBe(expectedLast);

    // Gaps are drawn as gaps rather than closing up into a tidy climb.
    expect(series.some((bar: { value: number }) => bar.value === 0)).toBe(true);
  });

  it('gives every appointment day in the window a bar, and totals to the charted appointments', () => {
    const points = page().trends();
    expect(points).toHaveLength(14);

    const windowed = session.appointments().filter((appointment: any) => {
      const day = appointment.startsAt.slice(0, 10);
      const today = new Date();
      const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 13);
      const pad = (value: number) => String(value).padStart(2, '0');
      const key = (date: Date) =>
        `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
      return day >= key(from) && day <= key(today);
    });
    const charted = windowed.filter((appointment: any) =>
      ['booked', 'confirmed', 'completed'].includes(appointment.status),
    );

    const total = points.reduce((sum: number, point: { value: number }) => sum + point.value, 0);
    expect(total).toBe(charted.length);
  });

  it('counts the same appointments in the heatmap as the trend', () => {
    expect(page().heatmap().total).toBe(
      page()
        .trends()
        .reduce((sum: number, point: { value: number }) => sum + point.value, 0),
    );
  });

  it('builds the heatmap as a grid of every weekday against the booked hours', () => {
    const matrix = page().heatmap();
    expect(matrix.days).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(matrix.slots.length).toBeGreaterThan(0);
    expect(matrix.cells).toHaveLength(7 * matrix.slots.length);
  });

  it("states each chart's period, so two different scopes are not read as one", () => {
    // The pie counts every appointment; the workload chart counts one reporting
    // window. Their Finished slices can therefore differ, and today they happen
    // to both read 5. A reader seeing only "By status" beside "Completed
    // consultations, last 14 days" would take them as the same scope and
    // conclude one chart was wrong, so each caption has to name its own.
    const captions = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll(
        '.chart__caption, .heatmap__caption, .pie__caption',
      ),
    ].map((el) => el.textContent?.trim() ?? '');

    // The pie's own caption, which is the one that would otherwise be silent.
    expect(captions).toContain('By status, all appointments');
    expect(captions.some((text) => text.includes('last 14 days'))).toBe(true);
  });

  it('lists every doctor by completed consultations, busiest first', () => {
    const bars = page().workload();
    expect(bars).toHaveLength(session.doctors().length);
    expect(bars[0].label).toBe('Elena Vargas');

    const counts = bars.map((bar: { value: number }) => bar.value);
    expect([...counts].sort((a: number, b: number) => b - a)).toEqual(counts);

    const completed = session
      .appointments()
      .filter((appointment: any) => appointment.status === 'completed');
    expect(bars.reduce((sum: number, bar: { value: number }) => sum + bar.value, 0)).toBe(
      completed.length,
    );
  });

  it('shows a card for each area of the Admin', () => {
    for (const label of ['Doctors', 'Secretaries', 'Patients', 'Specializations']) {
      expect(text()).toContain(label);
    }
  });

  it('reports active counts, not totals', () => {
    expect(page().doctors()).toBe(session.activeDoctorCount());
    expect(page().patients()).toBe(session.activePatientCount());
    expect(page().secretaries()).toBe(session.activeSecretaryCount());
  });

  it('counts every specialization, active or not', () => {
    // A specialty has no status, so a total is the only honest figure.
    expect(page().specializations()).toBe(session.specializations().length);
  });

  it('lists recent activity, capped', () => {
    const rows = page().activity();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(6);
  });

  it('reflects an account disabled elsewhere in the area', () => {
    const before = page().patients();
    const active = session.patients().find((p) => p.status === 'active')!;
    session.setPatientStatus(active.id, 'inactive');
    fixture.detectChanges();
    expect(page().patients()).toBe(before - 1);
  });

  it('surfaces a new action in the activity list', () => {
    session.addSpecialization('Neurology', 'Brain and nerves.');
    fixture.detectChanges();
    expect(text()).toContain('Added specialization');
  });

  it('labels each severity in words', () => {
    expect(page().severityTone('danger')).toBe('danger');
    expect(page().severityTone('warning')).toBe('warning');
    expect(page().severityTone('info')).toBe('info');
  });

  it('breaks the clinic appointments into pending, ongoing and finished', () => {
    const slices = page().lifecycleSlices();
    expect(slices.map((slice: any) => slice.label)).toEqual(['Pending', 'Ongoing', 'Finished']);
    expect(total(slices)).toBe(shown('booked', 'confirmed', 'completed'));
  });

  it('leaves cancelled and no-show out of the chart without losing them', () => {
    const appointments = session.appointments();
    const dropped = appointments.filter(
      (appointment: any) => appointment.status === 'cancelled' || appointment.status === 'no-show',
    );
    // The fixture has to contain some, or dropping them proves nothing.
    expect(dropped.length).toBeGreaterThan(0);
    expect(total(page().lifecycleSlices()) + dropped.length).toBe(appointments.length);
  });

  it('draws the stages red, blue and green, in the order the work happens', () => {
    expect(
      page()
        .lifecycleSlices()
        .map((slice: any) => slice.color),
    ).toEqual([BADGE_TONE_TOKEN.danger, BADGE_TONE_TOKEN.info, BADGE_TONE_TOKEN.success]);
  });

  it('shows the chart in its own Appointments card beside the activity list', () => {
    const host = fixture.nativeElement as HTMLElement;
    const dash = host.querySelector('.dash');
    expect(dash?.querySelector('.activity')).toBeTruthy();

    const chart = dash?.querySelector('ui-pie-chart');
    expect(chart).toBeTruthy();
    const card = chart?.closest('.ui-card') as HTMLElement;
    expect(card.querySelector('.ui-card__title')?.textContent?.trim()).toBe('Appointments');

    // Zero-count stages are dropped by the component, not drawn as flat arcs.
    const drawn = page()
      .lifecycleSlices()
      .filter((slice: any) => slice.value > 0);
    expect(chart?.querySelectorAll('.pie__item')).toHaveLength(drawn.length);
  });

  it('states plainly that the data is a sample', () => {
    expect(text()).toContain('Sample data.');
  });
});
