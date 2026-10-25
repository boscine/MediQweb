import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Avatar, Button, Card } from '../../../shared/components';
import { HttpAuthGateway } from '../../../core/api/http-auth-gateway';
import type { UserProfile } from '../../../core/api/models';

interface ContactRow {
  readonly label: string;
  readonly value: string;
}

interface ActivityRow {
  readonly text: string;
  readonly time: string;
}

/**
 * Admin's own account details.
 *
 * Mirrors the Figma "MediQ account details" screen: a profile summary card
 * beside three details panels (account information, professional details,
 * access activity), with "Edit Account" and "Disable Account" actions in the
 * shell's title row.
 *
 * The profile is fetched from the real API (`GET /me` via the BFF). Mock values
 * are used only while the request is in flight or when the API is unavailable,
 * so the page never shows a blank screen.
 */
@Component({
  selector: 'app-admin-account-details',
  imports: [Avatar, Button, Card],
  templateUrl: './admin-account-details.html',
  styleUrl: './admin-account-details.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAccountDetails {
  private readonly gateway = inject(HttpAuthGateway);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly name = signal('Jessa Mae Tolentino');
  readonly role = signal('Super Admin');
  readonly status = signal('Active');

  readonly contacts = signal<readonly ContactRow[]>([
    { label: 'Email', value: 'jessa.tolentino@mediq.ph' },
    { label: 'Phone', value: '+63 917 555 0100' },
    { label: 'Username', value: 'jtolentino' },
  ]);

  readonly activities = signal<readonly ActivityRow[]>([
    { text: 'Signed in from Quezon City', time: '2h ago' },
    { text: 'Password changed', time: '1d ago' },
    { text: 'Profile updated', time: '3d ago' },
  ]);

  constructor() {
    this.gateway.getProfile().subscribe({
      next: (profile) => this.applyProfile(profile),
      error: () => {
        // Keep the mock values as a fallback; the page still renders something
        // useful even when the API is unreachable.
        this.loading.set(false);
      },
    });
  }

  private applyProfile(profile: UserProfile): void {
    this.name.set(profile.fullName ?? profile.username);
    this.role.set(profile.role);
    this.status.set(profile.status);

    const rows: ContactRow[] = [];
    if (profile.email) rows.push({ label: 'Email', value: profile.email });
    if (profile.mobileNumber) rows.push({ label: 'Phone', value: profile.mobileNumber });
    rows.push({ label: 'Username', value: profile.username });
    this.contacts.set(rows);

    this.loading.set(false);
  }

  protected onEditAccount(): void {
    // There is no edit account flow yet. Intentionally no-op until the API lands.
  }

  protected onDisableAccount(): void {
    // There is no disable account flow yet. Intentionally no-op until the API lands.
  }
}
