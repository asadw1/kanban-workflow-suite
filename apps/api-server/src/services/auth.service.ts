/**
 * @file auth.service.ts
 * @description Authentication business logic: registration, login, refresh-token rotation and
 * logout. Access tokens are 15-minute JWTs (stateless); refresh tokens are opaque random
 * strings stored only as SHA-256 hashes, rotated on every use, and revoked per session family
 * when reuse is detected. State lives in PostgreSQL only, so any API instance can serve any
 * request. Only services touch Prisma (see CLAUDE.md), so this is the sole auth data path.
 */
import { createHash, randomBytes } from "node:crypto";
import { Prisma, type PrismaClient, type User } from "database";
import type { LoginRequest, RegisterRequest, UserDto } from "shared-types";
import { AppError } from "@/errors/app-error";
import type { AccessTokenService } from "@/security/access-token";
import type { PasswordHasher } from "@/security/password-hasher";

/** Subset of Prisma the service needs (Interface Segregation); tests pass a fake. */
export type AuthPrisma = Pick<PrismaClient, "user" | "refreshToken" | "$transaction">;

/** Everything a controller needs to answer a successful sign-in or refresh. */
export interface AuthSession {
  accessToken: string;
  expiresInSeconds: number;
  user: UserDto;
  /** Raw refresh token. Returned once and never stored; deliver it in an httpOnly cookie. */
  refreshToken: string;
  refreshExpiresAt: Date;
}

/** Collaborators and settings for {@link AuthService}. */
export interface AuthServiceDeps {
  prisma: AuthPrisma;
  hasher: PasswordHasher;
  tokens: AccessTokenService;
  /** Refresh token lifetime in milliseconds. */
  refreshTtlMs: number;
  /**
   * How long after rotation a replay of the old token is treated as a harmless duplicate
   * (several browser tabs refreshing together) rather than theft. Default 10 seconds.
   */
  reuseGraceMs?: number;
  /** Clock, injected so expiry logic is deterministic in tests. */
  now?: () => Date;
  /** Generator of raw refresh tokens, injected for deterministic tests. */
  generateRefreshToken?: () => string;
}

/** One error for every refresh failure so callers cannot tell why a token was refused. */
const INVALID_REFRESH = () =>
  new AppError(401, "INVALID_REFRESH_TOKEN", "Refresh token is invalid or expired.");

/** Default grace window for duplicate refreshes; see {@link AuthServiceDeps.reuseGraceMs}. */
const DEFAULT_REUSE_GRACE_MS = 10_000;

/**
 * Duplicate refresh inside the grace window. Retryable: by the time the client retries, the
 * browser cookie jar already holds the token the winning request rotated to.
 */
const REFRESH_IN_PROGRESS = () =>
  new AppError(409, "REFRESH_IN_PROGRESS", "Another refresh just completed. Retry the request.");

/**
 * Hashes a raw refresh token for storage and lookup.
 * SHA-256 (not a slow hash) is appropriate: the input is 256 bits of randomness, so there is
 * nothing to brute-force, and lookups must be fast and indexable.
 *
 * @param raw - Raw refresh token.
 * @returns Hex digest.
 */
export function hashRefreshToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Projects a database user to the public DTO, dropping `passwordHash` and internals. */
function toUserDto(user: Pick<User, "id" | "email" | "name" | "avatarUrl">): UserDto {
  return { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl };
}

/** Authentication use cases. */
export class AuthService {
  private readonly now: () => Date;
  private readonly generateRefreshToken: () => string;
  /** Lazily computed hash compared against when the email is unknown, to equalise timing. */
  private decoyHash: Promise<string> | undefined;

  /** @param deps - Injected collaborators; see {@link AuthServiceDeps}. */
  constructor(private readonly deps: AuthServiceDeps) {
    this.now = deps.now ?? (() => new Date());
    this.generateRefreshToken =
      deps.generateRefreshToken ?? (() => randomBytes(32).toString("base64url"));
  }

