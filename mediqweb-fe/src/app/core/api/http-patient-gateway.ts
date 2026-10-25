import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Appointment,
  UserProfile,
  Doctor,
  Specialization,
  Paged,
  MedicalRecord,
  Prescription,
  Invoice,
  Notification,
  PaymentRequest,
  CreateAppointmentRequest,
  AppointmentFilter,
  ApiResponse,
} from './models';
import { environment } from '../../../environments/environment';

const BASE = `${environment.apiBaseUrl}`;

/**
 * Patient gateway: appointments, doctor directory, prescriptions,
 * medical history, invoices/payments and notifications. Aligns with
 * the Figma patient dashboard (upcoming appointments, find-a-doctor,
 * prescription list, medical records, billing, notifications).
 */
@Injectable({ providedIn: 'root' })
export class HttpPatientGateway {
  private http = inject(HttpClient);

  // ---- Profile ----
  getProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${BASE}/patient/profile`);
  }

  updateProfile(profile: Partial<UserProfile>): Observable<UserProfile> {
    return this.http.put<UserProfile>(`${BASE}/patient/profile`, profile);
  }

  // ---- Appointments ----
  getAppointments(filter?: AppointmentFilter): Observable<Paged<Appointment>> {
    return this.http.get<Paged<Appointment>>(`${BASE}/patient/appointments`, {
      params: filter as unknown as Record<string, string>,
    });
  }

  getAppointment(id: string): Observable<Appointment> {
    return this.http.get<Appointment>(`${BASE}/patient/appointments/${id}`);
  }

  createAppointment(request: CreateAppointmentRequest): Observable<Appointment> {
    return this.http.post<Appointment>(`${BASE}/patient/appointments`, request);
  }

  cancelAppointment(id: string): Observable<void> {
    return this.http.post<void>(`${BASE}/patient/appointments/${id}/cancel`, null);
  }

  // ---- Doctor directory ----
  getDoctors(params?: { specializationId?: string; search?: string; limit?: number; offset?: number }): Observable<Paged<Doctor>> {
    return this.http.get<Paged<Doctor>>(`${BASE}/patient/doctors`, {
      params: params as unknown as Record<string, string>,
    });
  }

  getSpecializations(): Observable<Specialization[]> {
    return this.http.get<Specialization[]>(`${BASE}/patient/specializations`);
  }

  // ---- Medical records ----
  getMedicalRecords(): Observable<MedicalRecord[]> {
    return this.http.get<MedicalRecord[]>(`${BASE}/patient/records`);
  }

  // ---- Prescriptions ----
  getPrescriptions(): Observable<Prescription[]> {
    return this.http.get<Prescription[]>(`${BASE}/patient/prescriptions`);
  }

  // ---- Invoices / Payments ----
  getInvoices(): Observable<Invoice[]> {
    return this.http.get<Invoice[]>(`${BASE}/patient/invoices`);
  }

  payInvoice(request: PaymentRequest): Observable<Invoice> {
    return this.http.post<Invoice>(`${BASE}/patient/payments`, request);
  }

  // ---- Notifications ----
  getNotifications(): Observable<Notification[]> {
    return this.http.get<Notification[]>(`${BASE}/patient/notifications`);
  }

  markNotificationAsRead(id: string): Observable<void> {
    return this.http.post<void>(`${BASE}/patient/notifications/${id}/read`, null);
  }
}
