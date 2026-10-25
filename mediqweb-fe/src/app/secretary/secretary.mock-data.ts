import { localIso, minutesOfDay } from './secretary.dates';
import type {
  Appointment,
  Conversation,
  ConversationMessage,
  Doctor,
  Patient,
  ScheduleDay,
  SecretaryProfile,
} from './secretary.models';

/**
 * Sample data standing in for the Secretary API.
 *
 * Obvious placeholder values in one file, so the whole set is trivial to delete
 * when the real endpoints land. Names are plainly fictional and no record
 * carries a real identifier.
 *
 * This is a *separate* cohort from `admin.mock-data.ts` and `doctor.mock-data.ts`.
 * The three areas are independent stores: the Admin area manages staff accounts,
 * the Doctor area sees only their own diary, and the Secretary area works one
 * doctor's desk — the doctor an administrator assigned them to, in
 * `MOCK_SECRETARY_PROFILE`. Sharing one set of fixtures would have meant the
 * Secretary being shown a patient list scoped to somebody else's diary, which is
 * exactly the bug the Doctor area's `patientForDoctor` exists to prevent. When
 * each area's session is replaced by a service talking to the API, the question
 * disappears.
 */

/** The signed-in Secretary. Fixed until authentication exists. */
export const SIGNED_IN_SECRETARY_ID = 'sec-001';

export const MOCK_SECRETARY_PROFILE: SecretaryProfile = {
  id: SIGNED_IN_SECRETARY_ID,
  name: 'Celine Villanueva',
  email: 'celine.villanueva@mediq.ph',
  phone: '+63 917 555 0201',
  joinedOn: '2025-09-01',
  // The assignment an administrator makes on the Add Secretary form, read here as
  // a field of the signed-in user because that is where it arrives once
  // authentication exists. doc-003 on purpose: a closed Monday, an
  // appointment-free patient and a clinic with two cancelled appointments
  // elsewhere, so the scoping rules all have something to bite on at this desk.
  assignedDoctorId: 'doc-003',
};

export const MOCK_DOCTORS: readonly Doctor[] = [
  {
    id: 'doc-001',
    name: 'Rafael Santos',
    email: 'rafael.santos@mediq.ph',
    phone: '+63 917 555 0281',
    specialization: 'Orthopedics',
    licenseNumber: 'PRC-120913',
    joinedOn: '2026-01-19',
    status: 'active',
  },
  {
    id: 'doc-002',
    name: 'Ana Lim',
    email: 'ana.lim@mediq.ph',
    phone: '+63 917 555 0282',
    specialization: 'Cardiology',
    licenseNumber: 'PRC-118402',
    joinedOn: '2025-11-04',
    status: 'active',
  },
  {
    id: 'doc-003',
    name: 'Paolo Navarro',
    email: 'paolo.navarro@mediq.ph',
    phone: '+63 917 555 0283',
    specialization: 'Dermatology',
    licenseNumber: 'PRC-131776',
    joinedOn: '2026-03-02',
    status: 'active',
  },
  {
    id: 'doc-004',
    name: 'Grace Oribello',
    email: 'grace.oribello@mediq.ph',
    phone: '+63 917 555 0284',
    specialization: 'Pediatrics',
    licenseNumber: 'PRC-104551',
    joinedOn: '2025-06-16',
    status: 'active',
  },
  {
    id: 'doc-005',
    name: 'Rico Malvar',
    email: 'rico.malvar@mediq.ph',
    phone: '+63 917 555 0285',
    specialization: 'Neurology',
    licenseNumber: 'PRC-142088',
    // Inactive on purpose: the Doctor List must show a doctor who is not taking
    // bookings, or the "unavailable" badge would never appear anywhere.
    joinedOn: '2025-04-28',
    status: 'inactive',
  },
];

