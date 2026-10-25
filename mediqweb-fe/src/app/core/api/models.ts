export type UserRole = 'patient' | 'doctor' | 'secretary' | 'admin';

export interface UserProfile {
  id: string;
  username: string;
  fullName: string;
  email?: string;
  mobileNumber: string;
  dateOfBirth: string;
  role: UserRole;
  status: string;
  assignedDoctorId?: string;
}

export interface AuthSession {
  accessToken: string;
  expiresAt: string;
  refreshToken: string;
  refreshExpiresAt: string;
  profile: UserProfile;
}

export interface Doctor {
  id: string;
  userId: string;
  fullName: string;
  specialty: string;
  specializationId: string;
  licenseNumber: string;
  yearsOfExperience: number;
  feeCentavos: number;
  bio: string;
  building: string;
  floor: string;
  room: string;
  languages: string;
  status: string;
}

export interface Paged<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  startsAt: string;
  durationMinutes: number;
  status: AppointmentStatus;
  reason: string;
  createdAt: string;
  updatedAt: string;
}

export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no-show';

export interface MessageThread {
  id: string;
  patientId: string;
  doctorId: string;
  subject: string;
  lastMessageAt: string;
  unreadCount: number;
  awaitingAction: boolean;
}

// ---------------------------------------------------------------------------
// Specializations (aligns with Figma doctor listing filters)
// ---------------------------------------------------------------------------
export interface Specialization {
  id: string;
  name: string;
  description: string;
  iconName?: string;
  colorHex?: string;
  doctorCount: number;
}

// ---------------------------------------------------------------------------
// Schedule / Slots (aligns with Figma appointment booking calendar)
// ---------------------------------------------------------------------------
export interface ScheduleSlot {
  id: string;
  doctorId: string;
  startsAt: string;
  endsAt: string;
  isBooked: boolean;
  appointmentId?: string;
}

export interface DoctorSchedule {
  doctorId: string;
  date: string; // YYYY-MM-DD
  slots: ScheduleSlot[];
}

export interface CreateAppointmentRequest {
  doctorId: string;
  startsAt: string;
  durationMinutes: number;
  reason: string;
}

// ---------------------------------------------------------------------------
// Prescriptions (aligns with Figma doctor prescription view)
// ---------------------------------------------------------------------------
export interface Prescription {
  id: string;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  medication: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  instructions: string;
  issuedAt: string;
}

export interface CreatePrescriptionRequest {
  appointmentId: string;
  medication: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  instructions: string;
}

// ---------------------------------------------------------------------------
// Medical Records (aligns with Figma patient history view)
// ---------------------------------------------------------------------------
export interface MedicalRecord {
  id: string;
  patientId: string;
  doctorId: string;
  visitDate: string;
  diagnosis: string;
  symptoms: string;
  treatment: string;
  notes: string;
  prescriptionIds: string[];
}

export interface PatientMedicalHistory {
  patientId: string;
  records: MedicalRecord[];
  totalVisits: number;
}

// ---------------------------------------------------------------------------
// Payments / Invoices (aligns with Figma billing view)
// ---------------------------------------------------------------------------
export interface Invoice {
  id: string;
  appointmentId: string;
  patientId: string;
  amountCentavos: number;
  status: InvoiceStatus;
  issuedAt: string;
  dueAt?: string;
  paidAt?: string;
}

export type InvoiceStatus = 'pending' | 'paid' | 'overdue' | 'refunded';

export interface PaymentRequest {
  invoiceId: string;
  amountCentavos: number;
  paymentMethod: 'gcash' | 'maya' | 'card' | 'cash';
}

// ---------------------------------------------------------------------------
// Notifications (aligns with Figma notification bell / toast)
// ---------------------------------------------------------------------------
export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string;
  actionUrl?: string;
}

export type NotificationType = 'appointment' | 'prescription' | 'message' | 'system' | 'payment';

// ---------------------------------------------------------------------------
// API Response Wrappers
// ---------------------------------------------------------------------------
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface ApiError {
  status: number;
  message: string;
  details?: Record<string, string[]>;
}

// ---------------------------------------------------------------------------
// Admin Dashboard Stats (aligns with Figma admin dashboard cards)
// ---------------------------------------------------------------------------
export interface DashboardStats {
  totalPatients: number;
  totalDoctors: number;
  totalAppointments: number;
  pendingAppointments: number;
  completedAppointments: number;
  revenueCentavos: number;
}

// ---------------------------------------------------------------------------
// Doctor Dashboard Stats
// ---------------------------------------------------------------------------
export interface DoctorDashboardStats {
  totalPatients: number;
  todayAppointments: number;
  pendingAppointments: number;
  completedAppointments: number;
  revenueCentavos: number;
}

// ---------------------------------------------------------------------------
// Secretary Dashboard Stats
// ---------------------------------------------------------------------------
export interface SecretaryDashboardStats {
  totalAppointments: number;
  pendingConfirmations: number;
  todayAppointments: number;
  totalPatients: number;
}

// ---------------------------------------------------------------------------
// Audit log entries (aligns with Figma admin audit-logs page)
// ---------------------------------------------------------------------------

export type AuditSeverity = 'info' | 'warning' | 'danger';

export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  target: string;
  at: string;
  severity: AuditSeverity;
}

// ---------------------------------------------------------------------------
// Filters / Search (aligns with Figma filter bar)
// ---------------------------------------------------------------------------
export interface DoctorFilter {
  specializationId?: string;
  search?: string;
  minFee?: number;
  maxFee?: number;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface AppointmentFilter {
  patientId?: string;
  doctorId?: string;
  status?: AppointmentStatus;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}
