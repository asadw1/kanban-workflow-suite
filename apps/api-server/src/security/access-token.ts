/**
 * @file access-token.ts
 * @description Short-lived JWT access tokens (HS256) behind an abstraction. The same
 * verifier is reused by the REST middleware and, later, the Socket.io handshake so both
 * transports enforce identical authentication.
 */
import { SignJWT, jwtVerify } from "jose";
import { AppError } from "@/errors/app-error";

/** Result of signing an access token. */
export interface SignedAccessToken {
  token: string;
  expiresInSeconds: number;
}

/** Issues and verifies access tokens. */
export interface AccessTokenService {
  /**
   * @param userId - Subject of the token.
   * @returns The signed token and its lifetime.
   */
  sign(userId: string): Promise<SignedAccessToken>;
  /**
   * @param token - Raw bearer token.
   * @returns The authenticated user id.
   * @throws AppError 401 `UNAUTHENTICATED` for any invalid, expired or tampered token.
   */
  verify(token: string): Promise<{ userId: string }>;
}

const ISSUER = "crtwks-api";
const ALGORITHM = "HS256";

/** HS256 implementation using `jose`. */
export class JoseAccessTokenService implements AccessTokenService {
  private readonly key: Uint8Array;

  /**
   * @param secret - Signing secret (validated at startup, 32+ chars in production).
   * @param ttlSeconds - Token lifetime.
   * @param now - Clock returning epoch milliseconds; injected for deterministic tests.
   */
  constructor(
    secret: string,
    private readonly ttlSeconds: number,
    private readonly now: () => number = Date.now,
  ) {
    this.key = new TextEncoder().encode(secret);
  }

  /** @inheritdoc */
  async sign(userId: string): Promise<SignedAccessToken> {
    const issuedAt = Math.floor(this.now() / 1000);
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: ALGORITHM })
      .setSubject(userId)
      .setIssuer(ISSUER)
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + this.ttlSeconds)
      .sign(this.key);
    return { token, expiresInSeconds: this.ttlSeconds };
  }

  /** @inheritdoc */
  async verify(token: string): Promise<{ userId: string }> {
    try {
      // Pinning the algorithm blocks `alg: none` and algorithm-confusion attacks.
      const { payload } = await jwtVerify(token, this.key, {
        algorithms: [ALGORITHM],
        issuer: ISSUER,
        currentDate: new Date(this.now()),
      });
      if (!payload.sub) throw new Error("missing subject");
      return { userId: payload.sub };
    } catch {
      throw new AppError(401, "UNAUTHENTICATED", "Invalid or expired access token.");
    }
  }
}