export const MOCK_PATIENTS: readonly Patient[] = [
  {
    id: 'pat-201',
    name: 'Juan Dela Cruz',
    email: 'juan.delacruz@example.ph',
    phone: '+63 917 555 0301',
    dateOfBirth: '1986-03-14',
    address: '24 Katipunan Ave, Quezon City',
    registeredOn: '2025-11-12',
    status: 'active',
    doctorId: 'doc-001',
  },
  {
    id: 'pat-202',
    name: 'Maria Santos',
    email: 'maria.santos@example.ph',
    phone: '+63 918 555 0322',
    dateOfBirth: '1994-11-02',
    address: '8 Aurelio St, Mandaluyong',
    registeredOn: '2026-01-08',
    status: 'active',
    doctorId: 'doc-003',
  },
  {
    id: 'pat-203',
    name: 'Pedro Reyes',
    email: 'pedro.reyes@example.ph',
    phone: '+63 919 555 0343',
    dateOfBirth: '1978-06-25',
    address: '115 Shaw Blvd, Mandaluyong',
    registeredOn: '2026-02-14',
    status: 'active',
    doctorId: 'doc-003',
  },
  {
    id: 'pat-204',
    name: 'Ana Bautista',
    email: 'ana.bautista@example.ph',
    phone: '+63 917 555 0364',
    dateOfBirth: '2011-09-08',
    address: '3 Pelaez St, Manila',
    registeredOn: '2026-03-21',
    status: 'active',
    doctorId: 'doc-004',
  },
  {
    id: 'pat-205',
    name: 'Miguel Torres',
    email: 'miguel.torres@example.ph',
    phone: '+63 918 555 0385',
    dateOfBirth: '1999-01-30',
    address: '77 San Juan St, Makati',
    registeredOn: '2026-04-02',
    status: 'active',
    doctorId: 'doc-003',
  },
  {
    id: 'pat-206',
    name: 'Lucia Mendoza',
    email: 'lucia.mendoza@example.ph',
    phone: '+63 917 555 0386',
    dateOfBirth: '2001-07-19',
    address: '12 Ilang Ilang, Parañaque',
    registeredOn: '2026-04-11',
    status: 'active',
    doctorId: 'doc-001',
  },
  {
    id: 'pat-207',
    name: 'Rafael Aquino',
    email: 'rafael.aquino@example.ph',
    phone: '+63 918 555 0387',
    dateOfBirth: '1965-12-05',
    address: '5 Legazpi Village, Makati',
    registeredOn: '2025-08-30',
    status: 'active',
    doctorId: 'doc-002',
  },
  {
    id: 'pat-208',
    name: 'Carla De Guzman',
    email: 'carla.deguzman@example.ph',
    phone: '+63 917 555 0388',
    dateOfBirth: '1989-05-11',
    address: '31 Aurora St, Quezon City',
    registeredOn: '2026-01-27',
    status: 'active',
    doctorId: 'doc-003',
  },
  {
    id: 'pat-209',
    name: 'Andres Salazar',
    email: 'andres.salazar@example.ph',
    phone: '+63 919 555 0389',
    dateOfBirth: '1972-02-28',
    address: '9 Magsaysay Ave, Pasig',
    registeredOn: '2025-10-19',
    status: 'active',
    doctorId: 'doc-001',
  },
  {
    id: 'pat-210',
    name: 'Cristina Abel',
    email: 'cristina.abel@example.ph',
    phone: '+63 917 555 0390',
    dateOfBirth: '1993-09-17',
    address: '44 Katipunan St, Mandaluyong',
    registeredOn: '2026-02-05',
    status: 'active',
    doctorId: 'doc-001',
  },
  {
    id: 'pat-211',
    name: 'Elena Villanueva',
    email: 'elena.villanueva@example.ph',
    phone: '+63 918 555 0391',
    dateOfBirth: '2015-04-03',
    address: '6 Kalachuchi, Manila',
    registeredOn: '2026-05-30',
    status: 'active',
    doctorId: 'doc-004',
  },
  {
    id: 'pat-212',
    name: 'Nestor Yulo',
    email: 'nestor.yulo@example.ph',
    phone: '+63 919 555 0392',
    dateOfBirth: '1981-08-22',
    address: '18 Katipanan, Antipolo',
    registeredOn: '2025-12-08',
    status: 'inactive',
    // On the disabled doctor's panel, while their appointment is with doc-002.
    // Deliberate: a doctor can be taken off the roster with patients still
    // registered to them, and this is what that state looks like — nobody's list
    // at all, and a patient whose one appointment is on somebody else's desk.
    doctorId: 'doc-005',
  },
  {
    id: 'pat-213',
    name: 'Danilo Puno',
    email: 'danilo.puno@example.ph',
    phone: '+63 917 555 0393',
    dateOfBirth: '1958-10-30',
    address: '2 Rizal Ave, Marikina',
    registeredOn: '2025-07-14',
    status: 'active',
    doctorId: 'doc-002',
  },
  {
    id: 'pat-214',
    name: 'Teresa Almonte',
    email: 'teresa.almonte@example.ph',
    phone: '+63 918 555 0394',
    dateOfBirth: '1996-03-09',
    address: '21 Boni Ave, Mandaluyong',
    registeredOn: '2026-06-08',
    status: 'active',
    doctorId: 'doc-003',
  },
  {
    id: 'pat-215',
    // Registered at the desk and not yet booked. A patient with no appointments
    // has to be in the fixtures, because they are the case the list exists for:
    // a Secretary cannot book somebody they cannot find.
    name: 'Josefina Alcaraz',
    email: 'josefina.alcaraz@example.ph',
    phone: '+63 917 555 0395',
    dateOfBirth: '1951-11-27',
    address: '47 Rizal St, Antipolo',
    registeredOn: '2026-08-19',
    status: 'active',
    doctorId: 'doc-003',
  },
];

