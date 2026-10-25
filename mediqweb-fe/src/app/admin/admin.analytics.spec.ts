import { MOCK_APPOINTMENTS, MOCK_DOCTORS, MOCK_PATIENTS } from './admin.mock-data';
import {
  appointmentTrendSeries,
  clinicHeatmap,
  doctorWorkload,
  registrationSeries,
  reportWindow,
  withinWindow,
} from './admin.analytics';
import type { Appointment, AppointmentStatus, PatientAccount, StaffAccount } from './admin.models';

/** Wednesday 15 July 2026, midday. A fixed "now" so every series is exact. */
const NOW = new Date(2026, 6, 15, 12, 0, 0);
const WINDOW = reportWindow(NOW);

function localAt(daysFromNow: number, hour: number, minute = 0): string {
  const date = new Date(
    NOW.getFullYear(),
    NOW.getMonth(),
    NOW.getDate() + daysFromNow,
    hour,
    minute,
  );
  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
  );
}

let sequence = 0;

function appointment(overrides: Partial<Appointment> = {}): Appointment {
  sequence += 1;
  return {
    id: `appt-${sequence}`,
    patientId: 'pat-001',
    doctorId: 'doc-001',
    startsAt: localAt(0, 9),
    durationMinutes: 30,
    status: 'completed' as AppointmentStatus,
    reason: 'Check-up',
    ...overrides,
  };
}

function patient(id: string, registeredOn: string): PatientAccount {
  return {
    id,
    name: `Patient ${id}`,
    email: `${id}@example.test`,
    phone: '0900 000 0000',
    dateOfBirth: '1990-01-01',
    status: 'active',
    registeredOn,
  };
}

function doctor(id: string, name: string, status: StaffAccount['status'] = 'active'): StaffAccount {
  return {
    id,
    name,
    email: `${id}@mediq.test`,
    username: id,
    status,
    specializationId: null,
    licenseNumber: null,
    assignedDoctorId: null,
    joinedOn: '2025-01-01',
    lastActiveOn: null,
  };
}

describe('reportWindow', () => {
  it('runs from today back thirteen days, inclusive of both ends', () => {
    expect(WINDOW.to).toEqual(new Date(2026, 6, 15));
    expect(WINDOW.from).toEqual(new Date(2026, 6, 2));
  });

  it('ignores the time of day, so a window cannot shift with the hour', () => {
    // 23:59 the previous evening and 00:01 this morning are one calendar day,
    // and both must land inside the same window.
    expect(withinWindow('2026-07-15T00:00:00', WINDOW)).toBe(true);
    expect(withinWindow('2026-07-15T23:59:59', WINDOW)).toBe(true);
  });

  it('excludes a day either side of the window', () => {
    expect(withinWindow('2026-07-01T12:00:00', WINDOW)).toBe(false);
    expect(withinWindow('2026-07-16T00:00:00', WINDOW)).toBe(false);
  });

  it('includes the first and last day of the window', () => {
    expect(withinWindow('2026-07-02T00:00:00', WINDOW)).toBe(true);
    expect(withinWindow('2026-07-02T23:00:00', WINDOW)).toBe(true);
  });
});

