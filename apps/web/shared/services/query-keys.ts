/**
 * @file query-keys.ts
 * @description The only place TanStack Query keys are defined. Keys are never written inline,
 * so invalidation targets (`queryKeys.workspaces.all`) and cache reads/writes cannot drift
 * apart. Keys are hierarchical: invalidating a parent key invalidates everything beneath it.
 */
import type { PaginationQuery } from "shared-types";

/** Central query-key factory. */
export const queryKeys = {
  auth: {
    /** The signed-in user's profile. */
    me: ["auth", "me"] as const,
  },
  workspaces: {
    /** Everything about workspaces; invalidate to refetch any workspace query. */
    all: ["workspaces"] as const,
    list: (query: PaginationQuery) => ["workspaces", "list", query] as const,
    bySlug: (slug: string) => ["workspaces", "slug", slug] as const,
    members: (workspaceId: string, query: PaginationQuery) =>
      ["workspaces", workspaceId, "members", query] as const,
    /** Prefix of every members query of one workspace, for invalidation after a change. */
    allMembers: (workspaceId: string) => ["workspaces", workspaceId, "members"] as const,
  },
} as const;
