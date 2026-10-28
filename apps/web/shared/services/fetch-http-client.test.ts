/**
 * @file fetch-http-client.test.ts
 * @description Unit tests for the fetch-based HttpClient: request shaping, schema validation,
 * error normalisation and the single refresh-and-retry on an expired access token.
 */
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ApiError } from "@/shared/services/api-error";
import { FetchHttpClient } from "@/shared/services/fetch-http-client";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const unauthenticated = () => json({ message: "expired", code: "UNAUTHENTICATED" }, 401);

function setup(options: { token?: string | null; refreshed?: string | null } = {}) {
  let token = options.token === undefined ? "tok-1" : options.token;
  const fetchImpl = vi.fn<typeof fetch>();
  const refreshAccessToken = vi.fn(async () => {
    token = options.refreshed === undefined ? "tok-2" : options.refreshed;
    return token;
  });
  const client = new FetchHttpClient({
    baseUrl: "http://api.test",
    getAccessToken: () => token,
    refreshAccessToken,
    fetchImpl,
  });
  return { client, fetchImpl, refreshAccessToken };
}

const Schema = z.object({ id: z.string() });

describe("FetchHttpClient.request", () => {
  it("sends credentials, the bearer token and query params, and returns the parsed body", async () => {
    const { client, fetchImpl } = setup();
    fetchImpl.mockResolvedValue(json({ id: "a" }));
    const result = await client.request(
      { method: "GET", path: "/things", query: { limit: 10, cursor: undefined, q: "x" } },
      Schema,
    );
    expect(result).toEqual({ id: "a" });
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe("http://api.test/things?limit=10&q=x");
    expect(init).toMatchObject({ method: "GET", credentials: "include" });
    expect(init?.headers).toMatchObject({ authorization: "Bearer tok-1" });
    expect(init?.body).toBeUndefined();
  });

  it("serialises a JSON body and omits auth when signed out", async () => {
    const { client, fetchImpl } = setup({ token: null });
    fetchImpl.mockResolvedValue(json({ id: "a" }, 201));
    await client.request({ method: "POST", path: "/things", body: { name: "n" } }, Schema);
    const init = fetchImpl.mock.calls[0]?.[1];
    expect(init?.body).toBe('{"name":"n"}');
    expect(init?.headers).toMatchObject({ "content-type": "application/json" });
    expect(init?.headers).not.toHaveProperty("authorization");
  });

  it("fails loudly when the body violates the schema", async () => {
    const { client, fetchImpl } = setup();
    fetchImpl.mockResolvedValue(json({ id: 5 }));
    await expect(client.request({ method: "GET", path: "/x" }, Schema)).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
      status: 200,
    });
  });

  it("normalises the API error contract", async () => {
    const { client, fetchImpl } = setup();
    fetchImpl.mockResolvedValue(
      json({ message: "No.", code: "FORBIDDEN", details: { required: "ADMIN" } }, 403),
    );
    const error = await client.request({ method: "GET", path: "/x" }, Schema).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 403,
      code: "FORBIDDEN",
      message: "No.",
      details: { required: "ADMIN" },
    });
  });

  it("falls back to a generic error for non-contract bodies", async () => {
    const { client, fetchImpl } = setup();
    fetchImpl.mockResolvedValue(new Response("<html>oops</html>", { status: 502 }));
    await expect(client.request({ method: "GET", path: "/x" }, Schema)).rejects.toMatchObject({
      status: 502,
      code: "UNKNOWN_ERROR",
    });
  });

  it("maps transport failures to NETWORK_ERROR", async () => {
    const { client, fetchImpl } = setup();
    fetchImpl.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(client.request({ method: "GET", path: "/x" }, Schema)).rejects.toMatchObject({
      status: 0,
      code: "NETWORK_ERROR",
    });
  });
});

describe("token refresh", () => {
  it("refreshes once on UNAUTHENTICATED and retries with the new token", async () => {
    const { client, fetchImpl, refreshAccessToken } = setup();
    fetchImpl.mockResolvedValueOnce(unauthenticated()).mockResolvedValueOnce(json({ id: "a" }));
    const result = await client.request({ method: "GET", path: "/x" }, Schema);
    expect(result).toEqual({ id: "a" });
    expect(refreshAccessToken).toHaveBeenCalledOnce();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[1]?.[1]?.headers).toMatchObject({ authorization: "Bearer tok-2" });
  });

  it("does not loop when the retry is also unauthenticated", async () => {
    const { client, fetchImpl, refreshAccessToken } = setup();
    fetchImpl.mockImplementation(async () => unauthenticated());
    await expect(client.request({ method: "GET", path: "/x" }, Schema)).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
    expect(refreshAccessToken).toHaveBeenCalledOnce();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("surfaces the original error when the session is gone", async () => {
    const { client, fetchImpl } = setup({ refreshed: null });
    fetchImpl.mockImplementation(async () => unauthenticated());
    await expect(client.request({ method: "GET", path: "/x" }, Schema)).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHENTICATED",
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("does not refresh for other errors such as FORBIDDEN", async () => {
    const { client, fetchImpl, refreshAccessToken } = setup();
    fetchImpl.mockResolvedValue(json({ message: "no", code: "FORBIDDEN" }, 403));
    await expect(client.request({ method: "GET", path: "/x" }, Schema)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });
});

describe("FetchHttpClient.send", () => {
  it("resolves on a bodyless success", async () => {
    const { client, fetchImpl } = setup();
    fetchImpl.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(client.send({ method: "POST", path: "/auth/logout" })).resolves.toBeUndefined();
  });

  it("throws the normalised error on failure", async () => {
    const { client, fetchImpl } = setup();
    fetchImpl.mockResolvedValue(json({ message: "gone", code: "NOT_FOUND" }, 404));
    await expect(client.send({ method: "DELETE", path: "/x" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("default fetch", () => {
  it("falls back to the global fetch", async () => {
    const globalFetch = vi.fn<typeof fetch>().mockResolvedValue(json({ id: "g" }));
    vi.stubGlobal("fetch", globalFetch);
    try {
      const client = new FetchHttpClient({
        baseUrl: "http://api.test",
        getAccessToken: () => null,
        refreshAccessToken: async () => null,
      });
      await expect(client.request({ method: "GET", path: "/x" }, Schema)).resolves.toEqual({
        id: "g",
      });
      expect(globalFetch).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
