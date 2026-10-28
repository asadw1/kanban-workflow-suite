/**
 * @file env.ts
 * @description Validated public environment for the web app. Only `NEXT_PUBLIC_*` values
 * belong here: they are inlined into the browser bundle, so never put secrets in this file.
 */
import { z } from "zod";

const PublicEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_SOCKET_URL: z.string().url(),
});

/** Validated public configuration. */
export type PublicEnv = z.infer<typeof PublicEnvSchema>;

/**
 * Validates a raw map of public variables.
 *
 * @param source - Key/value map of the `NEXT_PUBLIC_*` variables.
 * @returns The parsed configuration.
 * @throws Error naming every invalid variable.
 */
export function parsePublicEnv(source: Record<string, string | undefined>): PublicEnv {
  const result = PublicEnvSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid public environment configuration:\n${problems}`);
  }
  return result.data;
}

/**
 * Validated public configuration read from the build-time environment.
 *
 * Each variable is referenced literally (not via `process.env[key]`) because Next.js only
 * inlines `NEXT_PUBLIC_*` values it can see as static property accesses.
 */
export const publicEnv = parsePublicEnv({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL,
});
