import { NextRequest, NextResponse } from "next/server";

import { blockDate, listBlockedDates } from "@/lib/admin/availability";
import { requireRole } from "@/lib/auth";
import { handleApiError, ValidationError } from "@/lib/errors";
import { createBlockedDateSchema } from "@/lib/validators/dentist";

export const dynamic = "force-dynamic";

/** GET /api/admin/blocked-dates?dentistId= */
export async function GET(req: NextRequest) {
  try {
    await requireRole("ADMIN", "DENTIST");

    const dentistId = req.nextUrl.searchParams.get("dentistId");
    if (!dentistId)
      throw new ValidationError("dentistId is required", {
        dentistId: "Required",
      });

    return NextResponse.json({ data: await listBlockedDates(dentistId) });
  } catch (err) {
    return handleApiError(err, {
      route: "/api/admin/blocked-dates",
      method: "GET",
    });
  }
}

/**
 * POST /api/admin/blocked-dates
 *
 * Blocking prevents new bookings; it never cancels existing ones. The count of
 * appointments already on that date comes back so the admin can deal with them.
 */
export async function POST(req: NextRequest) {
  try {
    await requireRole("ADMIN");

    const input = createBlockedDateSchema.parse(await req.json());
    const { blocked, clashingAppointments } = await blockDate(input);

    return NextResponse.json(
      { data: { ...blocked, clashingAppointments } },
      { status: 201 },
    );
  } catch (err) {
    return handleApiError(err, {
      route: "/api/admin/blocked-dates",
      method: "POST",
    });
  }
}
