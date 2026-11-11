/**
 * @file next-navigation-provider.tsx
 * @description Adapter that provides the Next.js App Router as an {@link AppNavigator}. This is
 * the only place in the app that imports `next/navigation` for navigation.
 */
"use client";

import { usePathname, useRouter } from "next/navigation";
import { useMemo, type ReactNode } from "react";
import { NavigationContext } from "@/shared/hooks/use-navigation";
import type { AppNavigator } from "@/shared/services/navigator.types";

/**
 * Supplies the navigator to the tree.
 *
 * @param props.children - The subtree that may call `useNavigation`.
 * @returns The provider element.
 */
export function NextNavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  // Memoised so consumers do not re-render unless the location actually changes; the router
  // object itself is referentially stable in the App Router.
  const navigator = useMemo<AppNavigator>(
    () => ({
      pathname,
      push: (path) => router.push(path),
      replace: (path) => router.replace(path),
      back: () => router.back(),
    }),
    [router, pathname],
  );

  return <NavigationContext.Provider value={navigator}>{children}</NavigationContext.Provider>;
}
