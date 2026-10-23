/**
 * @file tsup.config.ts
 * @description Build config for this library package. Emits ESM plus type declarations to
 * `dist/` so both the Next.js app and the API server consume the same compiled output.
 */
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
});
