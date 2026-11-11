/**
 * @file safe-redirect.ts
 * @description Validation for user-influenced redirect targets (the `?next=` parameter). Security
 * invariant: only same-origin, app-internal paths may ever be navigated to after sign-in, so a
 * crafted login link can never bounce a user to an attacker's site (open redirect).
 */

/** Origin used only to resolve and compare candidates; never navigated to. */
const PROBE_ORIGIN = "http://app.invalid";

/**
 * Decides whether a candidate is an internal path that is safe to redirect to.
 *
 * Rejected: non-strings, anything not starting with a single `/` (so absolute URLs, `//host`
 * protocol-relative URLs and `javascript:` all fail), backslashes (some browsers treat `/\host`
 * like `//host`), control characters, and anything that resolves to a different origin.
 *
 * @param candidate - Untrusted value, usually from a query parameter.
 * @returns True when `candidate` is a safe internal path.
 */
export function isSafeInternalPath(candidate: unknown): candidate is string {
  if (typeof candidate !== "string") return false;
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return false;
  // eslint-disable-next-line no-control-regex -- deliberately rejecting control characters.
  if (candidate.includes("\\") || /[\u0000-\u001f\u007f]/.test(candidate)) return false;
  try {
    return new URL(candidate, PROBE_ORIGIN).origin === PROBE_ORIGIN;
  } catch {
    // Defensive: `new URL` can throw on malformed input that passed the checks above.
    return false;
  }
}

/**
 * Returns the candidate when it is a safe internal path, otherwise the fallback.
 *
 * @param candidate - Untrusted redirect target.
 * @param fallback - Trusted path used when the candidate is unsafe or missing.
 * @returns A path that is safe to navigate to.
 */
export function sanitizeNextPath(candidate: unknown, fallback: string): string {
  return isSafeInternalPath(candidate) ? candidate : fallback;
}