describe('registrationSeries', () => {
  it('counts patients into the month they registered', () => {
    const series = registrationSeries(
      [patient('pat-001', '2026-06-03'), patient('pat-002', '2026-06-28')],
      NOW,
    );
    expect(series).toEqual([
      { label: 'Jun 26', value: 2 },
      { label: 'Jul 26', value: 0 },
    ]);
  });

  it('keeps empty months, so a gap is drawn as a gap', () => {
    const series = registrationSeries([patient('pat-001', '2026-05-10')], NOW);
    expect(series.map((point) => point.value)).toEqual([1, 0, 0]);
  });

  it('runs from the earliest registration through the current month', () => {
    const series = registrationSeries([patient('pat-001', '2024-11-05')], NOW);
    expect(series[0].label).toBe('Nov 24');
    expect(series.at(-1)?.label).toBe('Jul 26');
    // Nov 24 to Jul 26 inclusive is 21 months.
    expect(series).toHaveLength(21);
  });

  it('counts a patient in their own registration month, not a later one', () => {
    const series = registrationSeries([patient('pat-001', '2026-02-14')], NOW);
    expect(series.find((point) => point.label === 'Feb 26')?.value).toBe(1);
  });

  it('counts disabled patients too — registration is what is being charted', () => {
    const series = registrationSeries(
      [{ ...patient('pat-001', '2026-06-03'), status: 'inactive' }],
      NOW,
    );
    expect(series[0].value).toBe(1);
  });

  it('returns nothing for no patients at all', () => {
    expect(registrationSeries([], NOW)).toEqual([]);
  });

  it('ignores a registration whose date cannot be read, and keeps the rest', () => {
    const series = registrationSeries(
      [patient('pat-001', '2026-06-03'), patient('pat-002', 'not-a-date')],
      NOW,
    );
    expect(series).toEqual([
      { label: 'Jun 26', value: 1 },
      { label: 'Jul 26', value: 0 },
    ]);
  });

  it('returns nothing when no registration has a readable date', () => {
    expect(registrationSeries([patient('pat-001', 'soon')], NOW)).toEqual([]);
  });
});

describe('appointmentTrendSeries', () => {
  it('has one point per day of the window, oldest first', () => {
    const points = appointmentTrendSeries([], NOW);
    expect(points).toHaveLength(14);
    expect(points[0].label).toBe('2 Jul');
    expect(points.at(-1)?.label).toBe('15 Jul');
  });

  it('leaves a day with no appointments at zero rather than skipping it', () => {
    const points = appointmentTrendSeries([appointment({ startsAt: localAt(0, 9) })], NOW);
    expect(points.at(-1)?.value).toBe(1);
    expect(points.filter((point) => point.value === 0)).toHaveLength(13);
  });

  it('adds up two appointments on the same day', () => {
    const points = appointmentTrendSeries(
      [appointment({ startsAt: localAt(0, 9) }), appointment({ startsAt: localAt(0, 14) })],
      NOW,
    );
    expect(points.at(-1)?.value).toBe(2);
  });

  it('keeps an appointment outside the window out of the total', () => {
    const points = appointmentTrendSeries(
      [appointment({ startsAt: localAt(-20, 9) }), appointment({ startsAt: localAt(20, 9) })],
      NOW,
    );
    expect(points.reduce((sum, point) => sum + point.value, 0)).toBe(0);
  });

  it('counts booked and confirmed as well as completed', () => {
    const statuses: AppointmentStatus[] = ['booked', 'confirmed', 'completed'];
    const points = appointmentTrendSeries(
      statuses.map((status) => appointment({ startsAt: localAt(0, 9), status })),
      NOW,
    );
    expect(points.at(-1)?.value).toBe(3);
  });

  it('excludes cancelled and no-show, which are outcomes rather than stages', () => {
    const statuses: AppointmentStatus[] = ['cancelled', 'no-show'];
    const points = appointmentTrendSeries(
      statuses.map((status) => appointment({ startsAt: localAt(0, 9), status })),
      NOW,
    );
    expect(points.at(-1)?.value).toBe(0);
  });

  it('keeps an appointment at the very start of the window', () => {
    const points = appointmentTrendSeries([appointment({ startsAt: '2026-07-02T00:00:00' })], NOW);
    expect(points[0].value).toBe(1);
  });
});

