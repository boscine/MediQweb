import type {
  Appointment,
  AuditEntry,
  PatientAccount,
  Specialization,
  StaffAccount,
} from './admin.models';

/**
 * Sample data standing in for API responses.
 *
 * Obvious placeholder values, kept in one file so they are trivial to delete
 * when the real endpoints land. Nothing here should be mistaken for a real
 * patient, so names are plainly fictional and no record carries a real
 * identifier.
 */

export const MOCK_SPECIALIZATIONS: readonly Specialization[] = [
  { id: 'spec-cardio', name: 'Cardiology', description: 'Heart and cardiovascular care.' },
  { id: 'spec-derm', name: 'Dermatology', description: 'Skin, hair and nail conditions.' },
  { id: 'spec-peds', name: 'Pediatrics', description: 'Care for infants and children.' },
  { id: 'spec-ortho', name: 'Orthopedics', description: 'Bones, joints and movement.' },
  { id: 'spec-psych', name: 'Psychiatry', description: 'Mental health and wellbeing.' },
  { id: 'spec-general', name: 'General Medicine', description: 'Primary and whole-family care.' },
];

export const MOCK_DOCTORS: readonly StaffAccount[] = [
  {
    id: 'doc-001',
    name: 'Elena Vargas',
    email: 'elena.vargas@mediq.ph',
    username: 'evargas',
    status: 'active',
    specializationId: 'spec-cardio',
    licenseNumber: 'PRC-118452',
    assignedDoctorId: null,
    joinedOn: '2025-11-03',
    lastActiveOn: '2026-09-28',
  },
  {
    id: 'doc-002',
    name: 'Rafael Santos',
    email: 'rafael.santos@mediq.ph',
    username: 'rsantos',
    status: 'active',
    specializationId: 'spec-ortho',
    licenseNumber: 'PRC-120913',
    assignedDoctorId: null,
    joinedOn: '2026-01-19',
    lastActiveOn: '2026-09-27',
  },
  {
    id: 'doc-003',
    name: 'Mae Villanueva',
    email: 'mae.villanueva@mediq.ph',
    username: 'mvillanueva',
    status: 'active',
    specializationId: 'spec-derm',
    licenseNumber: 'PRC-124770',
    assignedDoctorId: null,
    joinedOn: '2026-03-02',
    lastActiveOn: '2026-09-28',
  },
  {
    id: 'doc-004',
    name: 'Oscar Dela Cruz',
    email: 'oscar.delacruz@mediq.ph',
    username: 'odelacruz',
    status: 'inactive',
    specializationId: 'spec-general',
    licenseNumber: 'PRC-115028',
    assignedDoctorId: null,
    joinedOn: '2025-08-11',
    lastActiveOn: '2026-06-14',
  },
  {
    id: 'doc-005',
    name: 'Bea Almonte',
    email: 'bea.almonte@mediq.ph',
    username: 'balmonte',
    status: 'active',
    specializationId: 'spec-peds',
    licenseNumber: 'PRC-126311',
    assignedDoctorId: null,
    joinedOn: '2026-05-21',
    lastActiveOn: '2026-09-28',
  },
  {
    id: 'doc-006',
    name: 'Nilo Ramos',
    email: 'nilo.ramos@mediq.ph',
    username: 'nramos',
    status: 'inactive',
    specializationId: 'spec-psych',
    licenseNumber: 'PRC-122104',
    assignedDoctorId: null,
    joinedOn: '2025-12-08',
    lastActiveOn: '2026-04-02',
  },
];

export const MOCK_SECRETARIES: readonly StaffAccount[] = [
  {
    id: 'sec-001',
    name: 'Grace Lim',
    email: 'grace.lim@mediq.ph',
    username: 'glim',
    status: 'active',
    specializationId: null,
    licenseNumber: null,
    assignedDoctorId: 'doc-001',
    joinedOn: '2025-09-01',
    lastActiveOn: '2026-09-28',
  },
  {
    id: 'sec-002',
    name: 'Paolo Mendoza',
    email: 'paolo.mendoza@mediq.ph',
    username: 'pmendoza',
    status: 'active',
    specializationId: null,
    licenseNumber: null,
    assignedDoctorId: 'doc-002',
    joinedOn: '2026-02-16',
    lastActiveOn: '2026-09-28',
  },
  {
    id: 'sec-003',
    name: 'Carla Bautista',
    email: 'carla.bautista@mediq.ph',
    username: 'cbautista',
    status: 'active',
    specializationId: null,
    licenseNumber: null,
    assignedDoctorId: 'doc-003',
    joinedOn: '2026-04-27',
    lastActiveOn: '2026-09-25',
  },
  {
    // Inactive, and assigned to an active doctor rather than an inactive one:
    // the two axes are independent, and a fixture that only ever paired them
    // would hide a list where a disabled secretary is the only one on a desk.
    id: 'sec-004',
    name: 'Dennis Ocampo',
    email: 'dennis.ocampo@mediq.ph',
    username: 'docampo',
    status: 'inactive',
    specializationId: null,
    licenseNumber: null,
    assignedDoctorId: 'doc-005',
    joinedOn: '2025-10-15',
    lastActiveOn: '2026-05-30',
  },
];

