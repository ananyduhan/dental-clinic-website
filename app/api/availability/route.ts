import { NextRequest, NextResponse } from "next/server";

import { appointmentDateFromKey } from "@/lib/appointments";
import {
  getAvailableSlots,
  getAvailableSlotsAcrossDentists,
} from "@/lib/availability";
import { getActiveService } from "@/lib/catalogue";
import { handleApiError } from "@/lib/errors";
import { availabilityQuerySchema } from "@/lib/validators/appointment";

export const dynamic = "force-dynamic";

/**
 * GET /api/availability?date=&serviceId=&dentistId=
 *
 * `dentistId` omitted means "no preference": the response is the union across
 * every active dentist, each slot tagged with who can fill it.
 *
 * Public by design — slot availability is the same information the clinic
 * publishes on its own booking page, and requiring auth here would stop a
 * visitor seeing whether the clinic has room before creating an account.
 */
export async function GET(req: NextRequest) {
  try {
    const query = availabilityQuerySchema.parse({
      date: req.nextUrl.searchParams.get("date"),
      serviceId: req.nextUrl.searchParams.get("serviceId"),
      dentistId: req.nextUrl.searchParams.get("dentistId"),
    });

    // Resolves the duration and confirms the service is still offered.
    const service = await getActiveService(query.serviceId);
    const date = appointmentDateFromKey(query.date);

    const slots = query.dentistId
      ? await getAvailableSlots({
          dentistId: query.dentistId,
          date,
          serviceDurationMinutes: service.durationMinutes,
        })
      : await getAvailableSlotsAcrossDentists({
          date,
          serviceDurationMinutes: service.durationMinutes,
        });

    return NextResponse.json({
      data: slots.map((slot) => ({
        startTime: slot.startLocal,
        startUtc: slot.startUtc.toISOString(),
        endUtc: slot.endUtc.toISOString(),
        ...("dentistIds" in slot ? { dentistIds: slot.dentistIds } : {}),
      })),
    });
  } catch (err) {
    return handleApiError(err, { route: "/api/availability", method: "GET" });
  }
}