describe('clinicHeatmap', () => {
  it('has one row per weekday, Monday first', () => {
    expect(clinicHeatmap([appointment()], NOW).days).toEqual([
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat',
      'Sun',
    ]);
  });

  it('runs its columns from the earliest booked hour to the latest', () => {
    const matrix = clinicHeatmap(
      [appointment({ startsAt: localAt(0, 8) }), appointment({ startsAt: localAt(0, 17) })],
      NOW,
    );
    expect(matrix.slots[0]).toBe('08:00');
    expect(matrix.slots.at(-1)).toBe('17:00');
  });

  it('keeps the hours with nothing booked between two that have something', () => {
    // 11:00 and 15:00 are booked; the twelve in between are not, and a grid
    // that closed the gap would read as a clinic that never opens at midday.
    const matrix = clinicHeatmap(
      [appointment({ startsAt: localAt(0, 11) }), appointment({ startsAt: localAt(0, 15) })],
      NOW,
    );
    expect(matrix.slots).toHaveLength(5);
    expect(matrix.slots).toEqual(['11:00', '12:00', '13:00', '14:00', '15:00']);
    expect(matrix.cells.filter((cell) => cell.count > 0)).toHaveLength(2);
  });

  it('has one cell per weekday per hour', () => {
    const matrix = clinicHeatmap(
      [appointment({ startsAt: localAt(0, 9) }), appointment({ startsAt: localAt(0, 11) })],
      NOW,
    );
    expect(matrix.cells).toHaveLength(7 * 3);
  });

  it('puts an appointment on the weekday it falls on', () => {
    // 15 July 2026 is a Wednesday, which is index 2.
    const matrix = clinicHeatmap([appointment({ startsAt: localAt(0, 9) })], NOW);
    expect(matrix.cells.filter((cell) => cell.count > 0)).toEqual([
      { dayIndex: 2, slotIndex: 0, count: 1 },
    ]);
  });

  it('buckets an appointment by the hour it starts, not the hour it ends', () => {
    // 10:30 runs for 45 minutes, over the 11:00 hour boundary.
    const matrix = clinicHeatmap([appointment({ startsAt: localAt(0, 10, 30) })], NOW);
    expect(matrix.slots).toEqual(['10:00']);
    expect(matrix.cells.find((cell) => cell.count > 0)?.slotIndex).toBe(0);
  });

  it('totals to the same count the trend chart shows', () => {
    const appointments = [
      appointment({ startsAt: localAt(0, 9) }),
      appointment({ startsAt: localAt(0, 9) }),
      appointment({ startsAt: localAt(-1, 14) }),
    ];
    const matrix = clinicHeatmap(appointments, NOW);
    const trend = appointmentTrendSeries(appointments, NOW);
    expect(matrix.total).toBe(trend.reduce((sum, point) => sum + point.value, 0));
  });

  it('excludes cancelled and no-show', () => {
    const statuses: AppointmentStatus[] = ['cancelled', 'no-show'];
    const matrix = clinicHeatmap(
      statuses.map((status) => appointment({ startsAt: localAt(0, 9), status })),
      NOW,
    );
    expect(matrix.total).toBe(0);
  });

  it('keeps appointments outside the window out of the grid', () => {
    const matrix = clinicHeatmap([appointment({ startsAt: localAt(-30, 9) })], NOW);
    expect(matrix.total).toBe(0);
    expect(matrix.slots).toEqual([]);
  });

  it('returns an empty grid rather than an undefined one when nothing is booked', () => {
    const matrix = clinicHeatmap([], NOW);
    expect(matrix.slots).toEqual([]);
    expect(matrix.cells).toEqual([]);
    expect(matrix.total).toBe(0);
    // The weekday rows stay, so the component has a caption to hang the empty
    // state off and a reader still sees which days the clinic covers.
    expect(matrix.days).toHaveLength(7);
  });
});