export const MOCK_PATIENTS: readonly PatientAccount[] = [
  {
    id: 'pat-001',
    name: 'Maria Concepcion',
    email: 'maria.concepcion@example.ph',
    phone: '+63 917 555 0142',
    dateOfBirth: '1991-02-11',
    status: 'active',
    registeredOn: '2025-10-04',
  },
  {
    id: 'pat-002',
    name: 'Jose Pimentel',
    email: 'jose.pimentel@example.ph',
    phone: '+63 918 555 0177',
    dateOfBirth: '1984-07-30',
    status: 'active',
    registeredOn: '2025-11-21',
  },
  {
    id: 'pat-003',
    name: 'Ana Buenaventura',
    email: 'ana.buenaventura@example.ph',
    phone: '+63 919 555 0119',
    dateOfBirth: '2016-05-19',
    status: 'active',
    registeredOn: '2026-01-08',
  },
  {
    id: 'pat-004',
    name: 'Ricardo Sy',
    email: 'ricardo.sy@example.ph',
    phone: '+63 917 555 0163',
    dateOfBirth: '1976-12-02',
    status: 'inactive',
    registeredOn: '2025-09-19',
  },
  {
    id: 'pat-005',
    name: 'Lourdes Agustin',
    email: 'lourdes.agustin@example.ph',
    phone: '+63 918 555 0188',
    dateOfBirth: '2001-09-24',
    status: 'active',
    registeredOn: '2026-06-13',
  },
  {
    id: 'pat-006',
    name: 'Teresita Aquino',
    email: 'teresita.aquino@example.ph',
    phone: '+63 919 555 0134',
    dateOfBirth: '1996-03-15',
    status: 'active',
    registeredOn: '2026-08-02',
  },
];

/**
 * A timestamp `daysFromToday` days from now at `hour:minute` local time.
 *
 * Relative rather than written out, for the reason the Doctor and Secretary
 * fixtures do the same: a `booked` appointment dated last March would be a
 * booking nobody could still attend, and the lifecycle the dashboard charts
 * would stop making sense the day after the file was written.
 */
