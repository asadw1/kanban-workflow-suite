/**
 * @file use-notifier.ts
 * @description Hook that gives components the injected {@link Notifier}, so they can show
 * toasts without importing the toast library.
 */
"use client";

import { useServices } from "@/shared/hooks/use-services";
import type { Notifier } from "@/shared/services/notifier.types";

/**
 * Reads the notifier from the injected services.
 *
 * @returns The app notifier.
 * @throws Error when called outside `AppProviders`.
 */
export function useNotifier(): Notifier {
  return useServices().notifier;
}
