/**
 * @file browser-cross-tab-coordinator.test.ts
 * @description Tests the browser coordinator against stubbed Web Locks and BroadcastChannel
 * APIs, including the graceful fallbacks when either API is missing.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { BrowserCrossTabCoordinator } from "@/shared/services/browser-cross-tab-coordinator";

/** Minimal BroadcastChannel stand-in recording what the coordinator does with it. */
class FakeChannel {
  static instances: FakeChannel[] = [];
  listeners = new Set<(event: MessageEvent) => void>();
  postMessage = vi.fn();
  constructor(readonly name: string) {
    FakeChannel.instances.push(this);
  }
  addEventListener(_type: string, listener: (event: MessageEvent) => void) {
    this.listeners.add(listener);
  }
  removeEventListener(_type: string, listener: (event: MessageEvent) => void) {
    this.listeners.delete(listener);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  FakeChannel.instances = [];
  // @ts-expect-error cleaning up the stubbed property
  delete navigator.locks;
});

function stubLocks() {
  const request = vi.fn(async (_name: string, task: () => Promise<unknown>) => task());
  Object.defineProperty(navigator, "locks", { value: { request }, configurable: true });
  return request;
}

describe("withRefreshLock", () => {
  it("runs the task under a named Web Lock", async () => {
    const request = stubLocks();
    const result = await new BrowserCrossTabCoordinator().withRefreshLock(async () => "done");
    expect(result).toBe("done");
    expect(request).toHaveBeenCalledWith("crtwks-session-refresh", expect.any(Function));
  });

  it("runs the task directly when Web Locks are unavailable", async () => {
    const result = await new BrowserCrossTabCoordinator().withRefreshLock(async () => "direct");
    expect(result).toBe("direct");
  });
});

describe("broadcast", () => {
  it("posts messages and delivers received ones until unsubscribed", () => {
    vi.stubGlobal("BroadcastChannel", FakeChannel);
    const coordinator = new BrowserCrossTabCoordinator();
    const channel = FakeChannel.instances[0];
    expect(channel?.name).toBe("crtwks-session");

    coordinator.publish({ type: "logout" });
    expect(channel?.postMessage).toHaveBeenCalledWith({ type: "logout" });

    const handler = vi.fn();
    const unsubscribe = coordinator.subscribe(handler);
    channel?.listeners.forEach((listener) =>
      listener({ data: { type: "token", accessToken: "t" } } as MessageEvent),
    );
    expect(handler).toHaveBeenCalledWith({ type: "token", accessToken: "t" });

    unsubscribe();
    expect(channel?.listeners.size).toBe(0);
  });

  it("does nothing when BroadcastChannel is unavailable", () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    const coordinator = new BrowserCrossTabCoordinator();
    expect(() => coordinator.publish({ type: "logout" })).not.toThrow();
    const unsubscribe = coordinator.subscribe(vi.fn());
    expect(() => unsubscribe()).not.toThrow();
  });
});
