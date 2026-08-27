import { NextRequest, NextResponse } from "next/server";

import { requireRole } from "@/lib/auth";
import { handleApiError } from "@/lib/errors";
import { listPatients } from "@/lib/patients";
import { paginatedSearchSchema } from "@/lib/validators/common";

export const dynamic = "force-dynamic";

/** GET /api/admin/patients — searchable patient directory. */
export async function GET(req: NextRequest) {
  try {
    await requireRole("ADMIN", "DENTIST");

    const filters = paginatedSearchSchema.parse(
      Object.fromEntries(req.nextUrl.searchParams),
    );

    return NextResponse.json(await listPatients(filters));
  } catch (err) {
    return handleApiError(err, { route: "/api/admin/patients", method: "GET" });
  }
}
