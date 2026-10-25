/** Icons the nav knows how to draw. Extend by adding a path to the icon map. */
export type StaffNavIcon =
  | 'dashboard'
  | 'users'
  | 'calendar'
  | 'folder'
  | 'clipboard'
  | 'settings'
  | 'logout'
  | 'stethoscope'
  | 'messages'
  | 'history';

export interface StaffNavItem {
  readonly id: string;
  readonly label: string;
  readonly icon?: StaffNavIcon;
  /**
   * When set the item renders as a router link and highlights itself via
   * `routerLinkActive`. When absent it renders as a button and emits
   * `itemSelected`, which lets a shell work before its routes exist.
   */
  readonly route?: string;
  /** Match the route exactly rather than by prefix. Defaults to true. */
  readonly exactMatch?: boolean;
  /** Trailing count, e.g. patients waiting. */
  readonly badge?: string | number;
  readonly disabled?: boolean;
  /** Draw a separator above this item. */
  readonly dividerBefore?: boolean;
}

export interface StaffNavGroup {
  readonly id: string;
  /** Optional section heading above the items. */
  readonly label?: string;
  readonly items: readonly StaffNavItem[];
}

/** A flat list of items, for the common case of a single unlabelled section. */
export type StaffNavEntry = StaffNavGroup | StaffNavItem;