/**
 * Each doctor's published weekly availability.
 *
 * Declared before the appointments because the appointment timestamps are
 * derived from these windows — see `atOpen`.
 *
 * A `Record` keyed by doctor id so the schedules page can look one up directly
 * without a `find`, and so a missing key is a compile error rather than an
 * empty schedule rendered as if the doctor worked no hours at all.
 */
export const MOCK_SCHEDULES: Readonly<Record<string, readonly ScheduleDay[]>> = {
  // Weekday mornings and one Friday afternoon.
  'doc-001': [
    { dayOfWeek: 0, enabled: false, startTime: '09:00', endTime: '12:00' },
    { dayOfWeek: 1, enabled: true, startTime: '09:00', endTime: '12:00' },
    { dayOfWeek: 2, enabled: true, startTime: '09:00', endTime: '12:00' },
    { dayOfWeek: 3, enabled: true, startTime: '09:00', endTime: '12:00' },
    { dayOfWeek: 4, enabled: true, startTime: '09:00', endTime: '12:00' },
    { dayOfWeek: 5, enabled: true, startTime: '14:00', endTime: '17:00' },
    { dayOfWeek: 6, enabled: false, startTime: '09:00', endTime: '12:00' },
  ],
  // Weekday afternoons.
  'doc-002': [
    { dayOfWeek: 0, enabled: false, startTime: '14:00', endTime: '17:00' },
    { dayOfWeek: 1, enabled: true, startTime: '14:00', endTime: '17:00' },
    { dayOfWeek: 2, enabled: true, startTime: '14:00', endTime: '17:00' },
    { dayOfWeek: 3, enabled: true, startTime: '14:00', endTime: '17:00' },
    { dayOfWeek: 4, enabled: true, startTime: '14:00', endTime: '17:00' },
    { dayOfWeek: 5, enabled: true, startTime: '09:00', endTime: '12:00' },
    { dayOfWeek: 6, enabled: false, startTime: '14:00', endTime: '17:00' },
  ],
  // Every day but Monday. Deliberate: it is the one doctor who can cover a
  // Sunday, so "today's appointments" is never empty whichever weekday this
  // module happens to be first imported on — and the closed Monday is what the
  // "doctor does not work that day" rule is demonstrated against.
  'doc-003': [
    { dayOfWeek: 0, enabled: true, startTime: '09:00', endTime: '12:00' },
    { dayOfWeek: 1, enabled: false, startTime: '09:00', endTime: '12:00' },
    { dayOfWeek: 2, enabled: true, startTime: '09:00', endTime: '12:00' },
    { dayOfWeek: 3, enabled: true, startTime: '09:00', endTime: '12:00' },
    { dayOfWeek: 4, enabled: true, startTime: '09:00', endTime: '12:00' },
    { dayOfWeek: 5, enabled: true, startTime: '09:00', endTime: '12:00' },
    { dayOfWeek: 6, enabled: true, startTime: '09:00', endTime: '12:00' },
  ],
  // A split clinic: mornings for the first half of the week, afternoons after.
  'doc-004': [
    { dayOfWeek: 0, enabled: false, startTime: '09:00', endTime: '12:00' },
    { dayOfWeek: 1, enabled: true, startTime: '09:00', endTime: '12:00' },
    { dayOfWeek: 2, enabled: true, startTime: '09:00', endTime: '12:00' },
    { dayOfWeek: 3, enabled: true, startTime: '14:00', endTime: '17:00' },
    { dayOfWeek: 4, enabled: true, startTime: '14:00', endTime: '17:00' },
    { dayOfWeek: 5, enabled: true, startTime: '14:00', endTime: '17:00' },
    { dayOfWeek: 6, enabled: false, startTime: '09:00', endTime: '12:00' },
  ],
  // Inactive, so no published hours at all. Kept in the fixture so the
  // schedules page has something to say about a doctor who cannot be booked.
  'doc-005': [
    { dayOfWeek: 0, enabled: false, startTime: '09:00', endTime: '17:00' },
    { dayOfWeek: 1, enabled: false, startTime: '09:00', endTime: '17:00' },
    { dayOfWeek: 2, enabled: false, startTime: '09:00', endTime: '17:00' },
    { dayOfWeek: 3, enabled: false, startTime: '09:00', endTime: '17:00' },
    { dayOfWeek: 4, enabled: false, startTime: '09:00', endTime: '17:00' },
    { dayOfWeek: 5, enabled: false, startTime: '09:00', endTime: '17:00' },
    { dayOfWeek: 6, enabled: false, startTime: '09:00', endTime: '17:00' },
  ],
};

