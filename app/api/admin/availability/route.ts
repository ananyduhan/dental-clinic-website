import { NextRequest, NextResponse } from "next/server";

import { getAvailability, setAvailability } from "@/lib/admin/availability";
import { requireRole } from "@/lib/auth";
import { handleApiError, ValidationError } from "@/lib/errors";
import { updateAvailabilitySchema } from "@/lib/validators/dentist";

export const dynamic = "force-dynamic";

function dentistIdFrom(req: NextRequest): string {
  const dentistId = req.nextUrl.searchParams.get("dentistId");
  if (!dentistId)
    throw new ValidationError("dentistId is required", {
      dentistId: "Required",
    });
  return dentistId;
}

/** GET /api/admin/availability?dentistId= — a dentist's weekly roster. */
export async function GET(req: NextRequest) {
  try {
    await requireRole("ADMIN", "DENTIST");
    return NextResponse.json({
      data: await getAvailability(dentistIdFrom(req)),
    });
  } catch (err) {
    return handleApiError(err, {
      route: "/api/admin/availability",
      method: "GET",
    });
  }
}

/** PUT /api/admin/availability?dentistId= — replace the whole roster. */
export async function PUT(req: NextRequest) {
  try {
    await requireRole("ADMIN");

    const input = updateAvailabilitySchema.parse(await req.json());
    const availability = await setAvailability(dentistIdFrom(req), input);

    return NextResponse.json({ data: availability });
  } catch (err) {
    return handleApiError(err, {
      route: "/api/admin/availability",
      method: "PUT",
    });
  }
}
