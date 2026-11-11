/**
 * @file navigator.types.ts
 * @description The navigation abstraction components depend on. It hides the Next.js router
 * behind a small interface (Dependency Inversion), so components and tests never import
 * `next/navigation` and the router can be swapped or faked.
 */

/** Programmatic navigation plus the current location. */
export interface AppNavigator {
  /** Current URL pathname, for example `/acme/boards`. Used for active-link styling. */
  readonly pathname: string;
  /** Navigates to `path`, adding a history entry. Pass paths from `routes`, never raw strings. */
  push(path: string): void;
  /** Navigates to `path` replacing the current history entry (use for redirects). */
  replace(path: string): void;
  /** Goes back one history entry. */
  back(): void;
}