/**
 * The doctor's `daysFromToday`-th working day, counting from today.
 *
 * `daysFromToday` counts **working days, not calendar days**, and that is the
 * whole point. Anchoring on "today" and then skipping forward over closed days
 * looked equivalent but was not: when today is a day off, `0` and `1` both
 * resolve to the next working day and two appointments land on top of each
 * other. The collision only appears on the weekdays that doctor does not work,
 * which is why the suite passed for weeks and then failed the day the date
 * rolled over to a Monday.
 *
 * Counting working days makes distinct offsets produce distinct days by
 * construction, whatever weekday the fixtures happen to be generated on:
 *
 * - `0` is today when the doctor works today, otherwise their next working day.
 * - `-1` is their most recent working day, skipping any days off between.
 * - `1`, `3`, `4` step forward over days off.
 *
 * Each search is bounded to a fortnight, so a doctor whose every day is closed
 * runs out of road and returns the date it reached rather than looping forever.
 * That doctor has no appointments to place anyway — the inactive one is only
 * ever used to be shown as not taking bookings.
 */
function openDayOn(doctorId: string, daysFromToday: number): Date {
  const works = (date: Date): boolean => MOCK_SCHEDULES[doctorId][date.getDay()].enabled;

  const nextWorkingDay = (from: Date, direction: 1 | -1): Date => {
    const date = new Date(from);
    for (let skip = 0; skip < 14; skip += 1) {
      date.setDate(date.getDate() + direction);
      if (works(date)) return date;
    }
    return date;
  };

  // Anchor on the first day the doctor works, today included.
  let date = new Date();
  date.setHours(0, 0, 0, 0);
  for (let skip = 0; skip < 14 && !works(date); skip += 1) {
    date.setDate(date.getDate() + 1);
  }

  // Then walk the offset in working days, in whichever direction it points.
  const direction = daysFromToday < 0 ? -1 : 1;
  for (let step = 0; step < Math.abs(daysFromToday); step += 1) {
    date = nextWorkingDay(date, direction);
  }

  return date;
}

