/**
 * @file app-providers.tsx
 * @description Client-side provider tree mounted once in the root layout: injected services,
 * the TanStack Query client, and the one-time session bootstrap that restores a signed-in
 * user from the refresh cookie after a page load.
 */
"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { ServicesContext } from "@/shared/hooks/use-services";
import { createAppServices, type AppServices } from "@/shared/services/create-app-services";
import { createQueryClient } from "@/shared/services/create-query-client";
import { publicEnv } from "@/shared/services/env";

/** Props for {@link AppProviders}. */
export interface AppProvidersProps {
  children: ReactNode;
  /** Pre-built services, for tests. Defaults to services pointed at `NEXT_PUBLIC_API_URL`. */
  services?: AppServices;
}

/**
 * Provides services and the query client to the tree and restores the session on mount.
 *
 * @param props - Children and optional service override.
 * @returns The wrapped children.
 * @sideEffects On mount, calls `session.bootstrap()` (one `POST /auth/refresh`).
 */
export function AppProviders({ children, services: provided }: AppProvidersProps) {
  // useState initialisers (not module scope) so each browser session gets its own instances
  // and server rendering never shares them between requests.
  const [services] = useState(
    () => provided ?? createAppServices({ apiUrl: publicEnv.NEXT_PUBLIC_API_URL }),
  );
  const [queryClient] = useState(createQueryClient);

  useEffect(() => {
    void services.session.bootstrap();
  }, [services]);

  return (
    <ServicesContext.Provider value={services}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ServicesContext.Provider>
  );
}
