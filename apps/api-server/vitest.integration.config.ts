/**
 * @file vitest.integration.config.ts
 * @description Runner config for integration tests that exercise the real app against a real
 * PostgreSQL (`DATABASE_URL`). Kept separate from the unit config so `pnpm test` stays
 * dependency-free and fast; run with `pnpm --filter api-server test:integration`.
 */
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    // One database shared by all files: run them serially to avoid cross-test interference.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