/**
 * A timestamp inside a doctor's published hours, `daysFromToday` working days out.
 *
 * Two things this does that writing the date out by hand cannot:
 *
 * - It only ever lands on a day the doctor actually works, counting working days
 *   from today (see `openDayOn`). `daysFromToday: 1` is a different weekday
 *   depending on when this module is imported, so a hand-written date would put
 *   appointments outside published hours on some days and inside them on others
 *   — and the booking rules would then be refusing the clinic's own sample data,
 *   which is the worst possible first impression of the form.
 * - It places the time relative to that day's opening time rather than as a fixed
 *   hour, so a doctor who works afternoons gets afternoon appointments.
 *
 * `minutesAfterOpen` is the offset into the published window. A 180-minute
 * morning supports offsets of roughly 0, 60 and 120.
 */
function atOpen(doctorId: string, daysFromToday: number, minutesAfterOpen = 0): string {
  const date = openDayOn(doctorId, daysFromToday);
  const opensAt = minutesOfDay(MOCK_SCHEDULES[doctorId][date.getDay()].startTime) ?? 0;
  const minutes = opensAt + minutesAfterOpen;
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return localIso(date);
}

/**
 * Appointments across the whole clinic.
 *
 * Spreading these over several doctors is the point: a Secretary books for
 * whoever the patient asks for, so the agenda, the list and the doctor filters
 * all have more than one provider in them. Times come from `atOpen`, so every
 * one sits inside the hours that doctor published — the booking rules can then be
 * demonstrated without the fixtures arguing with them.
 *
 * The closed rows deliberately cover all three of completed, cancelled and
 * no-show on the *assigned* doctor's desk. The Appointment History page shows
 * exactly those, and a desk seeded with only two of the three would make a
 * working filter look broken — the same reason the weekly schedule fixtures are
 * split days rather than single blocks.
 */
