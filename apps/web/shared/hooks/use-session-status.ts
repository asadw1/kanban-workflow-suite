/**
 * @file use-session-status.ts
 * @description Subscribes a component to the session status (`loading`, `authenticated`,
 * `unauthenticated`) using React's external-store contract, so it re-renders on sign-in,
 * sign-out and cross-tab changes without copying session state into another store.
 */
"use client";

import { useSyncExternalStore } from "react";
import { useServices } from "@/shared/hooks/use-services";
import type { SessionStatus } from "@/shared/services/session-manager";

/**
 * @returns The current session status.
 * @throws Error outside `AppProviders`.
 */
export function useSessionStatus(): SessionStatus {
  const { session } = useServices();
  return useSyncExternalStore(
    (listener) => session.subscribe(listener),
    () => session.getStatus(),
    // Server render: the session lives only in the browser, so the server always sees "loading".
    () => "loading",
  );
}
