/**
 * @file vitest.config.ts
 * @description Unit-test runner config for the web app. `@/` maps to the app root to match
 * tsconfig. Component tests will switch `environment` to jsdom when they are introduced.
 */
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["{shared,stores,components,app}/**/*.test.{ts,tsx}"],
  },
});
