/**
 * @file use-session-status.test.tsx
 * @description Tests that components re-render when the session status changes.
 */
import { act, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ServicesContext } from "@/shared/hooks/use-services";
import { useSessionStatus } from "@/shared/hooks/use-session-status";
import { createFakeServices, renderWithServices } from "@/shared/testing/render-with-services";

function Status() {
  return <p>{useSessionStatus()}</p>;
}

describe("useSessionStatus", () => {
  it("tracks sign-in and sign-out", () => {
    const { services } = renderWithServices(<Status />);
    expect(screen.getByText("loading")).toBeInTheDocument();
    act(() => services.session.setAccessToken("t"));
    expect(screen.getByText("authenticated")).toBeInTheDocument();
    act(() => services.session.clear());
    expect(screen.getByText("unauthenticated")).toBeInTheDocument();
  });

  it("always reports loading during server rendering", () => {
    const services = createFakeServices();
    services.session.setAccessToken("t");
    const html = renderToString(
      <ServicesContext.Provider value={services}>
        <Status />
      </ServicesContext.Provider>,
    );
    expect(html).toContain("loading");
  });
});
