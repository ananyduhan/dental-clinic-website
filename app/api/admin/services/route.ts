import { NextResponse } from "next/server";

import { listServices } from "@/lib/admin/services";
import { requireRole } from "@/lib/auth";
import { handleApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/** GET /api/admin/services — includes retired services, unlike /api/services. */
export async function GET() {
  try {
    await requireRole("ADMIN");
    return NextResponse.json({ data: await listServices() });
  } catch (err) {
    return handleApiError(err, { route: "/api/admin/services", method: "GET" });
  }
}
