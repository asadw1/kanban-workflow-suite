/**
 * @file browser-cross-tab-coordinator.ts
 * @description Browser implementation of {@link CrossTabCoordinator} using the Web Locks API
 * for mutual exclusion and a `BroadcastChannel` for messages. Both degrade gracefully: without
 * Web Locks the task simply runs (the server-side grace window still protects the session),
 * and without BroadcastChannel tabs just do not share updates.
 */
import type {
  CrossTabCoordinator,
  SessionMessage,
} from "@/shared/services/cross-tab-coordinator.types";

const LOCK_NAME = "crtwks-session-refresh";
const CHANNEL_NAME = "crtwks-session";

/** Coordinates tabs through `navigator.locks` and `BroadcastChannel`. */
export class BrowserCrossTabCoordinator implements CrossTabCoordinator {
  private readonly channel: BroadcastChannel | null =
    typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CHANNEL_NAME);

  /** @inheritdoc */
  withRefreshLock<T>(task: () => Promise<T>): Promise<T> {
    const locks = typeof navigator === "undefined" ? undefined : navigator.locks;
    return locks ? (locks.request(LOCK_NAME, task) as Promise<T>) : task();
  }

  /** @inheritdoc */
  publish(message: SessionMessage): void {
    this.channel?.postMessage(message);
  }

  /** @inheritdoc */
  subscribe(handler: (message: SessionMessage) => void): () => void {
    if (!this.channel) return () => undefined;
    const listener = (event: MessageEvent<SessionMessage>) => handler(event.data);
    this.channel.addEventListener("message", listener);
    return () => this.channel?.removeEventListener("message", listener);
  }
}
