import {
  reportServerError,
  toHttpError,
  type ErrorDetails,
} from "@/lib/errors";

/**
 * The return shape of every Server Action.
 *
 * `docs/api-conventions.md`: actions return plain objects and never throw raw
 * errors to the client. A thrown error in a Server Action is serialised to the
 * browser as an opaque digest in production, which tells the user nothing —
 * and in development leaks the stack. Both are avoided by never throwing.
 *
 * Kept out of the `"use server"` files on purpose: a module with that directive
 * may only export async functions, so the type and the wrapper live here.
 */

export type ActionSuccess<T> = { ok: true; data: T };

export type ActionFailure = {
  ok: false;
  error: { code: string; message: string; details?: ErrorDetails };
};

export type ActionResult<T> = ActionSuccess<T> | ActionFailure;

/**
 * Run an action body, translating typed errors into a safe result.
 *
 * The same normalisation route handlers get from `handleApiError`, so an
 * action and its equivalent endpoint answer identically. 5xx is reported and
 * flattened to a generic message; everything below it keeps the message the
 * domain chose, because those are written for the user.
 */
export async function runAction<T>(
  context: string,
  body: () => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await body() };
  } catch (error) {
    const normalised = toHttpError(error);

    if (normalised.statusCode >= 500) {
      reportServerError(error, { route: context });
    }

    return {
      ok: false,
      error: {
        code: normalised.code,
        message: normalised.message,
        ...(normalised.details ? { details: normalised.details } : {}),
      },
    };
  }
}
