/**
 * @file create-app-services.ts
 * @description Composition root for the browser-side services: wires the session manager and
 * the HTTP clients together. Components never build these; they receive them through context
 * (see `useServices`), which keeps the network and session swappable in tests.
 */
import { AuthResponseSchema } from "shared-types";
import { BrowserCrossTabCoordinator } from "@/shared/services/browser-cross-tab-coordinator";
import type { CrossTabCoordinator } from "@/shared/services/cross-tab-coordinator.types";
import { FetchHttpClient } from "@/shared/services/fetch-http-client";
import type { HttpClient } from "@/shared/services/http-client.types";
import { SessionManager } from "@/shared/services/session-manager";

/** Everything the UI data layer needs. */
export interface AppServices {
  session: SessionManager;
  /** Authenticated client: attaches the bearer token and refreshes it on expiry. */
  http: HttpClient;
  /**
   * Unauthenticated client for the auth endpoints (login, register, refresh, logout). It has no
   * refresh-and-retry, which is what prevents the refresh call from recursing into itself.
   */
  authHttp: HttpClient;
}

/** Inputs for {@link createAppServices}. */
export interface AppServicesConfig {
  /** API origin, for example `http://localhost:4000`. */
  apiUrl: string;
  /** Override for tests; defaults to the browser Web Locks + BroadcastChannel coordinator. */
  coordinator?: CrossTabCoordinator;
  /** Override for tests; defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
}

/**
 * Builds the service graph for one browser tab.
 *
 * @param config - API origin and optional test overrides.
 * @returns The wired services.
 * @sideEffects Subscribes the session manager to cross-tab messages.
 */
export function createAppServices(config: AppServicesConfig): AppServices {
  const authHttp = new FetchHttpClient({
    baseUrl: config.apiUrl,
    getAccessToken: () => null,
    refreshAccessToken: async () => null,
    fetchImpl: config.fetchImpl,
  });

  const session = new SessionManager({
    coordinator: config.coordinator ?? new BrowserCrossTabCoordinator(),
    refreshTransport: async () => {
      const response = await authHttp.request(
        { method: "POST", path: "/auth/refresh" },
        AuthResponseSchema,
      );
      return response.accessToken;
    },
  });

  const http = new FetchHttpClient({
    baseUrl: config.apiUrl,
    getAccessToken: () => session.getAccessToken(),
    refreshAccessToken: () => session.refresh(),
    fetchImpl: config.fetchImpl,
  });

  return { session, http, authHttp };
}
