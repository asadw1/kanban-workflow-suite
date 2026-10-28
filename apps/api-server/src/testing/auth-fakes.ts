/**
 * @file auth-fakes.ts
 * @description Test doubles for the auth collaborators of the app factory. Shared by app and
 * controller tests so each does not re-declare them. Excluded from coverage (test support).
 */
import { vi } from "vitest";
import type { AuthUseCases } from "@/controllers/auth.controller";
import type { WorkspaceUseCases } from "@/controllers/workspace.controller";
import type { AccessTokenService } from "@/security/access-token";
import type { AuthSession } from "@/services/auth.service";

/** A deterministic session returned by the fake use cases. */
export const fakeSession: AuthSession = {
  accessToken: "access-token",
  expiresInSeconds: 900,
  user: { id: "user_1", email: "ada@example.com", name: "Ada", avatarUrl: null },
  refreshToken: "refresh-token",
  refreshExpiresAt: new Date("2026-11-26T10:00:00Z"),
};

/** Auth use cases whose every method is a spy resolving to {@link fakeSession}. */
export function createFakeAuth() {
  return {
    register: vi.fn<AuthUseCases["register"]>(async () => fakeSession),
    login: vi.fn<AuthUseCases["login"]>(async () => fakeSession),
    refresh: vi.fn<AuthUseCases["refresh"]>(async () => fakeSession),
    logout: vi.fn<AuthUseCases["logout"]>(async () => undefined),
    getProfile: vi.fn<AuthUseCases["getProfile"]>(async () => fakeSession.user),
  };
}

/** Workspace use cases whose every method is a spy returning plausible data. */
export function createFakeWorkspaces() {
  const workspace = { id: "w1", name: "Acme", slug: "acme", role: "OWNER" } as const;
  const member = {
    id: "m1",
    userId: "user_1",
    name: "Ada",
    email: "ada@example.com",
    avatarUrl: null,
    role: "MEMBER",
  } as const;
  return {
    create: vi.fn<WorkspaceUseCases["create"]>(async () => workspace),
    listForUser: vi.fn<WorkspaceUseCases["listForUser"]>(async () => ({
      items: [workspace],
      nextCursor: null,
    })),
    get: vi.fn<WorkspaceUseCases["get"]>(async () => workspace),
    getBySlug: vi.fn<WorkspaceUseCases["getBySlug"]>(async () => workspace),
    listMembers: vi.fn<WorkspaceUseCases["listMembers"]>(async () => ({
      items: [member],
      nextCursor: null,
    })),
    inviteMember: vi.fn<WorkspaceUseCases["inviteMember"]>(async () => member),
    changeMemberRole: vi.fn<WorkspaceUseCases["changeMemberRole"]>(async () => member),
  };
}

/** Token verifier that accepts only the literal token `valid` and maps it to `user_1`. */
export const fakeAccessTokens: AccessTokenService = {
  sign: async () => ({ token: "valid", expiresInSeconds: 900 }),
  verify: async (token) => {
    if (token !== "valid") {
      const { AppError } = await import("@/errors/app-error");
      throw new AppError(401, "UNAUTHENTICATED", "Invalid or expired access token.");
    }
    return { userId: "user_1" };
  },
};
