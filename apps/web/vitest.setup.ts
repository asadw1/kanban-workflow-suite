/**
 * @file vitest.setup.ts
 * @description Global test setup for the web app: registers the jest-dom matchers
 * (`toBeInTheDocument`, `toHaveAccessibleName`, ...) and unmounts rendered trees between tests
 * so one test cannot leak DOM into the next.
 */
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// jsdom has no matchMedia; next-themes reads it to detect the OS color scheme.
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  addListener: () => undefined,
  removeListener: () => undefined,
  dispatchEvent: () => false,
}));

afterEach(() => {
  cleanup();
});