describe('doctorWorkload', () => {
  it('counts completed consultations per doctor', () => {
    const bars = doctorWorkload(
      [
        appointment({ doctorId: 'doc-001', startsAt: localAt(0, 9) }),
        appointment({ doctorId: 'doc-001', startsAt: localAt(-1, 9) }),
        appointment({ doctorId: 'doc-002', startsAt: localAt(0, 9) }),
      ],
      [doctor('doc-001', 'Elena Vargas'), doctor('doc-002', 'Rafael Santos')],
      NOW,
    );
    expect(bars).toEqual([
      { doctorId: 'doc-001', label: 'Elena Vargas', value: 2 },
      { doctorId: 'doc-002', label: 'Rafael Santos', value: 1 },
    ]);
  });

  it('does not count a booked or confirmed appointment as work done', () => {
    const statuses: AppointmentStatus[] = ['booked', 'confirmed'];
    const bars = doctorWorkload(
      statuses.map((status) => appointment({ status, startsAt: localAt(0, 9) })),
      [doctor('doc-001', 'Elena Vargas')],
      NOW,
    );
    expect(bars[0].value).toBe(0);
  });

  it('does not count cancelled or no-show either', () => {
    const statuses: AppointmentStatus[] = ['cancelled', 'no-show'];
    const bars = doctorWorkload(
      statuses.map((status) => appointment({ status, startsAt: localAt(0, 9) })),
      [doctor('doc-001', 'Elena Vargas')],
      NOW,
    );
    expect(bars[0].value).toBe(0);
  });

  it('sorts the busiest doctor first', () => {
    const bars = doctorWorkload(
      [
        appointment({ doctorId: 'doc-001', startsAt: localAt(0, 9) }),
        appointment({ doctorId: 'doc-002', startsAt: localAt(0, 9) }),
        appointment({ doctorId: 'doc-002', startsAt: localAt(-1, 9) }),
      ],
      [doctor('doc-001', 'Elena Vargas'), doctor('doc-002', 'Rafael Santos')],
      NOW,
    );
    expect(bars.map((bar) => bar.label)).toEqual(['Rafael Santos', 'Elena Vargas']);
  });

  it('breaks a tie by name, so the order does not shuffle between runs', () => {
    const bars = doctorWorkload(
      [],
      [
        doctor('doc-003', 'Zara Lim'),
        doctor('doc-001', 'Ana Reyes'),
        doctor('doc-002', 'Miko Tan'),
      ],
      NOW,
    );
    expect(bars.map((bar) => bar.label)).toEqual(['Ana Reyes', 'Miko Tan', 'Zara Lim']);
  });

  it('lists every doctor, so a zero is visible rather than a gap', () => {
    const bars = doctorWorkload(
      [appointment({ doctorId: 'doc-001', startsAt: localAt(0, 9) })],
      [doctor('doc-001', 'Elena Vargas'), doctor('doc-002', 'Rafael Santos')],
      NOW,
    );
    expect(bars).toHaveLength(2);
    expect(bars.at(-1)).toEqual({ doctorId: 'doc-002', label: 'Rafael Santos', value: 0 });
  });

  it('lists an inactive doctor, because inactive is not the same as idle', () => {
    const bars = doctorWorkload([], [doctor('doc-004', 'Oscar Dela Cruz', 'inactive')], NOW);
    expect(bars).toEqual([{ doctorId: 'doc-004', label: 'Oscar Dela Cruz', value: 0 }]);
  });

  it('ignores a completed appointment that falls outside the window', () => {
    const bars = doctorWorkload(
      [appointment({ startsAt: localAt(-20, 9) })],
      [doctor('doc-001', 'Elena Vargas')],
      NOW,
    );
    expect(bars[0].value).toBe(0);
  });

  it('returns nothing at all for no doctors', () => {
    expect(doctorWorkload([appointment()], [], NOW)).toEqual([]);
  });
});

describe('the fixtures these charts are drawn from', () => {
  it('books only against doctors that exist', () => {
    // A bar keyed to a doctor id nothing in the staff list owns would silently
    // vanish from the chart rather than showing up as a problem.
    const ids = new Set(MOCK_DOCTORS.map((entry) => entry.id));
    expect(MOCK_APPOINTMENTS.filter((entry) => !ids.has(entry.doctorId))).toEqual([]);
  });

  it('gives every appointment a date the aggregations can read', () => {
    for (const entry of MOCK_APPOINTMENTS) {
      expect(Number.isNaN(new Date(entry.startsAt).getTime())).toBe(false);
    }
  });

  it('gives every patient a registration date the bar chart can read', () => {
    for (const entry of MOCK_PATIENTS) {
      expect(entry.registeredOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('contains the statuses the charts exclude, or excluding them proves nothing', () => {
    const statuses = new Set(MOCK_APPOINTMENTS.map((entry) => entry.status));
    expect(statuses.has('cancelled')).toBe(true);
    expect(statuses.has('no-show')).toBe(true);
  });

  it('contains more than one completed consultation, so the workload chart has a spread', () => {
    const completed = MOCK_APPOINTMENTS.filter((entry) => entry.status === 'completed');
    expect(new Set(completed.map((entry) => entry.doctorId)).size).toBeGreaterThan(1);
  });
});