export const MOCK_APPOINTMENTS: readonly Appointment[] = [
  // ---- Past, already closed out
  {
    id: 'appt-201',
    patientId: 'pat-201',
    doctorId: 'doc-001',
    startsAt: atOpen('doc-001', -1, 0),
    durationMinutes: 45,
    status: 'completed',
    reason: 'Follow-up: knee rehabilitation',
  },
  {
    id: 'appt-202',
    patientId: 'pat-202',
    doctorId: 'doc-002',
    startsAt: atOpen('doc-002', -1, 0),
    durationMinutes: 30,
    status: 'completed',
    reason: 'Blood pressure review',
  },
  {
    id: 'appt-203',
    patientId: 'pat-207',
    doctorId: 'doc-002',
    startsAt: atOpen('doc-002', -1, 60),
    durationMinutes: 45,
    status: 'no-show',
    reason: 'Cardiology consultation',
  },
  {
    id: 'appt-204',
    patientId: 'pat-203',
    doctorId: 'doc-003',
    startsAt: atOpen('doc-003', -2, 0),
    durationMinutes: 30,
    status: 'completed',
    reason: 'Skin rash assessment',
  },
  {
    id: 'appt-205',
    patientId: 'pat-204',
    doctorId: 'doc-004',
    startsAt: atOpen('doc-004', -2, 0),
    durationMinutes: 30,
    status: 'completed',
    reason: 'Childhood immunization check',
  },
  {
    id: 'appt-226',
    patientId: 'pat-205',
    doctorId: 'doc-003',
    startsAt: atOpen('doc-003', -3, 60),
    durationMinutes: 30,
    status: 'no-show',
    reason: 'Physiotherapy review',
  },
  {
    id: 'appt-206',
    patientId: 'pat-208',
    doctorId: 'doc-003',
    startsAt: atOpen('doc-003', -3, 0),
    durationMinutes: 30,
    status: 'cancelled',
    reason: 'Mole screening',
  },
  {
    id: 'appt-207',
    patientId: 'pat-209',
    doctorId: 'doc-001',
    startsAt: atOpen('doc-001', -4, 0),
    durationMinutes: 45,
    status: 'completed',
    reason: 'Shoulder mobility review',
  },
  {
    id: 'appt-208',
    patientId: 'pat-213',
    doctorId: 'doc-002',
    startsAt: atOpen('doc-002', -5, 0),
    durationMinutes: 45,
    status: 'completed',
    reason: 'Hypertension monitoring',
  },

  // ---- Today
  {
    id: 'appt-209',
    patientId: 'pat-201',
    doctorId: 'doc-001',
    startsAt: atOpen('doc-001', 0, 0),
    durationMinutes: 45,
    status: 'confirmed',
    reason: 'Post-operative review',
  },
  {
    id: 'appt-210',
    patientId: 'pat-202',
    doctorId: 'doc-003',
    startsAt: atOpen('doc-003', 0, 0),
    durationMinutes: 30,
    status: 'confirmed',
    reason: 'Routine check-up',
  },
  {
    id: 'appt-211',
    patientId: 'pat-204',
    doctorId: 'doc-004',
    startsAt: atOpen('doc-004', 0, 0),
    durationMinutes: 30,
    status: 'booked',
    reason: 'Pediatric consultation',
  },
  {
    id: 'appt-212',
    patientId: 'pat-205',
    doctorId: 'doc-003',
    startsAt: atOpen('doc-003', 0, 60),
    durationMinutes: 30,
    status: 'confirmed',
    reason: 'Eczema follow-up',
  },
  {
    id: 'appt-213',
    patientId: 'pat-210',
    doctorId: 'doc-001',
    startsAt: atOpen('doc-001', 0, 60),
    durationMinutes: 45,
    status: 'booked',
    reason: 'Second opinion on imaging',
  },
  {
    id: 'appt-214',
    patientId: 'pat-207',
    doctorId: 'doc-002',
    startsAt: atOpen('doc-002', 0, 0),
    durationMinutes: 45,
    status: 'booked',
    reason: 'Cardiology consultation',
  },
  {
    id: 'appt-215',
    patientId: 'pat-211',
    doctorId: 'doc-004',
    startsAt: atOpen('doc-004', 0, 60),
    durationMinutes: 30,
    status: 'confirmed',
    reason: 'Vaccination schedule',
  },
  {
    id: 'appt-216',
    // Cancelled earlier today, so the day plan has something dropped out of it
    // and the "cancelled" filter is not empty on a first visit.
    patientId: 'pat-208',
    doctorId: 'doc-003',
    startsAt: atOpen('doc-003', 0, 120),
    durationMinutes: 30,
    status: 'cancelled',
    reason: 'Mole screening',
  },

  // ---- Coming up
  {
    id: 'appt-217',
    patientId: 'pat-206',
    doctorId: 'doc-001',
    startsAt: atOpen('doc-001', 1, 0),
    durationMinutes: 45,
    status: 'booked',
    reason: 'Sports injury assessment',
  },
  {
    id: 'appt-218',
    patientId: 'pat-212',
    doctorId: 'doc-002',
    startsAt: atOpen('doc-002', 1, 0),
    durationMinutes: 30,
    status: 'confirmed',
    reason: 'Medication review',
  },
  {
    id: 'appt-219',
    patientId: 'pat-214',
    doctorId: 'doc-003',
    startsAt: atOpen('doc-003', 1, 0),
    durationMinutes: 30,
    status: 'booked',
    reason: 'New patient consultation',
  },
  {
    id: 'appt-220',
    patientId: 'pat-203',
    doctorId: 'doc-004',
    startsAt: atOpen('doc-004', 1, 0),
    durationMinutes: 30,
    status: 'booked',
    reason: 'Pediatric consultation',
  },
  {
    id: 'appt-221',
    patientId: 'pat-209',
    doctorId: 'doc-001',
    startsAt: atOpen('doc-001', 2, 0),
    durationMinutes: 45,
    status: 'confirmed',
    reason: 'Shoulder mobility review',
  },
  {
    id: 'appt-222',
    patientId: 'pat-205',
    doctorId: 'doc-003',
    startsAt: atOpen('doc-003', 3, 0),
    durationMinutes: 30,
    status: 'booked',
    reason: 'Eczema follow-up',
  },
  {
    id: 'appt-223',
    patientId: 'pat-213',
    doctorId: 'doc-002',
    startsAt: atOpen('doc-002', 3, 0),
    durationMinutes: 45,
    status: 'confirmed',
    reason: 'Hypertension monitoring',
  },
  {
    id: 'appt-224',
    patientId: 'pat-208',
    doctorId: 'doc-003',
    startsAt: atOpen('doc-003', 4, 0),
    durationMinutes: 30,
    status: 'booked',
    reason: 'Mole screening',
  },
  {
    id: 'appt-225',
    patientId: 'pat-211',
    doctorId: 'doc-004',
    startsAt: atOpen('doc-004', 5, 0),
    durationMinutes: 30,
    status: 'booked',
    reason: 'Vaccination schedule',
  },
];

