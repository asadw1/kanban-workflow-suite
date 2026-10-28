/**
 * @file vitest.config.ts
 * @description Unit-test runner config for the web app. `@/` maps to the app root to match
 * tsconfig. Tests run in jsdom with Testing Library, and coverage is gated near 100%.
 * Generated shadcn primitives are excluded because they are third-party code we do not edit.
 */
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  // tsconfig uses `jsx: preserve` for Next, so tell esbuild to compile JSX for tests.
  esbuild: { jsx: "automatic" },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // `shared/services/env.ts` validates these at import time, so every test run needs them.
    env: {
      NEXT_PUBLIC_API_URL: "http://localhost:4000",
      NEXT_PUBLIC_SOCKET_URL: "http://localhost:4000",
    },
    include: ["{shared,stores,components,app}/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["{shared,stores,components,app}/**/*.{ts,tsx}"],
      exclude: [
        "**/*.test.{ts,tsx}",
        "components/ui/**",
        "**/*.d.ts",
        // Test support code, not product code.
        "shared/testing/**",
      ],
      thresholds: { lines: 98, functions: 98, branches: 95, statements: 98 },
    },
  },
});
