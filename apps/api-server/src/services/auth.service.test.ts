/**
 * @file auth.service.test.ts
 * @description Unit tests for AuthService against an in-memory Prisma fake. Covers signup,
 * login (including timing decoy), refresh rotation, reuse detection, expiry and logout.
 */
import { Prisma, type User } from "database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthService, hashRefreshToken, type AuthPrisma } from "@/services/auth.service";
import { JoseAccessTokenService } from "@/security/access-token";
import { ScryptPasswordHasher } from "@/security/password-hasher";

interface TokenRow {
  id: string;
  tokenHash: string;
  familyId: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  rotatedAt: Date | null;
}

/** Minimal in-memory stand-in for the Prisma calls AuthService makes. */
function createFakePrisma() {
  const users: User[] = [];
  const tokens: TokenRow[] = [];
  let seq = 0;

  const matches = (row: TokenRow, where: Partial<TokenRow>) =>
    Object.entries(where).every(([k, v]) => row[k as keyof TokenRow] === v);

  const fake = {
    user: {
      create: vi.fn(async ({ data }: { data: Partial<User> }) => {
        if (users.some((u) => u.email === data.email)) {
          throw new Prisma.PrismaClientKnownRequestError("dup", {
            code: "P2002",
            clientVersion: "test",
          });
        }
        const user = {
          id: `user_${++seq}`,
          avatarUrl: null,
          passwordHash: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        } as User;
        users.push(user);
        return user;
      }),
      findUnique: vi.fn(async ({ where }: { where: { id?: string; email?: string } }) => {
        return users.find((u) => u.id === where.id || u.email === where.email) ?? null;
      }),
    },
    refreshToken: {
      create: vi.fn(
        async ({ data }: { data: Omit<TokenRow, "id" | "revokedAt" | "rotatedAt"> }) => {
          const row = { id: `rt_${++seq}`, revokedAt: null, rotatedAt: null, ...data };
          tokens.push(row);
          return row;
        },
      ),
      findUnique: vi.fn(async ({ where }: { where: { tokenHash: string } }) => {
        const row = tokens.find((t) => t.tokenHash === where.tokenHash);
        if (!row) return null;
        return { ...row, user: users.find((u) => u.id === row.userId) };
      }),
      updateMany: vi.fn(
        async ({ where, data }: { where: Partial<TokenRow>; data: Partial<TokenRow> }) => {
          const hit = tokens.filter((t) => matches(t, where));
          hit.forEach((t) => Object.assign(t, data));
          return { count: hit.length };
        },
      ),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(fake)),
  };
  return { fake, users, tokens };
}

/** Returns the first element, failing the test clearly instead of using `!`. */
function first<T>(items: T[]): T {
  const item = items[0];
  if (item === undefined) throw new Error("expected at least one item");
  return item;
}

const T0 = new Date("2026-10-27T10:00:00Z");
const DAY = 86_400_000;

function setup(overrides: { reuseGraceMs?: number } = {}) {
  const db = createFakePrisma();
  let now = T0;
  let counter = 0;
  const service = new AuthService({
    prisma: db.fake as unknown as AuthPrisma,
    hasher: new ScryptPasswordHasher({ N: 1024, r: 8, p: 1 }),
    tokens: new JoseAccessTokenService("s".repeat(32), 900, () => now.getTime()),
    refreshTtlMs: 30 * DAY,
    now: () => now,
    generateRefreshToken: () => `raw-token-${++counter}`,
    ...overrides,
  });
  return {
    ...db,
    service,
    advance: (ms: number) => {
      now = new Date(now.getTime() + ms);
    },
  };
}

const credentials = { email: "ada@example.com", name: "Ada", password: "correct horse" };

