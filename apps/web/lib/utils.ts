/**
 * @file utils.ts
 * @description Shared UI helpers. `cn` is the class-name merger used by every shadcn/ui
 * component.
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges conditional class names and resolves Tailwind conflicts (last class wins).
 *
 * @param inputs - Class values accepted by `clsx`.
 * @returns A single deduplicated class string.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
