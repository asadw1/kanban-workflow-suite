/**
 * @file session-manager.ts
 * @description Holds the in-memory access token and the signed-in/out status, and is the only
 * code that refreshes the session. The access token is never written to storage, so scripts
 * cannot steal it from `localStorage`; after a reload the session is restored from the httpOnly
 * refresh cookie via {@link SessionManager.bootstrap}.
 *
 * Refresh tokens rotate and are single use, so refreshing is coordinated: one in-flight
 * refresh per tab, one tab at a time via a shared lock, and the winner broadcasts the new
 * token so other tabs reuse it instead of refreshing again.
 */
import { ApiError } from "@/shared/services/api-error";
import type {
  CrossTabCoordinator,
  SessionMessage,
} from "@/shared/services/cross-tab-coordinator.types";

/** Whether the app knows who the user is. `loading` only exists before the first bootstrap. */
export type SessionStatus = "loading" | "authenticated" | "unauthenticated";

/** Calls `POST /auth/refresh` and returns the new access token. Throws ApiError on failure. */
export type RefreshTransport = () => Promise<string>;

/** Collaborators for {@link SessionManager}. */
export interface SessionManagerOptions {
  refreshTransport: RefreshTransport;
  coordinator: CrossTabCoordinator;
  /** Injected so retry backoff is instant in tests. */
  sleep?: (ms: number) => Promise<void>;
}

/** Attempts when the server answers 409 (a duplicate refresh was just handled elsewhere). */
const MAX_DUPLICATE_RETRIES = 3;
const RETRY_DELAY_MS = 250;

/** Error code the API uses for a duplicate refresh inside its grace window. */
const REFRESH_IN_PROGRESS = "REFRESH_IN_PROGRESS";

/** The session singleton for one browser tab. Implements the `useSyncExternalStore` contract. */
export class SessionManager {
  private token: string | null = null;
  private status: SessionStatus = "loading";
  /** Bumped whenever a token arrives, so a waiter can tell someone else refreshed meanwhile. */
  private tokenVersion = 0;
  private inflight: Promise<string | null> | null = null;
  private readonly listeners = new Set<() => void>();
  private readonly sleep: (ms: number) => Promise<void>;

  /** @param options - Transport, cross-tab coordinator and optional sleep. */
  constructor(private readonly options: SessionManagerOptions) {
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    options.coordinator.subscribe((message) => this.handleMessage(message));
  }

  /** @returns The current access token, or null when signed out. */
  getAccessToken(): string | null {
    return this.token;
  }

  /** @returns The current status; stable between changes, as `useSyncExternalStore` requires. */
  getStatus(): SessionStatus {
    return this.status;
  }

  /**
   * Subscribes to status or token changes.
   *
   * @param listener - Called after every change.
   * @returns Unsubscribe function.
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Adopts a freshly issued token (after login or register) and tells other tabs.
   *
   * @param accessToken - Token from the API.
   */
  setAccessToken(accessToken: string): void {
    this.adopt(accessToken);
    this.options.coordinator.publish({ type: "token", accessToken });
  }

  /** Signs out locally and in every other tab (after logout or a dead refresh token). */
  clear(): void {
    this.markSignedOut();
    this.options.coordinator.publish({ type: "logout" });
  }

  /**
   * Restores the session on page load from the refresh cookie.
   *
   * @returns Resolves once the status is `authenticated` or `unauthenticated`. Never rejects:
   * a failed bootstrap (including network errors) just leaves the user signed out.
   */
  async bootstrap(): Promise<void> {
    try {
      await this.refresh();
    } catch {
      // Cannot verify the session (offline, server down): treat as signed out locally, but do
      // not broadcast a logout, because other tabs may still hold a valid token.
      this.markSignedOut();
    }
  }

  /**
   * Obtains a fresh access token, coordinating with other tabs.
   *
   * @returns The new token, or null when the session no longer exists (the user is signed out).
   * @throws ApiError on transient failures such as network errors, which must not sign the
   * user out.
   */
  refresh(): Promise<string | null> {
    this.inflight ??= this.coordinatedRefresh().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  private async coordinatedRefresh(): Promise<string | null> {
    const versionBeforeWaiting = this.tokenVersion;
    return this.options.coordinator.withRefreshLock(async () => {
      // Another tab may have refreshed (and broadcast) while we waited for the lock.
      if (this.token && this.tokenVersion !== versionBeforeWaiting) return this.token;
      return this.refreshFromServer();
    });
  }

  private async refreshFromServer(): Promise<string | null> {
    for (let attempt = 1; ; attempt++) {
      try {
        const token = await this.options.refreshTransport();
        this.setAccessToken(token);
        return token;
      } catch (error) {
        if (error instanceof ApiError && error.code === REFRESH_IN_PROGRESS) {
          if (attempt >= MAX_DUPLICATE_RETRIES) throw error;
          // The winning request already rotated the cookie; wait briefly, then use it.
          await this.sleep(RETRY_DELAY_MS * attempt);
          continue;
        }
        if (error instanceof ApiError && error.status === 401) {
          this.clear();
          return null;
        }
        throw error;
      }
    }
  }

  private handleMessage(message: SessionMessage): void {
    if (message.type === "token") this.adopt(message.accessToken);
    else this.markSignedOut();
  }

  private adopt(accessToken: string): void {
    this.token = accessToken;
    this.status = "authenticated";
    this.tokenVersion += 1;
    this.notify();
  }

  private markSignedOut(): void {
    this.token = null;
    this.status = "unauthenticated";
    this.notify();
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }
}
