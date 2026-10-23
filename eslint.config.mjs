/**
 * @file eslint.config.mjs
 * @description Single flat ESLint config shared by every workspace in the monorepo.
 *
 * Each workspace runs `eslint .` from its own directory; ESLint resolves this file by
 * walking up from the working directory, so one config keeps rules identical across
 * `apps/*` and `packages/*` (Open/Closed: new workspaces inherit it with no edits).
 *
 * Type-aware rules (`recommendedTypeChecked`) are intentionally not enabled yet: they
 * need a `tsconfig` per package, which lands with the TypeScript base config task.
 * Enable them there by adding `languageOptions.parserOptions.projectService: true`.
 */
import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import prettierConfig from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    // Generated or vendored output must never be linted.
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/.turbo/**",
      "**/coverage/**",
      "**/*.generated.*",
      // Written by `next build` / `next dev` and uses triple-slash references by design.
      "**/next-env.d.ts",
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.strict,

  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    rules: {
      // CLAUDE.md: `any` is banned. Unknown payloads must be parsed with Zod instead.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },

  {
    // Frontend only: React hooks correctness and Next.js rules.
    files: ["apps/web/**/*.{ts,tsx,js,jsx,mjs}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { "react-hooks": reactHooks, "@next/next": nextPlugin },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },

  {
    // Backend, shared packages and root tooling run on Node only.
    files: ["apps/api-server/**/*", "packages/**/*", "*.{js,mjs,cjs}"],
    languageOptions: { globals: globals.node },
  },

  // Must stay last: disables stylistic rules that would fight Prettier.
  prettierConfig,
);