// ---------------------------------------------------------------------------
// Messaging
// ---------------------------------------------------------------------------

/**
 * A zone-less local timestamp `minutes` before this module was first imported.
 *
 * Messaging is the one fixture set whose whole point is *when* something
 * happened: a list ordered by recency, an "1 hour ago" label and a day divider
 * are all meaningless against hand-written dates. Anchoring on module load keeps
 * every thread plausible whenever the app happens to be opened — a conversation
 * cannot land in the future, and "yesterday" stays yesterday.
 *
 * Like `openDayOn` above, this reads the wall clock once at import rather than on
 * every render, so the fixtures do not drift while the app is open. `SecretarySession`
 * keeps its own `now` signal for anything that has to move with it.
 */
function minutesAgo(minutes: number): string {
  const date = new Date();
  date.setMinutes(date.getMinutes() - minutes);
  return localIso(date);
}

/**
 * The threads on the Secretary's desk.
 *
 * `partyId` points at the existing patient and doctor fixtures rather than
 * repeating names, so a thread can never disagree with the Patients page about
 * who somebody is — and the avatar initials come from the same source.
 *
 * Four of the five are `awaitingAction`, and deliberately not all of them are
 * unread: two threads have been read to the last word and can still owe the clinic
 * a phone call. Deriving one from the other would quietly drop that case, so the
 * flag is its own field — and one of those two is on this desk, so the case the
 * flag exists for is reachable without reassigning anybody.
 *
 * Five threads for a clinic, not for a desk: `SecretarySession` shows the
 * Secretary the ones belonging to their own patients and to their own doctor, so
 * the signed-in sample sees three of these five. The other two are not dead
 * fixtures — they are what another Secretary's desk looks like, and the scoping
 * is only worth asserting because the clinic is bigger than one person.
 */
export const MOCK_CONVERSATIONS: readonly Conversation[] = [
  { id: 'cnv-01', party: 'patient', partyId: 'pat-211', awaitingAction: true },
  { id: 'cnv-02', party: 'patient', partyId: 'pat-215', awaitingAction: true },
  { id: 'cnv-03', party: 'doctor', partyId: 'doc-002', awaitingAction: true },
  { id: 'cnv-04', party: 'patient', partyId: 'pat-205', awaitingAction: false },
  // Read to the last word and still owed a reply, so the read/owed distinction is
  // reachable from the signed-in desk rather than only from another one.
  { id: 'cnv-05', party: 'patient', partyId: 'pat-208', awaitingAction: true },
];

/**
 * Messages across those threads, oldest first within each thread.
 *
 * A `readAt` of `null` is what makes a row show "New" and the nav show a count,
 * so the unread fixtures are spread over two threads rather than piled into one
 * — otherwise the count and the list could not disagree, and a badge that can
 * never disagree with the list below it proves nothing.
 *
 * The bodies are the front desk doing its actual job: moving a lab slot,
 * chasing a doctor for an extra opening, confirming a cancellation. That is what
 * a Secretary's messages are for, and placeholder text would not exercise the
 * bubble widths that make a thread readable.
 */
