import { NextResponse } from "next/server";

export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401, "UNAUTHORIZED");
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, 403, "FORBIDDEN");
    this.name = "ForbiddenError";
  }
}

export class ValidationError extends AppError {
  /** Optional field-level messages, surfaced to the client as `error.details`. */
  public readonly details?: Record<string, string>;

  constructor(message = "Validation failed", details?: Record<string, string>) {
    super(message, 422, "VALIDATION_ERROR");
    this.name = "ValidationError";
    this.details = details;
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict") {
    super(message, 409, "CONFLICT");
    this.name = "ConflictError";
  }
}

export class RateLimitError extends AppError {
  /** Unix ms at which the window resets, used to build `Retry-After`. */
  public readonly resetAt?: number;

  constructor(message = "Too many requests", resetAt?: number) {
    super(message, 429, "RATE_LIMIT_EXCEEDED");
    this.name = "RateLimitError";
    this.resetAt = resetAt;
  }
}

export class SlotNoLongerAvailableError extends AppError {
  constructor(message = "That time was just booked by someone else") {
    super(message, 409, "SLOT_NO_LONGER_AVAILABLE");
    this.name = "SlotNoLongerAvailableError";
  }
}

/** Field-level messages, keyed by dotted path — `{ "email": "Must be valid" }`. */
export type ErrorDetails = Record<string, string>;

export interface NormalisedError {
  message: string;
  statusCode: number;
  code: string;
  details?: ErrorDetails;
}

/**
 * Collapse any thrown value into a safe, client-facing shape.
 *
 * Anything not explicitly recognised becomes a generic 500. That default is the
 * point: raw Prisma errors carry table and column names, and stack traces carry
 * filesystem paths. Neither goes to a client.
 */
export function toHttpError(error: unknown): NormalisedError {
  if (error instanceof AppError) {
    return {
      message: error.message,
      statusCode: error.statusCode,
      code: error.code,
      ...(error instanceof ValidationError && error.details ? { details: error.details } : {}),
    };
  }

  if (isZodError(error)) {
    return {
      message: "Invalid input",
      statusCode: 422,
      code: "VALIDATION_ERROR",
      details: zodIssuesToDetails(error.issues),
    };
  }

  if (isPrismaKnownError(error)) {
    return mapPrismaError(error);
  }

  return {
    message: "Internal server error",
    statusCode: 500,
    code: "INTERNAL_SERVER_ERROR",
  };
}

/**
 * The single error handler every route handler funnels through.
 *
 * Usage, per docs/api-conventions.md:
 *
 * ```ts
 * try {
 *   // parse -> validate -> call lib -> respond
 * } catch (err) {
 *   return handleApiError(err);
 * }
 * ```
 */
export function handleApiError(error: unknown, context?: ErrorContext): NextResponse {
  const normalised = toHttpError(error);

  if (normalised.statusCode >= 500) {
    reportServerError(error, context);
  }

  const headers = new Headers();
  if (error instanceof RateLimitError && error.resetAt) {
    // docs/security.md: "Exceeding the limit returns 429 with a Retry-After
    // header." Seconds, floored at 1 so a sub-second window never sends 0.
    const seconds = Math.max(1, Math.ceil((error.resetAt - Date.now()) / 1000));
    headers.set("Retry-After", String(seconds));
  }

  return NextResponse.json(
    {
      error: {
        code: normalised.code,
        message: normalised.message,
        ...(normalised.details ? { details: normalised.details } : {}),
      },
    },
    { status: normalised.statusCode, headers },
  );
}

export interface ErrorContext {
  route?: string;
  method?: string;
  userId?: string;
  [key: string]: unknown;
}

/**
 * Report a 5xx to the error tracker.
 *
 * Sentry is installed but not yet initialised (that lands in Phase 6, with the
 * three sentry.*.config.ts files). `captureException` is a no-op until then, so
 * this is safe to call now; the console line guarantees the failure is visible
 * in the meantime.
 */
function reportServerError(error: unknown, context?: ErrorContext): void {
  console.error("[api] unhandled server error", { error, ...context });

  // Imported lazily so @sentry/nextjs is never pulled into an edge or client
  // bundle by something that merely imports an error class from this module.
  void import("@sentry/nextjs")
    .then((Sentry) => {
      Sentry.captureException(error, context ? { extra: context } : undefined);
    })
    .catch(() => {
      // Error tracking must never be the thing that breaks the request.
    });
}

// ─── Narrowing helpers ───────────────────────────────────────────────────────
// Structural checks rather than `instanceof`, so this module stays free of
// runtime imports from zod and @prisma/client. That keeps it importable from
// anywhere, including edge contexts.

interface ZodLikeIssue {
  path: Array<string | number>;
  message: string;
}

function isZodError(error: unknown): error is { issues: ZodLikeIssue[] } {
  return (
    typeof error === "object" &&
    error !== null &&
    "issues" in error &&
    Array.isArray((error as { issues: unknown }).issues)
  );
}

/**
 * Flatten Zod issues to one message per field.
 *
 * First issue per path wins — showing a user three messages for one input is
 * noise, and the first is the most specific.
 */
function zodIssuesToDetails(issues: ZodLikeIssue[]): ErrorDetails {
  const details: ErrorDetails = {};
  for (const issue of issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_root";
    if (!(key in details)) details[key] = issue.message;
  }
  return details;
}

function isPrismaKnownError(error: unknown): error is { code: string; meta?: { target?: unknown } } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string" &&
    /^P\d{4}$/.test((error as { code: string }).code)
  );
}

/**
 * Map the Prisma error codes we can act on. Everything else falls through to a
 * generic 500 — deliberately, so an unmapped code never leaks schema details.
 */
function mapPrismaError(error: { code: string; meta?: { target?: unknown } }): NormalisedError {
  switch (error.code) {
    // Unique constraint violation. For appointments this is Layer 3 firing —
    // the partial index caught a double-book that slipped past the transaction.
    case "P2002":
      return {
        message: "That record already exists",
        statusCode: 409,
        code: "CONFLICT",
      };
    // Foreign key constraint failed — a referenced row does not exist.
    case "P2003":
      return {
        message: "Referenced record does not exist",
        statusCode: 422,
        code: "VALIDATION_ERROR",
      };
    // "An operation failed because it depends on one or more records that were
    // required but not found."
    case "P2025":
      return {
        message: "Resource not found",
        statusCode: 404,
        code: "NOT_FOUND",
      };
    default:
      return {
        message: "Internal server error",
        statusCode: 500,
        code: "INTERNAL_SERVER_ERROR",
      };
  }
}
