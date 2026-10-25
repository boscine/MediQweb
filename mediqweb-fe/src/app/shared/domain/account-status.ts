/**
 * Whether an account can be used.
 *
 * Lives in `shared/domain` because every role area describes the same thing: an
 * Admin enables a doctor, a Secretary sees which patients can still book, and a
 * Doctor needs to know before promising a patient a follow-up. One definition
 * keeps those views from drifting apart.
 *
 * Accounts are never deleted in this app — an inactive account keeps its
 * history and can be reactivated.
 */
export type AccountStatus = 'active' | 'inactive';
