/**
 * @file pagination.ts
 * @description Cursor pagination contract for list endpoints. Every list is bounded: the
 * server clamps `limit` and never returns an unbounded result set. Cursors are opaque row ids
 * so deep pages cost the same as the first (no OFFSET scans).
 */
import { z } from "zod";

/** Largest page a client may request. */
export const MAX_PAGE_SIZE = 100;

/** Page size used when the client does not specify one. */
export const DEFAULT_PAGE_SIZE = 50;

/** Query-string parameters accepted by every paginated endpoint. */
export const PaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  cursor: z.string().min(1).max(64).optional(),
});

/** Pagination query, inferred from {@link PaginationQuerySchema}. */
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

/**
 * Builds the response schema for a page of items.
 *
 * @param item - Schema of a single item.
 * @returns Schema of `{ items, nextCursor }`, where `nextCursor` is null on the last page.
 */
export function pageSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  });
}

/** A page of results. */
export interface Page<T> {
  items: T[];
  /** Pass as `cursor` to fetch the next page; null when there are no more results. */
  nextCursor: string | null;
}
