/** The signed-in staff member. Display only — no permissions live here. */
export interface StaffProfile {
  readonly name: string;
  /** Human label for the current role, e.g. "Doctor". */
  readonly role: string;
  readonly email?: string;
  readonly avatarUrl?: string | null;
}

export interface StaffCrumb {
  readonly label: string;
  /** The final crumb is the current page and is never a link. */
  readonly route?: string;
}
