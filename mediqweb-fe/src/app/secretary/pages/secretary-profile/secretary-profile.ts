import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button, Card, DetailList, FormField, MockNotice } from '../../../shared/components';
import { SecretarySession } from '../../secretary-session';
import { ToastService } from '../../../core/services/toast.service';

/**
 * The Secretary's own profile.
 *
 * Three editable fields and nothing else. A Secretary's role, and the clinic they
 * belong to, are not theirs to set, so there is nothing to disable — the fields
 * simply are not on the page.
 *
 * Saving writes to the mock store, which the header reads, so the name in the top
 * right updates. Nothing is persisted, and the notification says so rather than
 * claiming the change was saved.
 */
@Component({
  selector: 'app-secretary-profile',
  imports: [DatePipe, ReactiveFormsModule, Button, Card, FormField, MockNotice, DetailList],
  templateUrl: './secretary-profile.html',
  styleUrl: './secretary-profile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecretaryProfilePage {
  private readonly session = inject(SecretarySession);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly toasts = inject(ToastService);

  protected readonly profile = this.session.profile;

  /** How many patients the desk looks after, for the summary beside the form. */
  protected readonly patientCount = computed(() => this.session.patients().length);

  /** How many doctors the desk books for. */
  protected readonly doctorCount = computed(() => this.session.activeDoctorCount());

  protected readonly form = this.fb.group({
    name: this.fb.control('', [Validators.required, Validators.minLength(2)]),
    email: this.fb.control('', [Validators.required, Validators.email]),
    phone: this.fb.control('', [Validators.required]),
  });

  constructor() {
    this.resetForm();
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      // A warning: nothing was attempted, the form was incomplete. The field
      // messages below name which fields.
      this.toasts.warning('Nothing saved', 'Fix the highlighted fields, then save again.');
      return;
    }

    this.session.updateProfile(this.form.getRawValue());
    // Names what happened and what it did not do. "Saved" alone would imply the
    // change survives a reload, and it does not while this is a fixture store.
    this.toasts.success(
      'Profile updated',
      'Held in this session only — reload the page and the old details return.',
    );
  }

  protected resetForm(): void {
    const { name, email, phone } = this.session.profile();
    this.form.setValue({ name, email, phone });
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  protected nameError(): string | null {
    const control = this.form.controls.name;
    if (!control.touched) return null;
    if (control.hasError('required')) return 'Enter the name colleagues should see.';
    if (control.hasError('minlength')) return 'Use at least 2 characters.';
    return null;
  }

  protected emailError(): string | null {
    const control = this.form.controls.email;
    if (!control.touched) return null;
    if (control.hasError('required')) return 'Enter an email address.';
    if (control.hasError('email')) return 'Enter a valid email address, e.g. name@clinic.ph';
    return null;
  }

  protected phoneError(): string | null {
    const control = this.form.controls.phone;
    return control.touched && control.hasError('required') ? 'Enter a contact number.' : null;
  }
}
