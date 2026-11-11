/**
 * @file use-navigation.ts
 * @description React context and hook giving components the injected {@link AppNavigator}.
 * Components call `useNavigation()` instead of Next's `useRouter`, so tests supply a fake and the
 * routing library stays replaceable.
 */
"use client";

import { createContext, useContext } from "react";
import type { AppNavigator } from "@/shared/services/navigator.types";

/** Context holding the navigator; provided once by `NextNavigationProvider`. */
export const NavigationContext = createContext<AppNavigator | null>(null);

/**
 * Reads the injected navigator.
 *
 * @returns The app navigator.
 * @throws Error when called outside a navigation provider, which is a programming mistake.
 */
export function useNavigation(): AppNavigator {
  const navigator = useContext(NavigationContext);
  if (!navigator) throw new Error("useNavigation must be used inside <AppProviders>.");
  return navigator;
}
