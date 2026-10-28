/**
 * @file data-service.ts
 * @description Abstract base for resource services: the generic CRUD plumbing shared by every
 * API resource (paginated list, get, create, update, delete). Concrete services extend it,
 * supply the resource path and Zod schemas, and expose only the operations their endpoint
 * supports, so a service never has to implement a method that throws "not supported"
 * (Liskov / Interface Segregation).
 *
 * The base validates responses with the shared-types schemas and returns them untouched: the
 * API owns the data contract, and nothing here renames, merges or derives fields.
 */
import type { z } from "zod";
import { pageSchema, type Page, type PaginationQuery } from "shared-types";
import type { HttpClient } from "@/shared/services/http-client.types";

/**
 * Path parameters of a nested resource, for example `{ workspaceId }` for
 * `/workspaces/:workspaceId/members`. Top-level resources use `Record<never, never>`.
 */
export type ResourceScope = Record<string, string>;

/** Static description of a resource. */
export interface ResourceDefinition<E extends z.ZodTypeAny, S extends ResourceScope> {
  /** Schema of one entity as the API returns it. */
  entitySchema: E;
  /** Builds the collection path (no trailing slash) for a scope, for example `/workspaces`. */
  collectionPath: (scope: S) => string;
}

/**
 * Generic CRUD operations over one resource.
 *
 * @typeParam E - Zod schema of the entity.
 * @typeParam S - Path parameters identifying the collection (empty for top-level resources).
 */
export abstract class DataService<E extends z.ZodTypeAny, S extends ResourceScope> {
  private readonly pageSchema: ReturnType<typeof pageSchema<E>>;

  /**
   * @param http - Injected transport; the only way this class reaches the network.
   * @param definition - The resource path and entity schema.
   */
  protected constructor(
    protected readonly http: HttpClient,
    private readonly definition: ResourceDefinition<E, S>,
  ) {
    this.pageSchema = pageSchema(definition.entitySchema);
  }

  /**
   * Fetches one page of the collection.
   *
   * @param scope - Path parameters of the collection.
   * @param query - Cursor pagination parameters.
   * @returns `{ items, nextCursor }` exactly as the API sent them.
   * @throws ApiError on HTTP, network or contract failures.
   */
  protected listPage(scope: S, query: PaginationQuery): Promise<Page<z.output<E>>> {
    return this.http.request(
      {
        method: "GET",
        path: this.definition.collectionPath(scope),
        query: { limit: query.limit, cursor: query.cursor },
      },
      this.pageSchema,
    );
  }

  /**
   * Fetches one entity.
   *
   * @param scope - Path parameters of the collection.
   * @param id - Entity id.
   * @returns The entity.
   * @throws ApiError, for example 404 `NOT_FOUND`.
   */
  protected getOne(scope: S, id: string): Promise<z.output<E>> {
    return this.http.request(
      { method: "GET", path: this.itemPath(scope, id) },
      this.definition.entitySchema,
    );
  }

  /**
   * Creates an entity.
   *
   * @param scope - Path parameters of the collection.
   * @param input - Request body; validated by the caller form with the shared request schema.
   * @returns The created entity.
   * @throws ApiError, for example 409 on a uniqueness conflict.
   */
  protected createOne(scope: S, input: unknown): Promise<z.output<E>> {
    return this.http.request(
      { method: "POST", path: this.definition.collectionPath(scope), body: input },
      this.definition.entitySchema,
    );
  }

  /**
   * Partially updates an entity (HTTP PATCH).
   *
   * @param scope - Path parameters of the collection.
   * @param id - Entity id.
   * @param input - Fields to change.
   * @returns The updated entity.
   * @throws ApiError.
   */
  protected updateOne(scope: S, id: string, input: unknown): Promise<z.output<E>> {
    return this.http.request(
      { method: "PATCH", path: this.itemPath(scope, id), body: input },
      this.definition.entitySchema,
    );
  }

  /**
   * Deletes an entity.
   *
   * @param scope - Path parameters of the collection.
   * @param id - Entity id.
   * @returns Resolves when the API confirms deletion.
   * @throws ApiError.
   */
  protected removeOne(scope: S, id: string): Promise<void> {
    return this.http.send({ method: "DELETE", path: this.itemPath(scope, id) });
  }

  /** `<collection>/<id>`, with the id URL-encoded so it can never alter the path. */
  private itemPath(scope: S, id: string): string {
    return `${this.definition.collectionPath(scope)}/${encodeURIComponent(id)}`;
  }
}