export const MOCK_MESSAGES: readonly ConversationMessage[] = [
  // ---- cnv-01 · patient moving a lab slot. Two read, then a fresh question.
  {
    id: 'msg-0001',
    conversationId: 'cnv-01',
    sentAt: minutesAgo(320),
    body: 'Hello, is it possible to change my scheduled lab interpretation with Dr. Oribello from 10:30 AM to the afternoon? I have a work meeting in the morning.',
    fromSecretary: false,
    readAt: minutesAgo(318),
  },
  {
    id: 'msg-0002',
    conversationId: 'cnv-01',
    sentAt: minutesAgo(300),
    body: 'Hi Elena! Let me check the schedule. Dr. Oribello has an open slot at 5:30 PM that day. Would that work for you?',
    fromSecretary: true,
    readAt: minutesAgo(299),
  },
  {
    id: 'msg-0003',
    conversationId: 'cnv-01',
    sentAt: minutesAgo(12),
    body: 'Yes please, 5:30 PM is fine. Will the results still be ready the same week?',
    fromSecretary: false,
    readAt: null,
  },

  // ---- cnv-02 · a brand new question, never opened. From the walk-in on
  // doc-003's panel: registered at the desk, no appointment on file, asking how
  // to become a patient.
  {
    id: 'msg-0004',
    conversationId: 'cnv-02',
    sentAt: minutesAgo(55),
    body: 'Good afternoon. I was told Dr. Navarro keeps an opening in the mornings — is that still free this week, or do we need to book a slot for a first consultation?',
    fromSecretary: false,
    readAt: null,
  },

  // ---- cnv-03 · a doctor offering an extra opening. Read, but still owed a reply.
  {
    id: 'msg-0005',
    conversationId: 'cnv-03',
    sentAt: minutesAgo(190),
    body: 'Celine, I can take one extra patient on Thursday afternoon if the list is still short. Let me know by end of day.',
    fromSecretary: false,
    readAt: minutesAgo(188),
  },
  {
    id: 'msg-0006',
    conversationId: 'cnv-03',
    sentAt: minutesAgo(165),
    body: 'Noted, thank you Dr. Lim. I will confirm once the morning cancellations are in.',
    fromSecretary: true,
    readAt: minutesAgo(164),
  },

  // ---- cnv-04 · settled: a follow-up booking the patient has acknowledged.
  {
    id: 'msg-0007',
    conversationId: 'cnv-04',
    sentAt: minutesAgo(1560),
    body: 'Can I book the eczema review for next week instead? The current slot clashes with my shift.',
    fromSecretary: false,
    readAt: minutesAgo(1558),
  },
  {
    id: 'msg-0008',
    conversationId: 'cnv-04',
    sentAt: minutesAgo(1540),
    body: 'Moved to the following Tuesday at 9:00 AM with Dr. Navarro. You will get a confirmation shortly.',
    fromSecretary: true,
    readAt: minutesAgo(1539),
  },
  {
    id: 'msg-0009',
    conversationId: 'cnv-04',
    sentAt: minutesAgo(1500),
    body: 'Thank you for the quick confirmation!',
    fromSecretary: false,
    readAt: minutesAgo(1499),
  },

  // ---- cnv-05 · settled two days ago: a cancellation the patient accepted.
  {
    id: 'msg-0010',
    conversationId: 'cnv-05',
    sentAt: minutesAgo(3000),
    body: 'I am sorry, I need to cancel the mole screening. Something came up at work.',
    fromSecretary: false,
    readAt: minutesAgo(2998),
  },
  {
    id: 'msg-0011',
    conversationId: 'cnv-05',
    sentAt: minutesAgo(2980),
    body: 'Cancelled. No charge for a notice this short. Rebook any time and we will find you a slot.',
    fromSecretary: true,
    readAt: minutesAgo(2979),
  },
];
