/**
 * @file password-hasher.test.ts
 * @description Unit tests for the scrypt hasher: round trip, salting and malformed input.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_SCRYPT_COST, ScryptPasswordHasher } from "@/security/password-hasher";

// Cheap cost keeps the suite fast; production uses DEFAULT_SCRYPT_COST.
const hasher = new ScryptPasswordHasher({ N: 1024, r: 8, p: 1 });

describe("ScryptPasswordHasher", () => {
  it("verifies the correct password and rejects a wrong one", async () => {
    const stored = await hasher.hash("correct horse");
    expect(await hasher.verify("correct horse", stored)).toBe(true);
    expect(await hasher.verify("wrong horse", stored)).toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hasher.hash("same")).not.toBe(await hasher.hash("same"));
  });

  it("never embeds the plaintext", async () => {
    expect(await hasher.hash("hunter2hunter2")).not.toContain("hunter2");
  });

  it("returns false for malformed stored values instead of throwing", async () => {
    expect(await hasher.verify("x", "")).toBe(false);
    expect(await hasher.verify("x", "bcrypt$1$2$3$4$5")).toBe(false);
    expect(await hasher.verify("x", "scrypt$a$b$c$AAAA$AAAA")).toBe(false);
    // N is not a power of two, so scrypt itself rejects the parameters.
    expect(await hasher.verify("x", "scrypt$1000$8$1$AAAA$AAAA")).toBe(false);
  });

  it("rejects a stored key of a different length", async () => {
    const parts = (await hasher.hash("pw")).split("$");
    parts[5] = Buffer.from("short").toString("base64");
    expect(await hasher.verify("pw", parts.join("$"))).toBe(false);
  });

  it("exposes an OWASP-grade default cost", () => {
    expect(DEFAULT_SCRYPT_COST.N).toBeGreaterThanOrEqual(32768);
    expect(new ScryptPasswordHasher()).toBeInstanceOf(ScryptPasswordHasher);
  });
});
