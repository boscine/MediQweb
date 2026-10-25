import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  UserProfile,
  Paged,
  Doctor,
  Specialization,
  DashboardStats,
  DoctorFilter,
  ApiResponse,
  AuditEntry,
} from './models';
import { environment } from '../../../environments/environment';

const BASE = `${environment.apiBaseUrl}`;

/**
 * Admin gateway: full CRUD for accounts, doctors, specializations,
 * and dashboard statistics. Aligns with the Figma admin dashboard
 * (account management, doctor directory, specialization catalog,
 * stat cards and activity charts).
 */
@Injectable({ providedIn: 'root' })
export class HttpAdminGateway {
  private http = inject(HttpClient);

  // ---- Accounts ----
  getAccounts(): Observable<UserProfile[]> {
    return this.http.get<UserProfile[]>(`${BASE}/admin/accounts`);
  }

  getAccount(id: string): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${BASE}/admin/accounts/${id}`);
  }

  createAccount(account: Partial<UserProfile>): Observable<UserProfile> {
    return this.http.post<UserProfile>(`${BASE}/admin/accounts`, account);
  }

  updateAccount(id: string, account: Partial<UserProfile>): Observable<UserProfile> {
    return this.http.put<UserProfile>(`${BASE}/admin/accounts/${id}`, account);
  }

  deleteAccount(id: string): Observable<void> {
    return this.http.delete<void>(`${BASE}/admin/accounts/${id}`);
  }

  // ---- Doctors ----
  getDoctors(params?: DoctorFilter): Observable<Paged<Doctor>> {
    return this.http.get<Paged<Doctor>>(`${BASE}/admin/doctors`, {
      params: params as unknown as Record<string, string>,
    });
  }

  getDoctor(id: string): Observable<Doctor> {
    return this.http.get<Doctor>(`${BASE}/admin/doctors/${id}`);
  }

  createDoctor(doctor: Partial<Doctor>): Observable<Doctor> {
    return this.http.post<Doctor>(`${BASE}/admin/doctors`, doctor);
  }

  updateDoctor(id: string, doctor: Partial<Doctor>): Observable<Doctor> {
    return this.http.put<Doctor>(`${BASE}/admin/doctors/${id}`, doctor);
  }

  deleteDoctor(id: string): Observable<void> {
    return this.http.delete<void>(`${BASE}/admin/doctors/${id}`);
  }

  // ---- Specializations ----
  getSpecializations(): Observable<Specialization[]> {
    return this.http.get<Specialization[]>(`${BASE}/admin/specializations`);
  }

  createSpecialization(spec: Partial<Specialization>): Observable<Specialization> {
    return this.http.post<Specialization>(`${BASE}/admin/specializations`, spec);
  }

  updateSpecialization(id: string, spec: Partial<Specialization>): Observable<Specialization> {
    return this.http.put<Specialization>(`${BASE}/admin/specializations/${id}`, spec);
  }

  deleteSpecialization(id: string): Observable<void> {
    return this.http.delete<void>(`${BASE}/admin/specializations/${id}`);
  }

  // ---- Dashboard stats ----
  getDashboardStats(): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(`${BASE}/admin/stats`);
  }

  // ---- Audit logs ----
  getAuditLogs(): Observable<AuditEntry[]> {
    return this.http.get<AuditEntry[]>(`${BASE}/admin/audit-logs`);
  }
}
