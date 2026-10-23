/**
 * @file error-handler.ts
 * @description Centralised error and 404 handling. Every failure leaves the server as the
 * standard `ErrorResponse` body so clients parse one shape. Handlers never throw their own
 * errors, so async route handlers need no try/catch of their own.
 */
import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import type { ErrorResponse } from "shared-types";
import { AppError } from "@/errors/app-error";

/** Generic text for unexpected failures; internals must never reach the client. */
const INTERNAL_ERROR_MESSAGE = "An unexpected error occurred.";

/** Reads a numeric `statusCode` from framework errors (body parse failures, rate limits, etc.). */
function frameworkStatusCode(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "statusCode" in error) {
    const { statusCode } = error;
    if (typeof statusCode === "number" && statusCode >= 400 && statusCode < 600) {
      return statusCode;
    }
  }
  return undefined;
}

/**
 * Installs the not-found and error handlers on the app.
 *
 * Mapping: `AppError` keeps its status and code; `ZodError` becomes 400 `VALIDATION_ERROR`;
 * framework 4xx errors become `BAD_REQUEST`; everything else is a logged, generic 500.
 *
 * @param app - The Fastify instance to configure.
 * @returns Nothing.
 * @sideEffects Replaces the instance's default error and 404 handlers. 5xx errors are logged
 * with the request id for correlation; 4xx are not, to avoid log noise from bad clients.
 */
export function registerErrorHandling(app: FastifyInstance): void {
  app.setNotFoundHandler((request, reply) => {
    const body: ErrorResponse = {
      message: `Route ${request.method} ${request.url} not found.`,
      code: "NOT_FOUND",
    };
    return reply.status(404).send(body);
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      const body: ErrorResponse = {
        message: error.message,
        code: error.code,
        ...(error.details !== undefined && { details: error.details }),
      };
      return reply.status(error.statusCode).send(body);
    }

    if (error instanceof ZodError) {
      const body: ErrorResponse = {
        message: "Request validation failed.",
        code: "VALIDATION_ERROR",
        details: error.issues,
      };
      return reply.status(400).send(body);
    }

    const status = frameworkStatusCode(error);
    if (status !== undefined && status < 500) {
      const message = error instanceof Error ? error.message : "Bad request.";
      const body: ErrorResponse = { message, code: "BAD_REQUEST" };
      return reply.status(status).send(body);
    }

    request.log.error({ err: error }, "unhandled error");
    const body: ErrorResponse = { message: INTERNAL_ERROR_MESSAGE, code: "INTERNAL_ERROR" };
    return reply.status(500).send(body);
  });
}
