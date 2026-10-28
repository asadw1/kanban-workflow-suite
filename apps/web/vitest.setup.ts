/**
 * @file vitest.setup.ts
 * @description Global test setup for the web app: registers the jest-dom matchers
 * (`toBeInTheDocument`, `toHaveAccessibleName`, ...) and unmounts rendered trees between tests
 * so one test cannot leak DOM into the next.
 */
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
