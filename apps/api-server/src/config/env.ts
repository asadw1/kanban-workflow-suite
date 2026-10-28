/**
 * @file env.ts
 * @description Startup environment validation for the API server. Configuration is parsed
 * once with Zod and the process fails fast on missing or invalid values, so a bad deploy
 * crashes immediately rather than misbehaving at request time.
 */
import { z } from "zod";

/** Placeholder secret shipped in `.env.example`; must never reach production. */
const INSECURE_DEFAULT_SECRET = "change-me";

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),
    JWT_SECRET: z.string().min(1),
    /** Access token lifetime. Short on purpose: it cannot be revoked, only outlived. */
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    /** Refresh token lifetime; a session ends after this long without a refresh. */
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
    /** Window in which a replayed, just-rotated refresh token is a duplicate, not theft. */
    REFRESH_REUSE_GRACE_SECONDS: z.coerce.number().int().min(0).max(60).default(10),
    /** Browser origin allowed by CORS and the Socket.io handshake. */
    WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
  })
  .superRefine((env, ctx) => {
    // Security invariant: JWTs are signed with this secret, so a guessable value in
    // production would let anyone forge tokens for any user and workspace.
    if (
      env.NODE_ENV === "production" &&
      (env.JWT_SECRET === INSECURE_DEFAULT_SECRET || env.JWT_SECRET.length < 32)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["JWT_SECRET"],
        message: "must be at least 32 characters and not the example value in production",
      });
    }
  });

/** Validated, typed server configuration. */
export type Env = z.infer<typeof EnvSchema>;

/**
 * Validates a raw environment map.
 *
 * Takes the source as a parameter (rather than reading `process.env`) so it is pure and
 * trivially testable.
 *
 * @param source - Raw key/value map, typically `process.env`.
 * @returns The parsed configuration with defaults applied.
 * @throws Error listing every invalid variable, never the secret values themselves.
 */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return result.data;
}

/**
 * Loads configuration from the real process environment.
 *
 * @returns The validated {@link Env}.
 * @throws Error when any variable is missing or invalid.
 */
export function loadEnv(): Env {
  return parseEnv(process.env);
}
