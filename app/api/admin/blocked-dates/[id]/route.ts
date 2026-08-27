import { NextRequest, NextResponse } from "next/server";

import { unblockDate } from "@/lib/admin/availability";
import { requireRole } from "@/lib/auth";
import { handleApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/** DELETE /api/admin/blocked-dates/:id */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await requireRole("ADMIN");
    await unblockDate(params.id);

    return NextResponse.json({ data: null });
  } catch (err) {
    return handleApiError(err, {
      route: "/api/admin/blocked-dates/[id]",
      method: "DELETE",
    });
  }
}
