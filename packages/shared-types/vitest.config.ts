/**
 * @file vitest.config.ts
 * @description Test runner config for shared-types, including the coverage gate. Thresholds
 * are deliberately 100%: the package is pure schemas, so any uncovered line is a missing test.
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts"],
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
    },
  },
});
