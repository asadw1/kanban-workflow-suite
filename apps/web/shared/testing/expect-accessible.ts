/**
 * @file expect-accessible.ts
 * @description Test helper that runs the axe-core engine against rendered DOM and fails on any
 * WCAG 2.2 A/AA violation. Every component test suite calls it at least once, so accessibility
 * is verified by the same gate as behaviour. Excluded from coverage (test support).
 *
 * `color-contrast` is disabled because jsdom does not compute layout or styles. Contrast is
 * instead guaranteed at the token level: every text/background pair in `app/globals.css` is
 * verified against WCAG AA when the palette changes (see docs/ui-component-architecture.md).
 */
import { configureAxe } from "vitest-axe";
import { expect } from "vitest";

const axe = configureAxe({
  runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
  rules: { "color-contrast": { enabled: false } },
});

/**
 * Asserts that the given DOM subtree has no detectable WCAG 2.2 A/AA violations.
 *
 * @param container - The element to audit, usually the `container` returned by `render`.
 * @throws AssertionError listing each violation (rule id, help text and offending nodes).
 */
export async function expectNoA11yViolations(container: Element): Promise<void> {
  const results = await axe(container);
  const summary = results.violations.map(
    (v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join("; ")})`,
  );
  expect(summary).toEqual([]);
}
