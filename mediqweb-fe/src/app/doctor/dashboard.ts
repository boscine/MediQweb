import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpDoctorGateway } from '../core/api/http-doctor-gateway';
import { AuthService } from '../core/api/auth.service';
import { Router } from '@angular/router';
import { Doctor } from '../core/api/models';

@Component({
  selector: 'app-doctor-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard">
      <header>
        <h1>MediQ &mdash; Doctor Dashboard</h1>
        <div class="user">{{ doctor?.fullName }} ({{ doctor?.specialty }})</div>
        <button (click)="signOut()">Sign out</button>
      </header>
      <section>
        <h2>Profile</h2>
        <ul *ngIf="doctor">
          <li><strong>License:</strong> {{ doctor.licenseNumber }}</li>
          <li><strong>Experience:</strong> {{ doctor.yearsOfExperience }} years</li>
          <li><strong>Fee:</strong> {{ (doctor.feeCentavos / 100) | currency }}</li>
          <li><strong>Location:</strong> {{ doctor.building }}, Floor {{ doctor.floor }}, Room {{ doctor.room }}</li>
          <li><strong>Languages:</strong> {{ doctor.languages }}</li>
          <li><strong>Status:</strong> {{ doctor.status }}</li>
        </ul>
        <li *ngIf="!doctor">Loading doctor profile&hellip;</li>
        <p *ngIf="error" class="error">{{ error }}</p>
      </section>
    </div>
  `,
  styles: [
    `
      .dashboard { max-width: 900px; margin: 24px auto; font-family: system-ui, sans-serif; }
      header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
      h1 { font-size: 1.5rem; margin: 0; }
      .user { color: #555; font-size: 0.95rem; }
      .error { color: #c0392b; font-size: 0.9rem; }
    `,
  ],
})
export class DoctorDashboard implements OnInit {
  private gateway = inject(HttpDoctorGateway);
  private auth = inject(AuthService);
  private router = inject(Router);

  doctor: Doctor | null = null;
  error: string | null = null;

  ngOnInit(): void {
    this.gateway.getProfile().subscribe({
      next: (d) => (this.doctor = d),
      error: () => (this.error = 'Failed to load doctor profile from the API.'),
    });
  }

  signOut(): void {
    this.auth.signOut();
    this.router.navigateByUrl('/login');
  }
}
