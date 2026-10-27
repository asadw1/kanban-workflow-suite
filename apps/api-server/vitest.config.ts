/**
 * @file vitest.config.ts
 * @description Unit-test runner config for the API server. Mirrors the `@/` alias from
 * tsconfig so tests import modules exactly as production code does. Coverage is gated near
 * 100%; the composition root and type-only files are excluded because they hold no logic.
 */
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // index.ts only wires real infrastructure (listen, signals); everything it calls is tested.
      exclude: ["src/**/*.test.ts", "src/index.ts", "src/**/*.types.ts", "src/testing/**"],
      thresholds: { lines: 98, functions: 98, branches: 95, statements: 98 },
    },
  },
});
