import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * States plainly that the surrounding area is showing sample data.
 *
 * Every area is currently backed by an in-memory mock session. Without this
 * notice a screenshot of the app is indistinguishable from a working product,
 * which is exactly the impression to avoid while there is no API behind it.
 *
 * `area` lets each area name itself without the text drifting between areas.
 */
@Component({
  selector: 'ui-mock-notice',
  templateUrl: './mock-notice.html',
  styleUrl: './mock-notice.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MockNotice {
  /** The area the notice refers to, e.g. "The Doctor area". */
  readonly area = input('This area');
}
