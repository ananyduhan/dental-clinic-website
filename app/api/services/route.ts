import { NextResponse } from "next/server";

import { listActiveServices } from "@/lib/catalogue";
import { handleApiError } from "@/lib/errors";

/** Reads the database on every request; never prerender it. */
export const dynamic = "force-dynamic";

/** GET /api/services — public list of bookable services. */
export async function GET() {
  try {
    return NextResponse.json({ data: await listActiveServices() });
  } catch (err) {
    return handleApiError(err, { route: "/api/services", method: "GET" });
  }
}
