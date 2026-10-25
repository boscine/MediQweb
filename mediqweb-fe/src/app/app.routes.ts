import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { DoctorDashboard } from './doctor/dashboard';

export const routes: Routes = [
  {
    path: 'login',
    title: 'Sign in · MediQ',
    loadComponent: () => import('./auth/pages/staff-login/staff-login').then((m) => m.StaffLogin),
  },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'doctor',
    loadChildren: () => import('./doctor/doctor.routes').then((m) => m.DOCTOR_ROUTES),
    canActivate: [authGuard],
  },
  {
    path: 'admin',
    loadChildren: () => import('./admin/admin.routes').then((m) => m.ADMIN_ROUTES),
    canActivate: [authGuard],
  },
  {
    path: 'secretary',
    loadChildren: () => import('./secretary/secretary.routes').then((m) => m.SECRETARY_ROUTES),
    canActivate: [authGuard],
  },
  // Temporary: every unknown route lands on sign-in until the remaining role
  // areas exist. Replace with a real not-found page.
  { path: '**', redirectTo: 'login' },
];
