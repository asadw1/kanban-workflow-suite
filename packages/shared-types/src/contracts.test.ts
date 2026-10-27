/**
 * @file contracts.test.ts
 * @description Unit tests for the auth and workspace Zod contracts: input normalisation and the
 * rules that protect invariants (no OWNER via invite, bounded passwords, valid slugs).
 */
import { describe, expect, it } from "vitest";
import {
  ChangeMemberRoleRequestSchema,
  CreateWorkspaceRequestSchema,
  InviteMemberRequestSchema,
  LoginRequestSchema,
  RegisterRequestSchema,
} from "./index";

describe("auth contracts", () => {
  it("normalises email and trims name on register", () => {
    const parsed = RegisterRequestSchema.parse({
      email: "  Ada@Example.COM ",
      name: "  Ada ",
      password: "correct horse",
    });
    expect(parsed.email).toBe("ada@example.com");
    expect(parsed.name).toBe("Ada");
  });

  it("rejects short and oversized passwords on register", () => {
    const base = { email: "a@b.co", name: "A" };
    expect(RegisterRequestSchema.safeParse({ ...base, password: "short" }).success).toBe(false);
    expect(RegisterRequestSchema.safeParse({ ...base, password: "x".repeat(129) }).success).toBe(
      false,
    );
  });

  it("does not apply the password policy on login", () => {
    expect(LoginRequestSchema.safeParse({ email: "a@b.co", password: "old" }).success).toBe(true);
  });
});

describe("workspace contracts", () => {
  it("accepts valid slugs and rejects malformed ones", () => {
    const ok = (slug: string) =>
      CreateWorkspaceRequestSchema.safeParse({ name: "W", slug }).success;
    expect(ok("acme-corp")).toBe(true);
    expect(ok("Acme")).toBe(false);
    expect(ok("-acme")).toBe(false);
    expect(ok("acme--corp")).toBe(false);
    expect(ok("ab")).toBe(false);
  });

  it("defaults invited members to MEMBER and refuses OWNER", () => {
    expect(InviteMemberRequestSchema.parse({ email: "a@b.co" }).role).toBe("MEMBER");
    expect(InviteMemberRequestSchema.safeParse({ email: "a@b.co", role: "OWNER" }).success).toBe(
      false,
    );
    expect(ChangeMemberRoleRequestSchema.safeParse({ role: "OWNER" }).success).toBe(false);
  });
});
