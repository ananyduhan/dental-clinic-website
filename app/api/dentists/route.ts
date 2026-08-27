import { NextResponse } from "next/server";

import { listActiveDentists } from "@/lib/catalogue";
import { handleApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/dentists — public list of practising dentists.
 *
 * Selects only publishable fields; the underlying `user` row carries an email
 * and phone number and neither is exposed.
 */
export async function GET() {
  try {
    return NextResponse.json({ data: await listActiveDentists() });
  } catch (err) {
    return handleApiError(err, { route: "/api/dentists", method: "GET" });
  }
}
