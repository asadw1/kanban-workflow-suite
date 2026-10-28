/**
 * @file data-service.test.ts
 * @description Unit tests for the generic CRUD base using a fake HttpClient and two example
 * subclasses: a full CRUD top-level resource and a read-mostly nested one, proving that a
 * service exposes only the operations it supports.
 */
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { PaginationQuery } from "shared-types";
import { DataService, type ResourceScope } from "@/shared/services/data-service";
import type { HttpClient, HttpRequest } from "@/shared/services/http-client.types";

const ThingSchema = z.object({ id: z.string(), name: z.string() });
type Thing = z.infer<typeof ThingSchema>;

/** Fake transport that records requests and parses with the schema it is given. */
function fakeHttp(response: unknown) {
  const requests: HttpRequest[] = [];
  const http: HttpClient = {
    request: vi.fn(async (request, schema) => {
      requests.push(request);
      return schema.parse(response);
    }),
    send: vi.fn(async (request) => {
      requests.push(request);
    }),
  };
  return { http, requests };
}

/** Full CRUD, top-level resource. */
class ThingService extends DataService<typeof ThingSchema, Record<never, never>> {
  constructor(http: HttpClient) {
    super(http, { entitySchema: ThingSchema, collectionPath: () => "/things" });
  }
  list(query: PaginationQuery) {
    return this.listPage({}, query);
  }
  get(id: string) {
    return this.getOne({}, id);
  }
  create(input: { name: string }) {
    return this.createOne({}, input);
  }
  update(id: string, input: Partial<Thing>) {
    return this.updateOne({}, id, input);
  }
  remove(id: string) {
    return this.removeOne({}, id);
  }
}

/** Nested resource that only lists and creates. */
class ChildService extends DataService<typeof ThingSchema, { parentId: string }> {
  constructor(http: HttpClient) {
    super(http, {
      entitySchema: ThingSchema,
      collectionPath: (scope: ResourceScope) => `/parents/${scope.parentId}/children`,
    });
  }
  list(parentId: string, query: PaginationQuery) {
    return this.listPage({ parentId }, query);
  }
}

describe("DataService", () => {
  it("lists a page with cursor params and returns the API body unchanged", async () => {
    const body = { items: [{ id: "1", name: "a" }], nextCursor: "c1" };
    const { http, requests } = fakeHttp(body);
    const page = await new ThingService(http).list({ limit: 20, cursor: "c0" });
    expect(page).toEqual(body);
    expect(requests[0]).toEqual({
      method: "GET",
      path: "/things",
      query: { limit: 20, cursor: "c0" },
    });
  });

  it("gets one entity, encoding the id in the path", async () => {
    const { http, requests } = fakeHttp({ id: "a/b", name: "x" });
    await new ThingService(http).get("a/b");
    expect(requests[0]).toEqual({ method: "GET", path: "/things/a%2Fb" });
  });

  it("creates with POST and the given body", async () => {
    const { http, requests } = fakeHttp({ id: "1", name: "n" });
    const created = await new ThingService(http).create({ name: "n" });
    expect(created).toEqual({ id: "1", name: "n" });
    expect(requests[0]).toEqual({ method: "POST", path: "/things", body: { name: "n" } });
  });

  it("updates with PATCH", async () => {
    const { http, requests } = fakeHttp({ id: "1", name: "renamed" });
    await new ThingService(http).update("1", { name: "renamed" });
    expect(requests[0]).toEqual({ method: "PATCH", path: "/things/1", body: { name: "renamed" } });
  });

  it("removes with DELETE and no response body", async () => {
    const { http, requests } = fakeHttp(null);
    await expect(new ThingService(http).remove("1")).resolves.toBeUndefined();
    expect(requests[0]).toEqual({ method: "DELETE", path: "/things/1" });
  });

  it("builds nested collection paths from the scope", async () => {
    const { http, requests } = fakeHttp({ items: [], nextCursor: null });
    await new ChildService(http).list("p1", { limit: 5 });
    expect(requests[0]?.path).toBe("/parents/p1/children");
  });

  it("exposes only the operations a subclass chooses to publish", () => {
    const child = new ChildService(fakeHttp(null).http) as unknown as Record<string, unknown>;
    expect(typeof child.list).toBe("function");
    expect(child.create).toBeUndefined();
    expect(child.remove).toBeUndefined();
  });

  it("propagates transport errors untouched", async () => {
    const http: HttpClient = {
      request: vi.fn(async () => {
        throw new Error("boom");
      }),
      send: vi.fn(),
    };
    await expect(new ThingService(http).get("1")).rejects.toThrow("boom");
  });
});
