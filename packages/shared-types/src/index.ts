/**
 * @file index.ts
 * @description Public entry point of `shared-types`: DTOs, Zod schemas and WebSocket payload
 * contracts shared by `apps/web` and `apps/api-server`. Re-export new modules from here.
 */
export * from "./errors";
export * from "./auth";
export * from "./workspace";
