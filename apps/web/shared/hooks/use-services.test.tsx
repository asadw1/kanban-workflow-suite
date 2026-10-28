/**
 * @file use-services.test.tsx
 * @description Tests service injection through context.
 */
import { render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ServicesContext, useServices } from "@/shared/hooks/use-services";
import { createFakeServices } from "@/shared/testing/render-with-services";

describe("useServices", () => {
  it("returns the provided services", () => {
    const services = createFakeServices();
    const { result } = renderHook(() => useServices(), {
      wrapper: ({ children }) => (
        <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>
      ),
    });
    expect(result.current).toBe(services);
  });

  it("fails loudly outside the provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    function Probe() {
      useServices();
      return <p>never</p>;
    }
    expect(() => render(<Probe />)).toThrow(/AppProviders/);
    expect(screen.queryByText("never")).not.toBeInTheDocument();
    spy.mockRestore();
  });
});
