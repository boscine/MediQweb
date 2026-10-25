/**
 * Centralized API route constants. All backend paths live here so
 * frontend call sites never hardcode a URL string. Mirrors the
 * Ktor routing surface (see server/http/Routes.kt) so the two stay
 * in sync when routes are added or renamed.
 */
export const API_ROUTES = {
  // ---- Auth (proxied via BFF on bffBaseUrl) ----
  AUTH: {
    SIGN_IN: '/auth/sign-in',
    REFRESH: '/auth/refresh',
    ME: '/me',
  } as const,

  // ---- Admin ----
  ADMIN: {
    ACCOUNTS: (id?: string) => (id ? `/admin/accounts/${id}` : '/admin/accounts'),
    DOCTORS: (id?: string) => (id ? `/admin/doctors/${id}` : '/admin/doctors'),
    SPECIALIZATIONS: (id?: string) =>
      id ? `/admin/specializations/${id}` : '/admin/specializations',
    STATS: '/admin/stats',
  } as const,

  // ---- Doctor ----
  DOCTOR: {
    PROFILE: '/doctor/profile',
    STATS: '/doctor/stats',
    SCHEDULE: '/doctor/schedule',
    SLOTS: (slotId?: string) =>
      slotId ? `/doctor/schedule/slots/${slotId}` : '/doctor/schedule/slots',
    APPOINTMENTS: (id?: string) =>
      id ? `/doctor/appointments/${id}` : '/doctor/appointments',
    APPOINTMENT_STATUS: (id: string) =>
      `/doctor/appointments/${id}/status`,
    PATIENTS: (id?: string) =>
      id ? `/doctor/patients/${id}` : '/doctor/patients',
    PATIENT_RECORDS: (patientId: string) =>
      `/doctor/patients/${patientId}/records`,
    RECORDS: '/doctor/records',
    PRESCRIPTIONS: (appointmentId?: string) =>
      appointmentId
        ? `/doctor/appointments/${appointmentId}/prescriptions`
        : '/doctor/prescriptions',
  } as const,

  // ---- Secretary ----
  SECRETARY: {
    STATS: '/secretary/stats',
    APPOINTMENTS: (id?: string) =>
      id ? `/secretary/appointments/${id}` : '/secretary/appointments',
    APPOINTMENT_CONFIRM: (id: string) =>
      `/secretary/appointments/${id}/confirm`,
    APPOINTMENT_CANCEL: (id: string) =>
      `/secretary/appointments/${id}/cancel`,
    PATIENTS: (id?: string) =>
      id ? `/secretary/patients/${id}` : '/secretary/patients',
    MESSAGES: (id?: string) =>
      id ? `/secretary/messages/${id}` : '/secretary/messages',
    MESSAGE_READ: (id: string) => `/secretary/messages/${id}/read`,
  } as const,

  // ---- Patient ----
  PATIENT: {
    PROFILE: '/patient/profile',
    APPOINTMENTS: (id?: string) =>
      id ? `/patient/appointments/${id}` : '/patient/appointments',
    APPOINTMENT_CANCEL: (id: string) =>
      `/patient/appointments/${id}/cancel`,
    DOCTORS: '/patient/doctors',
    SPECIALIZATIONS: '/patient/specializations',
    RECORDS: '/patient/records',
    PRESCRIPTIONS: '/patient/prescriptions',
    INVOICES: '/patient/invoices',
    PAYMENTS: '/patient/payments',
    NOTIFICATIONS: (id?: string) =>
      id ? `/patient/notifications/${id}` : '/patient/notifications',
    NOTIFICATION_READ: (id: string) =>
      `/patient/notifications/${id}/read`,
  } as const,
} as const;

/**
 * Base URL resolver. Prefers `apiBaseUrl` for Ktor-facing calls;
 * falls back to `bffBaseUrl` for auth-proxied calls.
 */
export function apiBaseUrl(useBff = false): string {
  const env = (window as unknown as { __env?: Record<string, string> }).__env;
  if (useBff) return env?.['BFF_BASE_URL'] ?? 'http://localhost:3000';
  return env?.['API_BASE_URL'] ?? 'http://localhost:8099';
}

/**
 * Builds a full URL from a route path template and optional params.
 */
export function buildUrl(
  route: string | ((id?: string) => string),
  id?: string,
  useBff = false,
): string {
  const path = typeof route === 'function' ? route(id) : route;
  return `${apiBaseUrl(useBff)}${path}`;
}
