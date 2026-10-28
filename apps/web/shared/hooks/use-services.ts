/**
 * @file use-services.ts
 * @description React context and hook that give components access to the injected services
 * (session and HTTP clients). Components depend on this hook instead of importing a client, so
 * tests can supply fakes and the transport stays replaceable.
 */
"use client";

import { createContext, useContext } from "react";
import type { AppServices } from "@/shared/services/create-app-services";

/** Context holding the services; provided once by `AppProviders`. */
export const ServicesContext = createContext<AppServices | null>(null);

/**
 * Reads the injected services.
 *
 * @returns The app services.
 * @throws Error when called outside `AppProviders`, which is a programming mistake.
 */
export function useServices(): AppServices {
  const services = useContext(ServicesContext);
  if (!services) throw new Error("useServices must be used inside <AppProviders>.");
  return services;
}
