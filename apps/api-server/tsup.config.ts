/**
 * @file tsup.config.ts
 * @description Production bundle config for the API server. Emits a single ESM entry for
 * Node 20+. Workspace packages stay external and resolve through pnpm's node_modules links.
 */
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  target: "node20",
  sourcemap: true,
  clean: true,
});
