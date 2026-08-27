import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { handleApiError } from "@/lib/errors";
import { runReminderSweep } from "@/lib/reminders";

export const dynamic = "force-dynamic";

/**
 * Hourly reminder sweep, invoked by Vercel Cron (see `vercel.json`).
 *
 * A route handler rather than a Server Action because it is called by an
 * external system on a schedule — exactly the case `api-conventions.md`
 * reserves route handlers for.
 *
 * The secret is checked **before the database is touched**, so an unauthorised
 * caller cannot use this endpoint to make the clinic's database do work.
 */
export async function GET(req: NextRequest) {
  try {
    if (!isAuthorisedCron(req)) {
      // Deliberately terse. Any detail here tells an attacker whether the
      // secret is unset, malformed, or merely wrong.
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
        { status: 401 },
      );
    }

    const result = await runReminderSweep();

    console.info("[reminders] sweep complete", {
      scanned: result.scanned,
      claimed: result.claimed,
      delivered: result.delivered,
      undelivered: result.undelivered,
    });

    return NextResponse.json({ data: result });
  } catch (err) {
    return handleApiError(err, { route: "/api/cron/reminders", method: "GET" });
  }
}

/**
 * `Authorization: Bearer ${CRON_SECRET}`, compared in constant time.
 *
 * An unset `CRON_SECRET` refuses every request. The alternative — treating a
 * missing secret as "no auth required" — would leave the endpoint wide open on
 * exactly the deploy where somebody forgot to configure it.
 */
function isAuthorisedCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    console.error(
      "[reminders] CRON_SECRET is not set — refusing every request",
    );
    return false;
  }

  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return false;

  return constantTimeEquals(header.slice("Bearer ".length), secret);
}

/**
 * Compare without leaking length or content through timing.
 *
 * `timingSafeEqual` throws on a length mismatch, which would itself be a signal,
 * so both sides are hashed to a fixed width first.
 */
function constantTimeEquals(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const left = Buffer.from(encoder.encode(a));
  const right = Buffer.from(encoder.encode(b));

  if (left.length !== right.length) {
    // Still burn a comparison so the early return is not measurably faster.
    timingSafeEqual(left, left);
    return false;
  }

  return timingSafeEqual(left, right);
}