  /**
   * Creates an account and signs it in.
   *
   * @param input - Validated registration body (email already normalised).
   * @returns A new session.
   * @throws AppError 409 `EMAIL_TAKEN` when the email is already registered. This does reveal
   * that the address has an account; it is the accepted trade-off for a usable signup form.
   */
  async register(input: RegisterRequest): Promise<AuthSession> {
    const passwordHash = await this.deps.hasher.hash(input.password);
    let user: User;
    try {
      user = await this.deps.prisma.user.create({
        data: { email: input.email, name: input.name, passwordHash },
      });
    } catch (error) {
      // Rely on the unique index, not a prior lookup, so concurrent signups cannot both win.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new AppError(409, "EMAIL_TAKEN", "An account with this email already exists.");
      }
      throw error;
    }
    return this.issueSession(user, this.newFamilyId());
  }

  /**
   * Verifies credentials and signs the user in.
   *
   * @param input - Validated login body.
   * @returns A new session in a fresh refresh-token family.
   * @throws AppError 401 `INVALID_CREDENTIALS` for an unknown email, wrong password or an
   * account without a password. All three are indistinguishable to the caller and take
   * comparable time (a decoy hash is verified for unknown accounts).
   */
  async login(input: LoginRequest): Promise<AuthSession> {
    const user = await this.deps.prisma.user.findUnique({ where: { email: input.email } });
    const stored = user?.passwordHash ?? (await this.getDecoyHash());
    const matches = await this.deps.hasher.verify(input.password, stored);
    if (!user || !user.passwordHash || !matches) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
    }
    return this.issueSession(user, this.newFamilyId());
  }

  /**
   * Exchanges a refresh token for a new access token and a rotated refresh token.
   *
   * Concurrency invariant: rotation claims the old token with a conditional update
   * (`revokedAt IS NULL`), so two simultaneous refreshes cannot both succeed. A loser, or a
   * replay within the grace window after rotation, is a duplicate (typically another browser
   * tab) and gets a retryable 409 without touching the session. Replaying a rotated token
   * after the window, or any token revoked by logout or an earlier theft response, is treated
   * as theft: the whole family is revoked, forcing a fresh login on every device.
   *
   * @param rawToken - Refresh token from the cookie.
   * @returns A new session continuing the same family.
   * @throws AppError 401 `INVALID_REFRESH_TOKEN` when unknown, expired, revoked or reused; 409
   * `REFRESH_IN_PROGRESS` for a duplicate within the grace window (retry the request).
   */
  async refresh(rawToken: string): Promise<AuthSession> {
    const { prisma } = this.deps;
    const record = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(rawToken) },
      include: { user: true },
    });
    if (!record) throw INVALID_REFRESH();

    if (record.revokedAt) {
      // Only a token that was rotated (not logged out or revoked) can be a benign duplicate.
      const graceMs = this.deps.reuseGraceMs ?? DEFAULT_REUSE_GRACE_MS;
      if (record.rotatedAt && this.now().getTime() - record.rotatedAt.getTime() <= graceMs) {
        throw REFRESH_IN_PROGRESS();
      }
      await this.revokeFamily(record.familyId);
      throw INVALID_REFRESH();
    }
    if (record.expiresAt <= this.now()) throw INVALID_REFRESH();

    const rotated = await prisma.$transaction(async (tx) => {
      const now = this.now();
      const claimed = await tx.refreshToken.updateMany({
        where: { id: record.id, revokedAt: null },
        // rotatedAt (as opposed to a bare revokedAt) is what makes a replay eligible for grace.
        data: { revokedAt: now, rotatedAt: now },
      });
      if (claimed.count === 0) return null;
      return this.createRefreshToken(tx, record.userId, record.familyId);
    });

    if (!rotated) {
      // Lost a race by milliseconds with a concurrent refresh of the same token. It is a
      // duplicate, not theft; if the family was actually revoked meanwhile, the retry gets 401.
      throw REFRESH_IN_PROGRESS();
    }
    return this.buildSession(record.user, rotated);
  }

  /**
   * Ends a session by revoking its whole refresh-token family.
   * Idempotent: unknown or already-revoked tokens succeed silently so logout never fails.
   *
   * @param rawToken - Refresh token from the cookie.
   * @returns Nothing.
   */
  async logout(rawToken: string): Promise<void> {
    const record = await this.deps.prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(rawToken) },
    });
    if (record) await this.revokeFamily(record.familyId);
  }

  /**
   * Loads the profile of an authenticated user.
   *
   * @param userId - Id from a verified access token.
   * @returns The public user shape.
   * @throws AppError 401 `UNAUTHENTICATED` if the account no longer exists, so a deleted
   * user's still-valid access token stops working for profile reads.
   */
  async getProfile(userId: string): Promise<UserDto> {
    const user = await this.deps.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError(401, "UNAUTHENTICATED", "Account no longer exists.");
    return toUserDto(user);
  }

  /** Revokes every still-active token in a family. */
  private async revokeFamily(familyId: string): Promise<void> {
    await this.deps.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: this.now() },
    });
  }

  /** Generates a family id for a new login session. */
  private newFamilyId(): string {
    return randomBytes(16).toString("hex");
  }

  private getDecoyHash(): Promise<string> {
    this.decoyHash ??= this.deps.hasher.hash("decoy-password-for-timing");
    return this.decoyHash;
  }

  /** Persists a new refresh token and returns its raw value and expiry. */
  private async createRefreshToken(
    client: Pick<AuthPrisma, "refreshToken">,
    userId: string,
    familyId: string,
  ): Promise<{ raw: string; expiresAt: Date }> {
    const raw = this.generateRefreshToken();
    const expiresAt = new Date(this.now().getTime() + this.deps.refreshTtlMs);
    await client.refreshToken.create({
      data: { tokenHash: hashRefreshToken(raw), familyId, userId, expiresAt },
    });
    return { raw, expiresAt };
  }

  private async issueSession(user: User, familyId: string): Promise<AuthSession> {
    const refresh = await this.createRefreshToken(this.deps.prisma, user.id, familyId);
    return this.buildSession(user, refresh);
  }

  private async buildSession(
    user: User,
    refresh: { raw: string; expiresAt: Date },
  ): Promise<AuthSession> {
    const access = await this.deps.tokens.sign(user.id);
    return {
      accessToken: access.token,
      expiresInSeconds: access.expiresInSeconds,
      user: toUserDto(user),
      refreshToken: refresh.raw,
      refreshExpiresAt: refresh.expiresAt,
    };
  }
}
