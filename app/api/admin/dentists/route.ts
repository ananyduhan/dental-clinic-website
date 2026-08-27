import { NextResponse } from "next/server";

import { listDentists } from "@/lib/admin/dentists";
import { requireRole } from "@/lib/auth";
import { handleApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/** GET /api/admin/dentists — full records, including inactive ones. */
export async function GET() {
  try {
    await requireRole("ADMIN");
    return NextResponse.json({ data: await listDentists() });
  } catch (err) {
    return handleApiError(err, { route: "/api/admin/dentists", method: "GET" });
  }
}
