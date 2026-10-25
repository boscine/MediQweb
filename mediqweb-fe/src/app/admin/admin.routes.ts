import type { Routes } from '@angular/router';

/**
 * Admin area routes.
 *
 * Every page is its own lazy chunk. `data.heading` is what the shell reads to
 * fill in the layout's page title and breadcrumb, so a page never configures
 * the layout itself.
 */
export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./admin-shell').then((m) => m.AdminShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        title: 'Admin Dashboard · MediQ',
        data: { heading: 'Admin Dashboard' },
        loadComponent: () =>
          import('./pages/admin-dashboard/admin-dashboard').then((m) => m.AdminDashboard),
      },
      {
        path: 'accounts',
        pathMatch: 'full',
        redirectTo: 'accounts/doctors',
      },
      {
        path: 'accounts/doctors',
        title: 'Doctors · Admin · MediQ',
        data: { heading: 'Doctors' },
        loadComponent: () =>
          import('./pages/admin-doctors/admin-doctors').then((m) => m.AdminDoctors),
      },
      {
        path: 'accounts/secretaries',
        title: 'Secretaries · Admin · MediQ',
        data: { heading: 'Secretaries' },
        loadComponent: () =>
          import('./pages/admin-secretaries/admin-secretaries').then((m) => m.AdminSecretaries),
      },
      {
        path: 'accounts/patients',
        title: 'Patients · Admin · MediQ',
        data: { heading: 'Patients' },
        loadComponent: () =>
          import('./pages/admin-patients/admin-patients').then((m) => m.AdminPatients),
      },
      {
        path: 'specializations',
        title: 'Specializations · Admin · MediQ',
        data: { heading: 'Specialties' },
        loadComponent: () =>
          import('./pages/admin-specializations/admin-specializations').then(
            (m) => m.AdminSpecializations,
          ),
      },
      {
        path: 'audit-logs',
        title: 'Audit Logs · Admin · MediQ',
        data: { heading: 'Audit Logs' },
        loadComponent: () =>
          import('./pages/admin-audit-logs/admin-audit-logs').then((m) => m.AdminAuditLogs),
      },
      {
        path: 'settings',
        title: 'Settings · Admin · MediQ',
        data: { heading: 'Settings' },
        loadComponent: () =>
          import('./pages/admin-settings/admin-settings').then((m) => m.AdminSettings),
      },
      {
        path: 'account/details',
        title: 'Account Details · Admin · MediQ',
        data: { heading: 'Account Details' },
        loadComponent: () =>
          import('./pages/admin-account-details/admin-account-details').then(
            (m) => m.AdminAccountDetails,
          ),
      },
    ],
  },
];
