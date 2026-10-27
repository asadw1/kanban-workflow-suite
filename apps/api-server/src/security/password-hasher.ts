/**
 * @file password-hasher.ts
 * @description Memory-hard password hashing behind a small abstraction (Dependency
 * Inversion), so the algorithm can change without touching the auth service. The default
 * implementation uses scrypt from `node:crypto`, which needs no native addon and satisfies the
 * TAD requirement for a memory-hard algorithm.
 */
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/** Hashes and verifies passwords. Implementations must be constant-time on verify. */
export interface PasswordHasher {
  /**
   * @param password - Plaintext password.
   * @returns A self-describing hash string safe to persist.
   */
  hash(password: string): Promise<string>;
  /**
   * @param password - Plaintext candidate.
   * @param stored - A string previously produced by {@link PasswordHasher.hash}.
   * @returns True only when the candidate matches; false for any malformed `stored` value.
   */
  verify(password: string, stored: string): Promise<boolean>;
}

/** scrypt cost parameters. Stored in each hash so they can be raised without breaking old hashes. */
export interface ScryptCost {
  /** CPU/memory cost, a power of two. */
  N: number;
  r: number;
  p: number;
}

/** OWASP-recommended minimum scrypt cost (about 32 MiB of memory per hash). */
export const DEFAULT_SCRYPT_COST: ScryptCost = { N: 32768, r: 8, p: 1 };

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/** Promise wrapper that keeps the options argument typed. */
function deriveKey(
  password: string,
  salt: Buffer,
  length: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, length, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

/** Maximum memory scrypt may use: 128 * N * r bytes plus headroom, so raising N never throws. */
function maxMemory(cost: ScryptCost): number {
  return 256 * cost.N * cost.r;
}

/** scrypt implementation producing `scrypt$N$r$p$<salt b64>$<key b64>`. */
export class ScryptPasswordHasher implements PasswordHasher {
  /** @param cost - Work factor for new hashes; tests pass a cheap one for speed. */
  constructor(private readonly cost: ScryptCost = DEFAULT_SCRYPT_COST) {}

  /**
   * @param password - Plaintext password.
   * @returns The encoded hash with a fresh random salt.
   * @throws Error if scrypt rejects the cost parameters.
   */
  async hash(password: string): Promise<string> {
    const salt = randomBytes(SALT_LENGTH);
    const { N, r, p } = this.cost;
    const key = await deriveKey(password, salt, KEY_LENGTH, {
      N,
      r,
      p,
      maxmem: maxMemory(this.cost),
    });
    return ["scrypt", N, r, p, salt.toString("base64"), key.toString("base64")].join("$");
  }

  /**
   * @param password - Plaintext candidate.
   * @param stored - Encoded hash from {@link ScryptPasswordHasher.hash}.
   * @returns True on match. Malformed input yields false rather than an exception so a corrupt
   * row can never turn a login attempt into a 500 that reveals the account exists.
   */
  async verify(password: string, stored: string): Promise<boolean> {
    const parts = stored.split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;
    const [, n, r, p, saltB64, keyB64] = parts as [string, string, string, string, string, string];
    const cost: ScryptCost = { N: Number(n), r: Number(r), p: Number(p) };
    if (!Number.isInteger(cost.N) || !Number.isInteger(cost.r) || !Number.isInteger(cost.p)) {
      return false;
    }
    const expected = Buffer.from(keyB64, "base64");
    let actual: Buffer;
    try {
      actual = await deriveKey(password, Buffer.from(saltB64, "base64"), expected.length, {
        ...cost,
        maxmem: maxMemory(cost),
      });
    } catch {
      // Invalid cost parameters or key length in a stored value: treat as a non-match.
      return false;
    }
    return timingSafeEqual(actual, expected);
  }
}
