/**
 * @file errors.ts
 * @description Standard error response contract returned by every API endpoint. Defined once
 * here so the server serialises, and the client parses, exactly the same shape.
 */
import { z } from "zod";

/**
 * Zod schema for the JSON body of every non-2xx API response.
 * `code` is a stable machine-readable identifier; `message` is human-readable and may change.
 */
export const ErrorResponseSchema = z.object({
  message: z.string(),
  code: z.string(),
  details: z.unknown().optional(),
});

/** Error response body, inferred from {@link ErrorResponseSchema}. */
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
