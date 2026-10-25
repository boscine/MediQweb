import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** One sample sign-in, printed so a reviewer can get in without reading source. */
export interface SampleAccount {
  readonly identifier: string;
  readonly password: string;
  /** Which workspace the sign-in reaches, so it is obvious before typing. */
  readonly role: string;
}

/**
 * Lets the sign-in screen be walked before any authentication exists.
 *
 * Printing the sample credentials is the whole reason a hardcoded password is
 * defensible while there is no API: a credential nobody can discover is worse
 * than none, and an unlabelled one is indistinguishable from a real account. The
 * component's job is to make that honest — it says what these are and that they
 * are temporary, so nobody mistakes the list for a feature that ships.
 *
 * Shared rather than part of the login page's own stylesheet, which is the
 * largest component stylesheet in the app and already at its style budget. If
 * more scaffolding surfaces later, its styling belongs here with it.
 *
 * **Delete this component and `MOCK_STAFF_ACCOUNTS` together** when the real
 * authentication lands; there is nothing left for it to say.
 */
@Component({
  selector: 'ui-sample-accounts',
  templateUrl: './sample-accounts.html',
  styleUrl: './sample-accounts.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SampleAccounts {
  readonly accounts = input.required<readonly SampleAccount[]>();

  /**
   * Ties the section to its heading so screen readers announce the region.
   *
   * Counted rather than hardcoded: a fixed id would be fine while only the login
   * page renders this, and silently wrong the first time a second one appears.
   */
  protected readonly headingId = `sample-accounts-${nextId()}`;
}

let sampleAccountCount = 0;

function nextId(): number {
  sampleAccountCount += 1;
  return sampleAccountCount;
}
