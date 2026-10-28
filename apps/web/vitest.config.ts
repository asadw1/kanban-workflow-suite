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
    // `shared/services/env.ts` validates these at import time, so every test run needs them.
    env: {
      NEXT_PUBLIC_API_URL: "http://localhost:4000",
      NEXT_PUBLIC_SOCKET_URL: "http://localhost:4000",
    },
    include: ["{shared,stores,components,app}/**/*.test.{ts,tsx}"],
  },
});
