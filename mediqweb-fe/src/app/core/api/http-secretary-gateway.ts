import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Appointment,
  UserProfile,
  MessageThread,
  Paged,
  SecretaryDashboardStats,
  AppointmentFilter,
  ApiResponse,
} from './models';
import { environment } from '../../../environments/environment';

const BASE = `${environment.apiBaseUrl}`;

/**
 * Secretary gateway: appointment queue, patient directory, messages,
 * confirmations and cancellations. Aligns with the Figma secretary
 * dashboard (appointment queue board, patient directory, message
 * inbox, confirm/cancel actions, stat cards).
 */
@Injectable({ providedIn: 'root' })
export class HttpSecretaryGateway {
  private http = inject(HttpClient);

  // ---- Dashboard stats ----
  getDashboardStats(): Observable<SecretaryDashboardStats> {
    return this.http.get<SecretaryDashboardStats>(`${BASE}/secretary/stats`);
  }

  // ---- Appointments ----
  getAppointments(filter?: AppointmentFilter): Observable<Paged<Appointment>> {
    return this.http.get<Paged<Appointment>>(`${BASE}/secretary/appointments`, {
      params: filter as unknown as Record<string, string>,
    });
  }

  getAppointment(id: string): Observable<Appointment> {
    return this.http.get<Appointment>(`${BASE}/secretary/appointments/${id}`);
  }

  confirmAppointment(id: string): Observable<void> {
    return this.http.post<void>(`${BASE}/secretary/appointments/${id}/confirm`, null);
  }

  cancelAppointment(id: string): Observable<void> {
    return this.http.post<void>(`${BASE}/secretary/appointments/${id}/cancel`, null);
  }

  // ---- Patients ----
  getPatients(): Observable<UserProfile[]> {
    return this.http.get<UserProfile[]>(`${BASE}/secretary/patients`);
  }

  getPatient(id: string): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${BASE}/secretary/patients/${id}`);
  }

  // ---- Messages ----
  getMessages(): Observable<MessageThread[]> {
    return this.http.get<MessageThread[]>(`${BASE}/secretary/messages`);
  }

  getMessage(id: string): Observable<MessageThread> {
    return this.http.get<MessageThread>(`${BASE}/secretary/messages/${id}`);
  }

  markMessageAsRead(id: string): Observable<void> {
    return this.http.post<void>(`${BASE}/secretary/messages/${id}/read`, null);
  }
}
