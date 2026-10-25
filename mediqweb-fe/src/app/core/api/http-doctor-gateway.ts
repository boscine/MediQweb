import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Doctor,
  Paged,
  Appointment,
  UserProfile,
  ScheduleSlot,
  DoctorSchedule,
  CreateAppointmentRequest,
  MedicalRecord,
  Prescription,
  CreatePrescriptionRequest,
  DoctorDashboardStats,
  AppointmentFilter,
  ApiResponse,
} from './models';
import { environment } from '../../../environments/environment';

const BASE = `${environment.apiBaseUrl}`;

/**
 * Doctor gateway: schedule management, appointments, patient roster,
 * medical records and prescriptions. Aligns with the Figma doctor
 * dashboard (schedule calendar, appointment list, patient directory,
 * prescription writer, medical history).
 */
@Injectable({ providedIn: 'root' })
export class HttpDoctorGateway {
  private http = inject(HttpClient);

  // ---- Profile ----
  getProfile(): Observable<Doctor> {
    return this.http.get<Doctor>(`${BASE}/doctor/profile`);
  }

  updateProfile(doctor: Partial<Doctor>): Observable<Doctor> {
    return this.http.put<Doctor>(`${BASE}/doctor/profile`, doctor);
  }

  // ---- Dashboard stats ----
  getDashboardStats(): Observable<DoctorDashboardStats> {
    return this.http.get<DoctorDashboardStats>(`${BASE}/doctor/stats`);
  }

  // ---- Schedule ----
  getSchedule(date: string): Observable<DoctorSchedule> {
    return this.http.get<DoctorSchedule>(`${BASE}/doctor/schedule`, {
      params: { date } as unknown as Record<string, string>,
    });
  }

  createSlot(slot: Partial<ScheduleSlot>): Observable<ScheduleSlot> {
    return this.http.post<ScheduleSlot>(`${BASE}/doctor/schedule/slots`, slot);
  }

  deleteSlot(slotId: string): Observable<void> {
    return this.http.delete<void>(`${BASE}/doctor/schedule/slots/${slotId}`);
  }

  // ---- Appointments ----
  getAppointments(filter?: AppointmentFilter): Observable<Paged<Appointment>> {
    return this.http.get<Paged<Appointment>>(`${BASE}/doctor/appointments`, {
      params: filter as unknown as Record<string, string>,
    });
  }

  getAppointment(id: string): Observable<Appointment> {
    return this.http.get<Appointment>(`${BASE}/doctor/appointments/${id}`);
  }

  updateAppointmentStatus(
    id: string,
    status: Appointment['status'],
  ): Observable<Appointment> {
    return this.http.patch<Appointment>(
      `${BASE}/doctor/appointments/${id}/status`,
      { status },
    );
  }

  // ---- Patients ----
  getPatients(): Observable<UserProfile[]> {
    return this.http.get<UserProfile[]>(`${BASE}/doctor/patients`);
  }

  getPatient(id: string): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${BASE}/doctor/patients/${id}`);
  }

  // ---- Medical Records ----
  getMedicalRecords(patientId: string): Observable<MedicalRecord[]> {
    return this.http.get<MedicalRecord[]>(
      `${BASE}/doctor/patients/${patientId}/records`,
    );
  }

  createMedicalRecord(record: Partial<MedicalRecord>): Observable<MedicalRecord> {
    return this.http.post<MedicalRecord>(`${BASE}/doctor/records`, record);
  }

  // ---- Prescriptions ----
  getPrescriptions(appointmentId: string): Observable<Prescription[]> {
    return this.http.get<Prescription[]>(
      `${BASE}/doctor/appointments/${appointmentId}/prescriptions`,
    );
  }

  createPrescription(
    request: CreatePrescriptionRequest,
  ): Observable<Prescription> {
    return this.http.post<Prescription>(`${BASE}/doctor/prescriptions`, request);
  }
}
