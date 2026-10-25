import type { Routes } from '@angular/router';

/**
 * Doctor area routes.
 *
 * Every page is its own lazy chunk. `data.heading` is what the shell reads to
 * fill in the layout's page title and breadcrumb, so a page never configures
 * the layout itself.
 *
 * The patient details heading is a special case: it should name the patient, not
 * the word "patient", and a name cannot be known until the id is in the URL. A
 * route resolver is the usual answer, but Angular skips resolution entirely when
 * no route on the tree declares a guard, so a resolver here would silently do
 * nothing. `headingFromPatient` instead tells the shell to fill the heading in
 * from the record, which always runs and cannot be left half-wired.
 */
export const DOCTOR_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./doctor-shell').then((m) => m.DoctorShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        title: 'Doctor Dashboard · MediQ',
        data: { heading: 'Doctor Dashboard' },
        loadComponent: () =>
          import('./pages/doctor-dashboard/doctor-dashboard').then((m) => m.DoctorDashboard),
      },
      {
        path: 'appointments',
        title: 'Appointments · Doctor · MediQ',
        data: { heading: 'Appointments' },
        loadComponent: () =>
          import('./pages/doctor-appointments/doctor-appointments').then(
            (m) => m.DoctorAppointments,
          ),
      },
      {
        path: 'patients',
        title: 'Patients · Doctor · MediQ',
        data: { heading: 'Patients' },
        loadComponent: () =>
          import('./pages/doctor-patients/doctor-patients').then((m) => m.DoctorPatients),
      },
      {
        path: 'patients/:id',
        title: 'Patient · Doctor · MediQ',
        // `heading` is the fallback for an id that matches nobody; the shell
        // replaces it with the patient's name when the record resolves.
        data: { heading: 'Patient', headingFromPatient: true },
        loadComponent: () =>
          import('./pages/doctor-patient-details/doctor-patient-details').then(
            (m) => m.DoctorPatientDetails,
          ),
      },
      {
        path: 'schedule',
        title: 'Schedule · Doctor · MediQ',
        data: { heading: 'Schedule' },
        loadComponent: () =>
          import('./pages/doctor-schedule/doctor-schedule').then((m) => m.DoctorSchedule),
      },
      {
        path: 'history',
        title: 'Visit History · Doctor · MediQ',
        data: { heading: 'Visit History' },
        loadComponent: () =>
          import('./pages/doctor-history/doctor-history').then((m) => m.DoctorHistory),
      },
      {
        path: 'profile',
        title: 'My Profile · Doctor · MediQ',
        data: { heading: 'My Profile' },
        loadComponent: () =>
          import('./pages/doctor-profile/doctor-profile').then((m) => m.DoctorProfilePage),
      },
    ],
  },
];
