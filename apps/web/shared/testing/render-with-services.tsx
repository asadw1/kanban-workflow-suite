/**
 * @file render-with-services.tsx
 * @description Test helper that renders a component inside the real provider tree with fake
 * services and a fresh QueryClient, so hook and container tests read like production usage.
 * Excluded from coverage (test support).
 */
import { QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { ServicesContext } from "@/shared/hooks/use-services";
import type { AppServices } from "@/shared/services/create-app-services";
import { createQueryClient } from "@/shared/services/create-query-client";
import type { HttpClient } from "@/shared/services/http-client.types";
import { SessionManager } from "@/shared/services/session-manager";
import { InMemoryTabBus } from "@/shared/testing/in-memory-tab-bus";

/** Builds services whose network clients are the supplied (usually fake) ones. */
export function createFakeServices(overrides: Partial<AppServices> = {}): AppServices {
  const unusedHttp: HttpClient = {
    request: async () => {
      throw new Error("unexpected http.request");
    },
    send: async () => {
      throw new Error("unexpected http.send");
    },
  };
  return {
    session: new SessionManager({
      refreshTransport: async () => "fake-token",
      coordinator: new InMemoryTabBus().createTab(),
      sleep: async () => undefined,
    }),
    http: unusedHttp,
    authHttp: unusedHttp,
    ...overrides,
  };
}

/** Renders `ui` with services and a QueryClient; returns the RTL result plus the services. */
export function renderWithServices(ui: ReactElement, services: AppServices = createFakeServices()) {
  const queryClient = createQueryClient();
  const result = render(
    <ServicesContext.Provider value={services}>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </ServicesContext.Provider>,
  );
  return { ...result, services, queryClient };
}
