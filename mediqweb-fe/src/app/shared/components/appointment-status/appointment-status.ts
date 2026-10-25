import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { AppointmentStatus } from '../../domain/appointment-status';
import { StatusBadge, type BadgeTone } from '../status-badge/status-badge';

/**
 * Status -> badge tone, as a `Record` rather than an object literal so a new
 * status is a compile error here instead of an `undefined` tone at runtime.
 *
 * `booked` reads as information rather than a warning: not confirming an
 * appointment is a normal state, not a failure.
 */
const STATUS_TONE: Record<AppointmentStatus, BadgeTone> = {
  booked: 'info',
  confirmed: 'primary',
  completed: 'success',
  cancelled: 'neutral',
  'no-show': 'warning',
};

/**
 * One place that decides how an appointment status looks.
 *
 * Both staff areas show the same five statuses — the Secretary's appointment
 * list, the Doctor's agenda, the Doctor's history — so the tone map lives here
 * rather than being restated per area. Without it, a `no-show` would quietly be a
 * different colour depending on which area you were looking at, which is worse
 * than having no colour at all.
 *
 * Shared rather than duplicated: the two staff areas agree on the lifecycle and
 * differ only in who may act on it, so giving each its own copy of the type
 * would create exactly the drift this prevents.
 */
@Component({
  selector: 'ui-appointment-status',
  imports: [StatusBadge],
  template: `
    <ui-status-badge [tone]="tone()" [dot]="true" size="sm">{{ status() }}</ui-status-badge>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppointmentStatusBadge {
  readonly status = input.required<AppointmentStatus>();

  protected readonly tone = computed(() => STATUS_TONE[this.status()]);
}
