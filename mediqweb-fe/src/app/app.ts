import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Toasts } from './shared/components/toast/toast';

/**
 * The application root.
 *
 * Renders the notification stack as a sibling of the outlet rather than inside any
 * page or layout. Two reasons, and the second is the one that matters: a
 * notification outlives the screen that raised it, so being mounted per page would
 * mean a confirmation vanished the moment you navigated away from the action that
 * produced it.
 *
 * `Toasts` is imported from its own file rather than from the shared barrel, and
 * deliberately is not exported from the barrel either. Every other component is
 * reached through the barrel, but the barrel is only free because its consumers
 * are all lazy routes — importing one component out of it here, from the eager
 * root, makes the whole barrel reachable from the entry point and drags the table,
 * the modals and the dropdowns into the initial chunk. Measured: 262 kB became
 * 476 kB. Page-level components keep the barrel; the root takes the direct path.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Toasts],
  templateUrl: './app.html',
})
export class App {}
