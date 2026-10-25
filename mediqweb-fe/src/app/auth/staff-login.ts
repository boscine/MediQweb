import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { HttpAuthGateway } from '../core/api/http-auth-gateway';

@Component({
  selector: 'app-staff-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login">
      <h2>MediQ Sign In</h2>
      <form (ngSubmit)="onSubmit()" #f="ngForm">
        <label>Username <input name="username" [(ngModel)]="username" required /></label>
        <label>Password <input name="password" type="password" [(ngModel)]="password" required /></label>
        <button type="submit" [disabled]="loading || !f.valid">Sign in</button>
      </form>
      <p *ngIf="error" class="error">{{ error }}</p>
      <p *ngIf="loading">Signing in&hellip;</p>
    </div>
  `,
  styles: [
    `
      .login { max-width: 320px; margin: 48px auto; font-family: system-ui, sans-serif; }
      h2 { font-size: 1.5rem; margin-bottom: 1rem; }
      form { display: flex; flex-direction: column; gap: 0.75rem; }
      label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.9rem; }
      input { padding: 0.5rem; font-size: 1rem; }
      button { padding: 0.6rem; font-size: 1rem; cursor: pointer; }
      .error { color: #c0392b; font-size: 0.9rem; margin: 0.5rem 0 0; }
    `,
  ],
})
export class StaffLogin {
  private gateway = inject(HttpAuthGateway);
  private router = inject(Router);

  username = '';
  password = '';
  loading = false;
  error: string | null = null;

  async onSubmit(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      await firstValueFrom(this.gateway.signIn(this.username, this.password));
      this.router.navigateByUrl('/doctor');
    } catch (e) {
      this.error = 'Invalid credentials or the auth service is unreachable.';
    } finally {
      this.loading = false;
    }
  }
}
