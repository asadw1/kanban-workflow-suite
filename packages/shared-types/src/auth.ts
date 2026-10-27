/**
 * @file auth.ts
 * @description Authentication contracts shared by `apps/web` and `apps/api-server`: the register
 * and login request bodies, the public user shape, and the auth response. The server validates
 * incoming bodies with these schemas and the client reuses them for form validation, so both
 * sides enforce identical rules.
 */
import { z } from "zod";

/**
 * Email address, trimmed and lower-cased before validation.
 * Normalising here keeps the `User.email` unique index case-insensitive in practice, so
 * `Ada@x.com` and `ada@x.com` cannot become two accounts.
 */
export const EmailSchema = z.string().trim().toLowerCase().email().max(254);

/**
 * Password policy applied at registration only.
 * The upper bound caps hashing cost (a very long input is a CPU-exhaustion vector); the lower
 * bound follows current NIST guidance of length over composition rules.
 */
export const PasswordSchema = z.string().min(8).max(128);

/** Request body for `POST /auth/register`. */
export const RegisterRequestSchema = z.object({
  email: EmailSchema,
  name: z.string().trim().min(1).max(100),
  password: PasswordSchema,
});

/** Register request body, inferred from {@link RegisterRequestSchema}. */
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

/**
 * Request body for `POST /auth/login`.
 * Deliberately does not apply {@link PasswordSchema}: a policy change must never lock out
 * users whose existing password predates it, and a detailed rejection would leak the policy.
 */
export const LoginRequestSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1).max(128),
});

/** Login request body, inferred from {@link LoginRequestSchema}. */
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

/**
 * User as exposed to clients.
 * Never includes `passwordHash` or any other credential material.
 */
export const UserDtoSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  avatarUrl: z.string().url().nullable(),
});

/** Public user shape, inferred from {@link UserDtoSchema}. */
export type UserDto = z.infer<typeof UserDtoSchema>;

/**
 * Response body for successful register and login calls.
 * Refresh and revocation fields are intentionally absent until the token lifetime decision
 * (roadmap open question 3) is made; add them here so both sides change together.
 */
export const AuthResponseSchema = z.object({
  accessToken: z.string(),
  user: UserDtoSchema,
});

/** Auth response body, inferred from {@link AuthResponseSchema}. */
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