describe("AuthService.register", () => {
  it("creates the user, stores only a hash and returns a session", async () => {
    const { service, users, tokens } = setup();
    const session = await service.register(credentials);
    expect(session.user).toEqual({
      id: users[0]?.id,
      email: "ada@example.com",
      name: "Ada",
      avatarUrl: null,
    });
    expect(users[0]?.passwordHash).toMatch(/^scrypt\$/);
    expect(users[0]?.passwordHash).not.toContain("correct horse");
    expect(session.refreshToken).toBe("raw-token-1");
    expect(session.expiresInSeconds).toBe(900);
    expect(session.refreshExpiresAt).toEqual(new Date(T0.getTime() + 30 * DAY));
    // Only the hash of the refresh token is persisted.
    expect(tokens[0]?.tokenHash).toBe(hashRefreshToken("raw-token-1"));
    expect(JSON.stringify(tokens)).not.toContain("raw-token-1");
    expect(JSON.stringify(session.user)).not.toContain("passwordHash");
  });

  it("rejects a duplicate email with 409 EMAIL_TAKEN", async () => {
    const { service } = setup();
    await service.register(credentials);
    await expect(service.register(credentials)).rejects.toMatchObject({
      statusCode: 409,
      code: "EMAIL_TAKEN",
    });
  });

  it("rethrows unexpected database errors", async () => {
    const { service, fake } = setup();
    fake.user.create.mockRejectedValueOnce(new Error("connection lost"));
    await expect(service.register(credentials)).rejects.toThrow("connection lost");
  });
});

