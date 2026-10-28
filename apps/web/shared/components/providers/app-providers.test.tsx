/**
 * @file app-providers.test.tsx
 * @description Tests the provider tree: it injects services, supplies a QueryClient and
 * bootstraps the session exactly once on mount.
 */
import { useQueryClient } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppProviders } from "@/shared/components/providers/app-providers";
import { useServices } from "@/shared/hooks/use-services";
import { useSessionStatus } from "@/shared/hooks/use-session-status";
import { createFakeServices } from "@/shared/testing/render-with-services";

function Probe() {
  const services = useServices();
  const client = useQueryClient();
  const status = useSessionStatus();
  return (
    <p>
      {status}:{String(services.session.getAccessToken())}:{typeof client.getQueryCache}
    </p>
  );
}

describe("AppProviders", () => {
  it("provides services and a query client, and restores the session once", async () => {
    const services = createFakeServices();
    const bootstrap = vi.spyOn(services.session, "bootstrap");
    render(
      <AppProviders services={services}>
        <Probe />
      </AppProviders>,
    );
    await waitFor(() =>
      expect(screen.getByText(/^authenticated:fake-token:function$/)).toBeInTheDocument(),
    );
    expect(bootstrap).toHaveBeenCalledOnce();
  });

  it("builds default services from the public environment", () => {
    render(
      <AppProviders>
        <Probe />
      </AppProviders>,
    );
    expect(screen.getByText(/function$/)).toBeInTheDocument();
  });
});