function at(daysFromToday: number, hour: number, minute = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  date.setHours(hour, minute, 0, 0);
  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

/**
 * Clinic-wide appointments, counting both directions of the lifecycle: the
 * closed ones behind it and the open ones ahead of it, so a chart of pending,
 * ongoing and finished has something in every slice.
 *
 * `cancelled` and `no-show` are present on purpose. They are outcomes rather
 * than stages, so the dashboard's chart leaves them out — which is only worth
 * asserting if the fixture actually contains them.
 */
export const MOCK_APPOINTMENTS: readonly Appointment[] = [
  // ---- Closed out
  {
    id: 'appt-301',
    patientId: 'pat-001',
    doctorId: 'doc-001',
    startsAt: at(-7, 9),
    durationMinutes: 30,
    status: 'completed',
    reason: 'Follow-up: blood pressure review',
  },
  {
    id: 'appt-302',
    patientId: 'pat-002',
    doctorId: 'doc-002',
    startsAt: at(-5, 10, 30),
    durationMinutes: 45,
    status: 'completed',
    reason: 'Follow-up: knee rehabilitation',
  },
  {
    id: 'appt-303',
    patientId: 'pat-003',
    doctorId: 'doc-005',
    startsAt: at(-3, 15),
    durationMinutes: 20,
    status: 'completed',
    reason: 'Child wellness check',
  },
  {
    id: 'appt-304',
    patientId: 'pat-005',
    doctorId: 'doc-003',
    startsAt: at(-2, 11),
    durationMinutes: 30,
    status: 'completed',
    reason: 'Skin rash assessment',
  },
  {
    id: 'appt-305',
    patientId: 'pat-006',
    doctorId: 'doc-001',
    startsAt: at(-1, 14),
    durationMinutes: 30,
    status: 'completed',
    reason: 'ECG reading and review',
  },
  {
    id: 'appt-306',
    patientId: 'pat-002',
    doctorId: 'doc-003',
    startsAt: at(-2, 16),
    durationMinutes: 15,
    status: 'no-show',
    reason: 'Skin check',
  },
  {
    id: 'appt-307',
    patientId: 'pat-006',
    doctorId: 'doc-002',
    startsAt: at(-1, 9),
    durationMinutes: 45,
    status: 'cancelled',
    reason: 'Post-operative review',
  },
  {
    id: 'appt-308',
    patientId: 'pat-001',
    doctorId: 'doc-005',
    startsAt: at(2, 13),
    durationMinutes: 20,
    status: 'cancelled',
    reason: 'Allergy follow-up',
  },

  // ---- Open: booked but not yet confirmed, and confirmed
  {
    id: 'appt-309',
    patientId: 'pat-003',
    doctorId: 'doc-005',
    startsAt: at(0, 14),
    durationMinutes: 20,
    status: 'booked',
    reason: 'Pediatric consult',
  },
  {
    id: 'appt-310',
    patientId: 'pat-005',
    doctorId: 'doc-003',
    startsAt: at(1, 9),
    durationMinutes: 30,
    status: 'booked',
    reason: 'Dermatology consult',
  },
  {
    id: 'appt-311',
    patientId: 'pat-002',
    doctorId: 'doc-001',
    startsAt: at(1, 11),
    durationMinutes: 30,
    status: 'booked',
    reason: 'Hypertension check',
  },
  {
    id: 'appt-312',
    patientId: 'pat-001',
    doctorId: 'doc-002',
    startsAt: at(0, 15),
    durationMinutes: 45,
    status: 'confirmed',
    reason: 'Knee pain consult',
  },
  {
    id: 'appt-313',
    patientId: 'pat-006',
    doctorId: 'doc-001',
    startsAt: at(2, 10),
    durationMinutes: 30,
    status: 'confirmed',
    reason: 'Cardiology follow-up',
  },
  {
    id: 'appt-314',
    patientId: 'pat-005',
    doctorId: 'doc-003',
    startsAt: at(4, 8, 30),
    durationMinutes: 20,
    status: 'confirmed',
    reason: 'Mole check',
  },
];

export const MOCK_AUDIT_ENTRIES: readonly AuditEntry[] = [
  {
    id: 'log-001',
    actor: 'Alex Rivera',
    action: 'Deactivated account',
    target: 'Dr. Oscar Dela Cruz',
    at: '2026-09-28T14:22:00',
    severity: 'warning',
  },
  {
    id: 'log-002',
    actor: 'Alex Rivera',
    action: 'Created secretary account',
    target: 'Carla Bautista',
    at: '2026-09-28T09:05:00',
    severity: 'info',
  },
  {
    id: 'log-003',
    actor: 'Grace Lim',
    action: 'Updated patient contact number',
    target: 'Maria Concepcion',
    at: '2026-09-27T16:40:00',
    severity: 'info',
  },
  {
    id: 'log-004',
    actor: 'System',
    action: 'Rejected sign-in attempt',
    target: 'unknown@mediq.ph',
    at: '2026-09-27T11:18:00',
    severity: 'danger',
  },
  {
    id: 'log-005',
    actor: 'Alex Rivera',
    action: 'Added specialization',
    target: 'Psychiatry',
    at: '2026-09-26T13:02:00',
    severity: 'info',
  },
  {
    id: 'log-006',
    actor: 'Alex Rivera',
    action: 'Reactivated account',
    target: 'Dennis Ocampo',
    at: '2026-09-25T10:31:00',
    severity: 'info',
  },
  {
    id: 'log-007',
    actor: 'System',
    action: 'Failed to export audit log',
    target: 'retention job',
    at: '2026-09-24T02:00:00',
    severity: 'warning',
  },
  {
    id: 'log-008',
    actor: 'Alex Rivera',
    action: 'Changed clinic contact email',
    target: 'Clinic settings',
    at: '2026-09-23T15:47:00',
    severity: 'info',
  },
];
