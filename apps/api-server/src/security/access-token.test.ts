/**
 * @file access-token.test.ts
 * @description Unit tests for JWT issuing and verification, including the rejection cases
 * that matter for security: expiry, tampering, wrong secret and algorithm confusion.
 */
import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { AppError } from "@/errors/app-error";
import { JoseAccessTokenService } from "@/security/access-token";

const SECRET = "s".repeat(32);
const T0 = Date.UTC(2026, 9, 27);
const key = new TextEncoder().encode(SECRET);

describe("JoseAccessTokenService", () => {
  it("round-trips the user id and reports the lifetime", async () => {
    const service = new JoseAccessTokenService(SECRET, 900, () => T0);
    const { token, expiresInSeconds } = await service.sign("user_1");
    expect(expiresInSeconds).toBe(900);
    expect(await service.verify(token)).toEqual({ userId: "user_1" });
  });

  it("uses the real clock by default", async () => {
    const service = new JoseAccessTokenService(SECRET, 900);
    const { token } = await service.sign("user_1");
    expect((await service.verify(token)).userId).toBe("user_1");
  });

  it("rejects an expired token", async () => {
    let now = T0;
    const service = new JoseAccessTokenService(SECRET, 900, () => now);
    const { token } = await service.sign("user_1");
    now = T0 + 901_000;
    await expect(service.verify(token)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("rejects a token signed with another secret", async () => {
    const other = new JoseAccessTokenService("o".repeat(32), 900, () => T0);
    const service = new JoseAccessTokenService(SECRET, 900, () => T0);
    const { token } = await other.sign("user_1");
    await expect(service.verify(token)).rejects.toBeInstanceOf(AppError);
  });

  it("rejects a tampered token and garbage input", async () => {
    const service = new JoseAccessTokenService(SECRET, 900, () => T0);
    const { token } = await service.sign("user_1");
    await expect(service.verify(`${token}x`)).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await expect(service.verify("not-a-jwt")).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("rejects a different signing algorithm", async () => {
    const service = new JoseAccessTokenService(SECRET, 900, () => T0);
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS512" })
      .setSubject("user_1")
      .setIssuer("crtwks-api")
      .setExpirationTime(Math.floor(T0 / 1000) + 600)
      .sign(key);
    await expect(service.verify(token)).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("rejects a token without a subject", async () => {
    const service = new JoseAccessTokenService(SECRET, 900, () => T0);
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("crtwks-api")
      .setExpirationTime(Math.floor(T0 / 1000) + 600)
      .sign(key);
    await expect(service.verify(token)).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("rejects a token from another issuer", async () => {
    const service = new JoseAccessTokenService(SECRET, 900, () => T0);
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user_1")
      .setIssuer("someone-else")
      .setExpirationTime(Math.floor(T0 / 1000) + 600)
      .sign(key);
    await expect(service.verify(token)).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });
});
