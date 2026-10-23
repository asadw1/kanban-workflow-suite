/**
 * @file vitest.config.ts
 * @description Unit-test runner config for the API server. Mirrors the `@/` alias from
 * tsconfig so tests import modules exactly as production code does.
 */
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
