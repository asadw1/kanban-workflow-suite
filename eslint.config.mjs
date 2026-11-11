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
import jsxA11y from "eslint-plugin-jsx-a11y";
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
    // Accessibility (ADA / WCAG): static checks for labels, roles, alt text, keyboard handlers and
    // ARIA misuse in JSX. Runtime checks live in each component test via expectNoA11yViolations.
    ...jsxA11y.flatConfigs.recommended,
    files: ["apps/web/**/*.{tsx,jsx}"],
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      // Our components take a domain `role` prop (workspace role, for example `<RoleBadge role>`),
      // which is unrelated to ARIA roles. Only validate `role` on real DOM elements.
      "jsx-a11y/aria-role": ["error", { ignoreNonDOM: true }],
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
      // Design-token rule: all styling goes through Tailwind classes backed by the tokens in
      // app/globals.css. Inline `style` props bypass the tokens (and dark mode), so they are banned.
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute[name.name='style']",
          message:
            "No inline styles. Use Tailwind classes backed by design tokens (see app/globals.css).",
        },
      ],
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
