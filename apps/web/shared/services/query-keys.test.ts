/**
 * @file query-keys.test.ts
 * @description Tests the key hierarchy: parent keys must prefix their children, which is what
 * makes targeted invalidation work.
 */
import { describe, expect, it } from "vitest";
import { queryKeys } from "@/shared/services/query-keys";

const page = { limit: 50 };

describe("queryKeys", () => {
  it("builds stable keys", () => {
    expect(queryKeys.auth.me).toEqual(["auth", "me"]);
    expect(queryKeys.workspaces.list(page)).toEqual(["workspaces", "list", page]);
    expect(queryKeys.workspaces.bySlug("acme")).toEqual(["workspaces", "slug", "acme"]);
  });

  it("nests every workspace key under the workspaces root", () => {
    const root = queryKeys.workspaces.all;
    for (const key of [
      queryKeys.workspaces.list(page),
      queryKeys.workspaces.bySlug("acme"),
      queryKeys.workspaces.members("w1", page),
    ]) {
      expect(key.slice(0, root.length)).toEqual(root);
    }
  });

  it("nests member pages under the per-workspace members prefix", () => {
    const prefix = queryKeys.workspaces.allMembers("w1");
    expect(queryKeys.workspaces.members("w1", page).slice(0, prefix.length)).toEqual(prefix);
  });
});
