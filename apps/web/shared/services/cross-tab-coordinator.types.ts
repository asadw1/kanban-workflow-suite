/**
 * @file cross-tab-coordinator.types.ts
 * @description Contract for coordinating the session between browser tabs. Refresh tokens
 * rotate and are single use, so tabs must not refresh simultaneously; they take a shared lock
 * and broadcast the result instead. Abstracted so SessionManager is testable without a browser.
 */

/** Messages tabs exchange about the session. Tokens never leave the origin (same-origin only). */
export type SessionMessage = { type: "token"; accessToken: string } | { type: "logout" };

/** Cross-tab lock and message bus. */
export interface CrossTabCoordinator {
  /**
   * Runs `task` while holding a lock shared by every tab of this origin, so only one tab
   * refreshes at a time.
   *
   * @param task - Work to run exclusively.
   * @returns Whatever `task` returns.
   */
  withRefreshLock<T>(task: () => Promise<T>): Promise<T>;

  /**
   * Sends a message to every other tab (never to the sender).
   *
   * @param message - Session update to broadcast.
   */
  publish(message: SessionMessage): void;

  /**
   * Listens for messages from other tabs.
   *
   * @param handler - Called for each received message.
   * @returns A function that stops listening.
   */
  subscribe(handler: (message: SessionMessage) => void): () => void;
}
