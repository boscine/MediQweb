import type { Routes } from '@angular/router';

/**
 * Secretary area routes.
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
export const SECRETARY_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./secretary-shell').then((m) => m.SecretaryShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        title: 'Secretary Dashboard · MediQ',
        data: { heading: 'Secretary Dashboard' },
        loadComponent: () =>
          import('./pages/secretary-dashboard/secretary-dashboard').then(
            (m) => m.SecretaryDashboard,
          ),
      },
      {
        path: 'appointments',
        title: 'Appointments · Secretary · MediQ',
        data: { heading: 'Appointments' },
        loadComponent: () =>
          import('./pages/secretary-appointments/secretary-appointments').then(
            (m) => m.SecretaryAppointments,
          ),
      },
      {
        path: 'patients',
        title: 'Patients · Secretary · MediQ',
        data: { heading: 'Patients' },
        loadComponent: () =>
          import('./pages/secretary-patients/secretary-patients').then((m) => m.SecretaryPatients),
      },
      {
        path: 'patients/:id',
        title: 'Patient · Secretary · MediQ',
        data: { heading: 'Patient', headingFromPatient: true },
        loadComponent: () =>
          import('./pages/secretary-patient-details/secretary-patient-details').then(
            (m) => m.SecretaryPatientDetails,
          ),
      },
      {
        // The published week lives here and nowhere else. It used to have a
        // sibling `doctors` page listing the same one person with their booking
        // figures, which duplicated the week and added a second screen to keep in
        // step; the appointments list is where booking figures are read.
        path: 'schedules',
        title: 'Schedules · Secretary · MediQ',
        data: { heading: 'Schedules' },
        loadComponent: () =>
          import('./pages/secretary-schedules/secretary-schedules').then(
            (m) => m.SecretarySchedules,
          ),
      },
      {
        path: 'messages',
        title: 'Messages · Secretary · MediQ',
        // No `heading`, so the layout renders no `h1` and no breadcrumb: the thread
        // header already names whose conversation is open, and a heading reading
        // "Messages" above a list of people's names repeats what the page shows.
        // Declaring it absent is the honest way to say so — the layout collapses
        // that row rather than leaving its margin behind as dead space.
        //
        // `fillViewport` asks the shell for exactly one viewport of height, so the
        // page scrolls its own conversation list and message history rather than
        // the window scrolling the composer away.
        data: { fillViewport: true },
        loadComponent: () =>
          import('./pages/secretary-messages/secretary-messages').then((m) => m.SecretaryMessages),
      },
      {
        // "Appointment History", not "Visit History" as the Doctor area calls its
        // own: this record holds cancellations that never became visits. Same
        // words for different contents would be its own kind of confusion.
        path: 'history',
        title: 'Appointment History · Secretary · MediQ',
        data: { heading: 'Appointment History' },
        loadComponent: () =>
          import('./pages/secretary-history/secretary-history').then((m) => m.SecretaryHistory),
      },
      {
        path: 'profile',
        title: 'My Profile · Secretary · MediQ',
        data: { heading: 'My Profile' },
        loadComponent: () =>
          import('./pages/secretary-profile/secretary-profile').then((m) => m.SecretaryProfilePage),
      },
    ],
  },
];
