/**
 * @file session-manager.test.ts
 * @description Unit tests for the session store: bootstrap, single-flight refresh, duplicate
 * (409) retries, sign-out propagation and, above all, several tabs refreshing at once.
 */
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/shared/services/api-error";
import { SessionManager, type RefreshTransport } from "@/shared/services/session-manager";
import { InMemoryTabBus } from "@/shared/testing/in-memory-tab-bus";

const noSleep = async () => undefined;
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function makeTab(bus: InMemoryTabBus, transport: RefreshTransport) {
  return new SessionManager({
    refreshTransport: transport,
    coordinator: bus.createTab(),
    sleep: noSleep,
  });
}

describe("bootstrap", () => {
  it("starts loading, then restores the session from the refresh cookie", async () => {
    const transport = vi.fn(async () => "tok-1");
    const session = makeTab(new InMemoryTabBus(), transport);
    expect(session.getStatus()).toBe("loading");
    await session.bootstrap();
    expect(session.getStatus()).toBe("authenticated");
    expect(session.getAccessToken()).toBe("tok-1");
  });

  it("ends signed out and tells other tabs when the refresh token is dead", async () => {
    const bus = new InMemoryTabBus();
    const other = makeTab(bus, async () => "unused");
    other.setAccessToken("other-tok");
    const session = makeTab(bus, async () => {
      throw new ApiError(401, "INVALID_REFRESH_TOKEN", "dead");
    });
    await session.bootstrap();
    await flush();
    expect(session.getStatus()).toBe("unauthenticated");
    expect(other.getStatus()).toBe("unauthenticated");
  });

  it("ends signed out locally, without a logout broadcast, on a network error", async () => {
    const bus = new InMemoryTabBus();
    // The other tab signs in first, before this tab exists, so this tab never hears of it.
    const other = makeTab(bus, async () => "unused");
    other.setAccessToken("other-tok");
    const session = makeTab(bus, async () => {
      throw new ApiError(0, "NETWORK_ERROR", "offline");
    });
    await session.bootstrap();
    await flush();
    expect(session.getStatus()).toBe("unauthenticated");
    // The other tab may still hold a valid session, so it must not be signed out.
    expect(other.getStatus()).toBe("authenticated");
  });
});

describe("refresh", () => {
  it("shares one request between concurrent callers in a tab", async () => {
    const transport = vi.fn(async () => "tok-1");
    const session = makeTab(new InMemoryTabBus(), transport);
    const [a, b] = await Promise.all([session.refresh(), session.refresh()]);
    expect(a).toBe("tok-1");
    expect(b).toBe("tok-1");
    expect(transport).toHaveBeenCalledOnce();
  });

  it("can refresh again after the previous refresh settled", async () => {
    let n = 0;
    const transport = vi.fn(async () => `tok-${++n}`);
    const session = makeTab(new InMemoryTabBus(), transport);
    await session.refresh();
    expect(await session.refresh()).toBe("tok-2");
  });

  it("lets only one of several simultaneous tabs hit the server", async () => {
    const bus = new InMemoryTabBus();
    const transport = vi.fn(async () => {
      await flush();
      return "shared-tok";
    });
    const tabs = [makeTab(bus, transport), makeTab(bus, transport), makeTab(bus, transport)];
    await Promise.all(tabs.map((tab) => tab.bootstrap()));
    await flush();
    expect(transport).toHaveBeenCalledOnce();
    for (const tab of tabs) {
      expect(tab.getStatus()).toBe("authenticated");
      expect(tab.getAccessToken()).toBe("shared-tok");
    }
  });

  it("retries a duplicate-refresh 409 and then succeeds", async () => {
    const transport = vi
      .fn<RefreshTransport>()
      .mockRejectedValueOnce(new ApiError(409, "REFRESH_IN_PROGRESS", "retry"))
      .mockResolvedValueOnce("tok-after-retry");
    const session = makeTab(new InMemoryTabBus(), transport);
    expect(await session.refresh()).toBe("tok-after-retry");
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it("gives up after repeated 409s without signing the user out", async () => {
    const transport = vi.fn<RefreshTransport>(async () => {
      throw new ApiError(409, "REFRESH_IN_PROGRESS", "retry");
    });
    const session = makeTab(new InMemoryTabBus(), transport);
    session.setAccessToken("existing");
    await expect(session.refresh()).rejects.toMatchObject({ code: "REFRESH_IN_PROGRESS" });
    expect(transport).toHaveBeenCalledTimes(3);
    expect(session.getStatus()).toBe("authenticated");
  });

  it("rethrows other failures and keeps the session", async () => {
    const session = makeTab(new InMemoryTabBus(), async () => {
      throw new ApiError(500, "INTERNAL_ERROR", "boom");
    });
    session.setAccessToken("existing");
    await expect(session.refresh()).rejects.toMatchObject({ status: 500 });
    expect(session.getStatus()).toBe("authenticated");
  });

  it("returns null and signs out when the refresh token is rejected", async () => {
    const session = makeTab(new InMemoryTabBus(), async () => {
      throw new ApiError(401, "INVALID_REFRESH_TOKEN", "dead");
    });
    session.setAccessToken("existing");
    expect(await session.refresh()).toBeNull();
    expect(session.getStatus()).toBe("unauthenticated");
    expect(session.getAccessToken()).toBeNull();
  });

  it("uses a real timer for backoff by default", async () => {
    vi.useFakeTimers();
    try {
      const transport = vi
        .fn<RefreshTransport>()
        .mockRejectedValueOnce(new ApiError(409, "REFRESH_IN_PROGRESS", "retry"))
        .mockResolvedValueOnce("tok");
      const session = new SessionManager({
        refreshTransport: transport,
        coordinator: new InMemoryTabBus().createTab(),
      });
      const pending = session.refresh();
      await vi.advanceTimersByTimeAsync(300);
      expect(await pending).toBe("tok");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("tab messaging and subscriptions", () => {
  it("shares a new token and a logout with other tabs", async () => {
    const bus = new InMemoryTabBus();
    const a = makeTab(bus, async () => "unused");
    const b = makeTab(bus, async () => "unused");
    a.setAccessToken("login-token");
    await flush();
    expect(b.getAccessToken()).toBe("login-token");
    expect(b.getStatus()).toBe("authenticated");
    a.clear();
    await flush();
    expect(b.getStatus()).toBe("unauthenticated");
    expect(b.getAccessToken()).toBeNull();
  });

  it("notifies subscribers until they unsubscribe", () => {
    const session = makeTab(new InMemoryTabBus(), async () => "unused");
    const listener = vi.fn();
    const unsubscribe = session.subscribe(listener);
    session.setAccessToken("t");
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
    session.clear();
    expect(listener).toHaveBeenCalledOnce();
  });
});
