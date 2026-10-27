/**
 * @file rbac.ts
 * @description Pure role-hierarchy helpers for workspace RBAC. Kept free of I/O so the
 * privilege ordering, which every authorization decision depends on, is trivially testable.
 */
import type { Role } from "shared-types";

/** Privilege rank per role; a higher number can do everything a lower one can. */
const ROLE_RANK: Readonly<Record<Role, number>> = {
  VIEWER: 0,
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

/**
 * Compares two roles in the hierarchy `OWNER > ADMIN > MEMBER > VIEWER`.
 *
 * @param actual - The role the caller holds.
 * @param minimum - The least privileged role allowed to proceed.
 * @returns True when `actual` is at least as privileged as `minimum`.
 */
export function hasAtLeastRole(actual: Role, minimum: Role): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[minimum];
}
