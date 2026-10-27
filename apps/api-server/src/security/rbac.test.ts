/**
 * @file rbac.test.ts
 * @description Exhaustive role x minimum-role matrix for the privilege hierarchy.
 */
import { describe, expect, it } from "vitest";
import type { Role } from "shared-types";
import { hasAtLeastRole } from "@/security/rbac";

const ORDER: Role[] = ["VIEWER", "MEMBER", "ADMIN", "OWNER"];

describe("hasAtLeastRole", () => {
  for (const [actualIndex, actual] of ORDER.entries()) {
    for (const [minIndex, minimum] of ORDER.entries()) {
      it(`${actual} vs minimum ${minimum} -> ${actualIndex >= minIndex}`, () => {
        expect(hasAtLeastRole(actual, minimum)).toBe(actualIndex >= minIndex);
      });
    }
  }
});