describe("AuthService.login", () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(async () => {
    ctx = setup();
    await ctx.service.register(credentials);
  });

  it("signs in with the correct password into a new family", async () => {
    const session = await ctx.service.login({
      email: credentials.email,
      password: "correct horse",
    });
    expect(session.user.email).toBe("ada@example.com");
    expect(ctx.tokens).toHaveLength(2);
    expect(ctx.tokens[0]?.familyId).not.toBe(ctx.tokens[1]?.familyId);
  });

  it("rejects a wrong password", async () => {
    await expect(
      ctx.service.login({ email: credentials.email, password: "wrong" }),
    ).rejects.toMatchObject({ statusCode: 401, code: "INVALID_CREDENTIALS" });
  });

  it("rejects an unknown email with the same error and still burns a hash", async () => {
    await expect(
      ctx.service.login({ email: "nobody@example.com", password: "whatever" }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    // Second call reuses the cached decoy hash.
    await expect(
      ctx.service.login({ email: "nobody@example.com", password: "whatever" }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });

  it("rejects an account that has no password", async () => {
    first(ctx.users).passwordHash = null;
    await expect(
      ctx.service.login({ email: credentials.email, password: "correct horse" }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });
});

describe("AuthService.refresh", () => {
  it("rotates the token within the same family and revokes the old one", async () => {
    const { service, tokens } = setup();
    const first = await service.register(credentials);
    const second = await service.refresh(first.refreshToken);
    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect(tokens[0]?.revokedAt).not.toBeNull();
    expect(tokens[1]?.revokedAt).toBeNull();
    expect(tokens[1]?.familyId).toBe(tokens[0]?.familyId);
    expect(second.user.email).toBe("ada@example.com");
  });

  it("rejects an unknown token", async () => {
    const { service } = setup();
    await expect(service.refresh("nope")).rejects.toMatchObject({
      statusCode: 401,
      code: "INVALID_REFRESH_TOKEN",
    });
  });

  it("rejects an expired token", async () => {
    const { service, advance } = setup();
    const session = await service.register(credentials);
    advance(31 * DAY);
    await expect(service.refresh(session.refreshToken)).rejects.toMatchObject({
      code: "INVALID_REFRESH_TOKEN",
    });
  });

  it("treats a duplicate within the grace window as a retryable 409 and keeps the session", async () => {
    const { service, tokens } = setup();
    const original = await service.register(credentials);
    const rotated = await service.refresh(original.refreshToken);
    // A second tab replays the old cookie a moment later.
    await expect(service.refresh(original.refreshToken)).rejects.toMatchObject({
      statusCode: 409,
      code: "REFRESH_IN_PROGRESS",
    });
    // Nothing was revoked: the newest token still works.
    expect(tokens.filter((t) => t.revokedAt === null)).toHaveLength(1);
    await expect(service.refresh(rotated.refreshToken)).resolves.toBeDefined();
  });

  it("treats reuse after the grace window as theft and revokes the whole family", async () => {
    const { service, tokens, advance } = setup();
    const original = await service.register(credentials);
    const rotated = await service.refresh(original.refreshToken);
    advance(11_000);
    await expect(service.refresh(original.refreshToken)).rejects.toMatchObject({
      statusCode: 401,
      code: "INVALID_REFRESH_TOKEN",
    });
    expect(tokens.every((t) => t.revokedAt !== null)).toBe(true);
    // The legitimate holder of the newest token is cut off too.
    await expect(service.refresh(rotated.refreshToken)).rejects.toMatchObject({
      code: "INVALID_REFRESH_TOKEN",
    });
  });

  it("honours a custom grace window", async () => {
    const { service, advance } = setup({ reuseGraceMs: 1000 });
    const original = await service.register(credentials);
    await service.refresh(original.refreshToken);
    advance(1500);
    await expect(service.refresh(original.refreshToken)).rejects.toMatchObject({
      code: "INVALID_REFRESH_TOKEN",
    });
  });

  it("never grants grace to a token revoked by logout", async () => {
    const { service } = setup();
    const session = await service.register(credentials);
    await service.logout(session.refreshToken);
    await expect(service.refresh(session.refreshToken)).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it("answers a lost concurrent rotation race with 409 and does not revoke", async () => {
    const { service, tokens, users, fake } = setup();
    const session = await service.register(credentials);
    // Another request claims the token between our read and our conditional update.
    fake.refreshToken.findUnique.mockImplementationOnce(async () => ({
      ...first(tokens),
      user: first(users),
    }));
    fake.refreshToken.updateMany.mockImplementationOnce(async () => ({ count: 0 }));
    await expect(service.refresh(session.refreshToken)).rejects.toMatchObject({
      statusCode: 409,
      code: "REFRESH_IN_PROGRESS",
    });
    expect(first(tokens).revokedAt).toBeNull();
  });
});

describe("AuthService.logout", () => {
  it("revokes the family so the token can no longer refresh", async () => {
    const { service } = setup();
    const session = await service.register(credentials);
    await service.logout(session.refreshToken);
    await expect(service.refresh(session.refreshToken)).rejects.toMatchObject({
      code: "INVALID_REFRESH_TOKEN",
    });
  });

  it("is idempotent for unknown tokens", async () => {
    const { service } = setup();
    await expect(service.logout("never-issued")).resolves.toBeUndefined();
  });
});

describe("AuthService.getProfile", () => {
  it("returns the public user shape", async () => {
    const { service, users } = setup();
    await service.register(credentials);
    expect(await service.getProfile(first(users).id)).toEqual({
      id: first(users).id,
      email: "ada@example.com",
      name: "Ada",
      avatarUrl: null,
    });
  });

  it("rejects a deleted account with 401", async () => {
    const { service } = setup();
    await expect(service.getProfile("ghost")).rejects.toMatchObject({
      statusCode: 401,
      code: "UNAUTHENTICATED",
    });
  });
});

describe("AuthService defaults", () => {
  it("works with the real clock and random token generator", async () => {
    const db = createFakePrisma();
    const service = new AuthService({
      prisma: db.fake as unknown as AuthPrisma,
      hasher: new ScryptPasswordHasher({ N: 1024, r: 8, p: 1 }),
      tokens: new JoseAccessTokenService("s".repeat(32), 900),
      refreshTtlMs: DAY,
    });
    const session = await service.register(credentials);
    expect(session.refreshToken.length).toBeGreaterThanOrEqual(43);
  });
});
