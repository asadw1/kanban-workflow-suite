/**
 * @file use-navigation.test.tsx
 * @description Tests the navigation hook's provider guard.
 */
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useNavigation } from "@/shared/hooks/use-navigation";

function Probe() {
  useNavigation();
  return null;
}

describe("useNavigation", () => {
  it("throws a clear error outside the provider", () => {
    // React logs the thrown error; silence it so the test output stays readable.
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<Probe />)).toThrow("useNavigation must be used inside <AppProviders>.");
    spy.mockRestore();
  });
});
