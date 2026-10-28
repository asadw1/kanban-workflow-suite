/**
 * @file create-app-services.test.ts
 * @description Wiring tests for the service graph with a faked fetch: bootstrap restores the
 * session from the refresh endpoint, and the authenticated client refreshes on an expired token.
 */
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createAppServices } from "@/shared/services/create-app-services";
import { InMemoryTabBus } from "@/shared/testing/in-memory-tab-bus";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const authBody = (token: string) => ({
  accessToken: token,
  user: { id: "u1", email: "a@b.co", name: "Ada", avatarUrl: null },
});

function build(fetchImpl: typeof fetch) {
  return createAppServices({
    apiUrl: "http://api.test",
    coordinator: new InMemoryTabBus().createTab(),
    fetchImpl,
  });
}

describe("createAppServices", () => {
  it("restores the session through POST /auth/refresh", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json(authBody("tok-1")));
    const { session } = build(fetchImpl);
    await session.bootstrap();
    expect(session.getStatus()).toBe("authenticated");
    expect(session.getAccessToken()).toBe("tok-1");
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe("http://api.test/auth/refresh");
    expect(init).toMatchObject({ method: "POST", credentials: "include" });
  });

  it("sends the bearer token and refreshes once when it has expired", async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith("/auth/refresh")) return json(authBody("tok-2"));
      const auth = (init?.headers as Record<string, string>).authorization;
      return auth === "Bearer tok-2"
        ? json({ ok: true })
        : json({ message: "expired", code: "UNAUTHENTICATED" }, 401);
    });
    const { session, http } = build(fetchImpl);
    session.setAccessToken("tok-old");

    const result = await http.request(
      { method: "GET", path: "/thing" },
      z.object({ ok: z.boolean() }),
    );

    expect(result).toEqual({ ok: true });
    expect(calls).toEqual([
      "http://api.test/thing",
      "http://api.test/auth/refresh",
      "http://api.test/thing",
    ]);
    expect(session.getAccessToken()).toBe("tok-2");
  });

  it("keeps the auth client free of refresh-and-retry", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      json({ message: "expired", code: "UNAUTHENTICATED" }, 401),
    );
    const { authHttp } = build(fetchImpl);
    await expect(authHttp.send({ method: "POST", path: "/auth/logout" })).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("uses the browser coordinator and global fetch by default", () => {
    const services = createAppServices({ apiUrl: "http://api.test" });
    expect(services.session.getStatus()).toBe("loading");
  });
});
