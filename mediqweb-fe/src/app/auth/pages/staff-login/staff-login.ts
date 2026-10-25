import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  Brand,
  Button,
  FormField,
  SampleAccounts,
  type SampleAccount,
} from '../../../shared/components';
import { ForgotPassword } from '../../components/forgot-password/forgot-password';
import { HttpAuthGateway } from '../../../core/api/http-auth-gateway';
import { emailOrUsername } from './staff-login.validators';

/**
 * Staff sign-in for Admin, Doctor and Secretary.
 *
 * There is deliberately no registration path: staff accounts are created by an
 * Admin, so the only way in is an existing account. The "forgot password"
 * route therefore explains who to contact instead of pretending to email a
 * reset link.
 *
 * UI only. The page talks to the `AuthGateway` contract, never to HTTP.
 */
@Component({
  selector: 'app-staff-login',
  imports: [ReactiveFormsModule, Brand, Button, FormField, ForgotPassword, SampleAccounts],
  templateUrl: './staff-login.html',
  styleUrl: './staff-login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StaffLogin {
  private readonly fb = inject(FormBuilder);
  private readonly gateway = inject(HttpAuthGateway);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly authError = signal<string | null>(null);
  protected readonly passwordVisible = signal(false);
  protected readonly forgotPasswordOpen = signal(false);

  /**
   * No sample accounts are printed: credentials come from the real auth
   * service, not from fixtures.
   */
  protected readonly sampleAccounts: readonly SampleAccount[] = [];

  protected readonly form = this.fb.nonNullable.group({
    identifier: ['', [Validators.required, emailOrUsername]],
    // No length or format rules: the account was created by an Admin, and
    // second-guessing the rules at sign-in only ever blocks valid users.
    password: ['', [Validators.required]],
  });

  /** Cleared as soon as the user edits the field, so a stale error lingers no longer than the submit that raised it. */
  protected identifierError(): string | null {
    const control = this.form.controls.identifier;
    if (!control.touched) return null;
    if (control.hasError('required')) return 'Enter your email or username.';
    if (control.hasError('emailOrUsername')) return 'Enter a valid email address or username.';
    return null;
  }

  protected passwordError(): string | null {
    const control = this.form.controls.password;
    if (!control.touched) return null;
    if (control.hasError('required')) return 'Enter your password.';
    return null;
  }

  protected togglePasswordVisibility(): void {
    this.passwordVisible.update((visible) => !visible);
  }

  protected closeForgotPassword(): void {
    this.forgotPasswordOpen.set(false);
  }

  protected async onSubmit(): Promise<void> {
    this.authError.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    try {
      const session = await firstValueFrom(
        this.gateway.signIn(
          this.form.value.identifier!,
          this.form.value.password!,
        ),
      );
      // Local routes only expose `/doctor` for now; admin/secretary areas
      // don't have routes yet, so every successful sign-in lands there.
      await this.router.navigate(['/doctor']);
    } catch (error) {
      this.authError.set(
        error instanceof Error ? error.message : 'We could not sign you in. Please try again.',
      );
    } finally {
      this.loading.set(false);
    }
  }
}
