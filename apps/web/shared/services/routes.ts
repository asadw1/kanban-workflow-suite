/**
 * @file routes.ts
 * @description The single registry of application URLs. Components and hooks build links from
 * here and never write path strings inline, so renaming a route is a one-line change and typos
 * become type errors. Paths mirror the folder structure under `app/`.
 */
import { isSafeInternalPath } from "@/shared/utils/safe-redirect";

/** Query parameter that carries the page to return to after signing in. */
export const NEXT_PARAM = "next";

/** Percent-encodes a dynamic path segment so user data can never alter the path structure. */
const segment = (value: string): string => encodeURIComponent(value);

/** Every navigable URL in the app. Static routes are strings; dynamic routes are builders. */
export const routes = {
  home: "/",
  login: "/login",
  register: "/register",
  newWorkspace: "/workspaces/new",
  /** A workspace's landing page. */
  workspace: (slug: string): string => `/${segment(slug)}`,
  /** The workspace members settings page. */
  workspaceMembers: (slug: string): string => `/${segment(slug)}/settings/members`,
} as const;

/**
 * Builds the sign-in URL, optionally remembering where the user was heading.
 *
 * The return target is dropped when it is not a safe internal path, or is just the home page,
 * so a hostile caller cannot smuggle an external URL into the login link.
 *
 * @param returnTo - Path to come back to after signing in.
 * @returns `/login`, or `/login?next=<encoded path>`.
 */
export function loginUrl(returnTo?: string | null): string {
  if (!isSafeInternalPath(returnTo) || returnTo === routes.home) return routes.login;
  return `${routes.login}?${NEXT_PARAM}=${encodeURIComponent(returnTo)}`;
}
