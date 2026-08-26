import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  SlotNoLongerAvailableError,
  UnauthorizedError,
  ValidationError,
  handleApiError,
  toHttpError,
} from "@/lib/errors";

/** Read the JSON body out of the NextResponse handleApiError returns. */
async function body(res: Response) {
  return (await res.json()) as {
    error: { code: string; message: string; details?: Record<string, string> };
  };
}

describe("toHttpError — typed errors", () => {
  it.each([
    [new NotFoundError(), 404, "NOT_FOUND"],
    [new UnauthorizedError(), 401, "UNAUTHORIZED"],
    [new ForbiddenError(), 403, "FORBIDDEN"],
    [new ValidationError(), 422, "VALIDATION_ERROR"],
    [new ConflictError(), 409, "CONFLICT"],
    [new RateLimitError(), 429, "RATE_LIMIT_EXCEEDED"],
    [new SlotNoLongerAvailableError(), 409, "SLOT_NO_LONGER_AVAILABLE"],
  ])("maps %s to the right status and code", (error, statusCode, code) => {
    const result = toHttpError(error);
    expect(result.statusCode).toBe(statusCode);
    expect(result.code).toBe(code);
  });

  it("preserves a custom message", () => {
    expect(toHttpError(new NotFoundError("Appointment not found")).message).toBe(
      "Appointment not found",
    );
  });

  it("carries field details from a ValidationError", () => {
    const err = new ValidationError("Invalid input", { phone: "Phone is required" });
    expect(toHttpError(err).details).toEqual({ phone: "Phone is required" });
  });
});

describe("toHttpError — ZodError", () => {
  const schema = z.object({
    email: z.string().email(),
    age: z.number().int().positive(),
  });

  it("maps to 422 with one message per field", () => {
    const parsed = schema.safeParse({ email: "not-an-email", age: -1 });
    expect(parsed.success).toBe(false);

    const result = toHttpError(parsed.error);
    expect(result.statusCode).toBe(422);
    expect(result.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(result.details ?? {}).sort()).toEqual(["age", "email"]);
  });

  it("joins nested paths with dots", () => {
    const nested = z.object({ patient: z.object({ phone: z.string().min(5) }) });
    const parsed = nested.safeParse({ patient: { phone: "1" } });
    expect(toHttpError((parsed as { error: unknown }).error).details).toHaveProperty("patient.phone");
  });

  it("keeps only the first message for a field", () => {
    const strict = z.object({ password: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/) });
    const parsed = strict.safeParse({ password: "abc" });
    const details = toHttpError((parsed as { error: unknown }).error).details ?? {};
    expect(Object.keys(details)).toEqual(["password"]);
  });
});

describe("toHttpError — Prisma errors", () => {
  it("maps P2002 (unique violation) to 409", () => {
    const result = toHttpError({ code: "P2002", meta: { target: ["email"] } });
    expect(result.statusCode).toBe(409);
    expect(result.code).toBe("CONFLICT");
  });

  it("maps P2003 (FK violation) to 422", () => {
    expect(toHttpError({ code: "P2003" }).statusCode).toBe(422);
  });

  it("maps P2025 (record not found) to 404", () => {
    expect(toHttpError({ code: "P2025" }).statusCode).toBe(404);
  });

  it("maps an unrecognised Prisma code to a generic 500", () => {
    const result = toHttpError({ code: "P2010", meta: { target: ["users"] } });
    expect(result.statusCode).toBe(500);
    expect(result.message).toBe("Internal server error");
  });
});

describe("toHttpError — unknown values", () => {
  it.each([
    ["a bare Error", new Error("boom")],
    ["a string", "boom"],
    ["null", null],
    ["undefined", undefined],
  ])("maps %s to a generic 500", (_label, value) => {
    const result = toHttpError(value);
    expect(result.statusCode).toBe(500);
    expect(result.code).toBe("INTERNAL_SERVER_ERROR");
  });

  it("never leaks the original message of an unexpected error", () => {
    const leaky = new Error('relation "users" does not exist at /srv/app/lib/prisma.ts:14');
    expect(toHttpError(leaky).message).toBe("Internal server error");
  });

  it("never leaks a raw Prisma message", () => {
    const prismaish = Object.assign(new Error("Invalid `prisma.user.create()` invocation"), {
      code: "P2002",
      meta: { target: ["users_email_key"] },
    });
    const result = toHttpError(prismaish);
    expect(result.message).not.toContain("prisma");
    expect(result.message).not.toContain("users_email_key");
  });
});

describe("handleApiError", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the documented success-free error envelope", async () => {
    const res = handleApiError(new NotFoundError("Appointment not found"));
    expect(res.status).toBe(404);

    const json = await body(res);
    expect(json).toEqual({
      error: { code: "NOT_FOUND", message: "Appointment not found" },
    });
  });

  it("includes details only when there are any", async () => {
    const without = await body(handleApiError(new ConflictError()));
    expect(without.error).not.toHaveProperty("details");

    const withDetails = await body(
      handleApiError(new ValidationError("Invalid input", { email: "Required" })),
    );
    expect(withDetails.error.details).toEqual({ email: "Required" });
  });

  it("logs 5xx responses", () => {
    handleApiError(new Error("boom"), { route: "/api/appointments", method: "POST" });
    expect(console.error).toHaveBeenCalled();
  });

  it("does not log expected 4xx responses", () => {
    handleApiError(new UnauthorizedError());
    handleApiError(new ValidationError());
    handleApiError(new NotFoundError());
    expect(console.error).not.toHaveBeenCalled();
  });

  it("honours the status of a custom AppError subclass", async () => {
    class TeapotError extends AppError {
      constructor() {
        super("I'm a teapot", 418, "TEAPOT");
      }
    }
    const res = handleApiError(new TeapotError());
    expect(res.status).toBe(418);
    expect((await body(res)).error.code).toBe("TEAPOT");
  });
});
