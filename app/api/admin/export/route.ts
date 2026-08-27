import { NextRequest } from "next/server";

import { appointmentDateFromKey } from "@/lib/appointments";
import { requireRole } from "@/lib/auth";
import { handleApiError } from "@/lib/errors";
import { buildAppointmentWorkbook, workbookToBuffer } from "@/lib/export";
import { prisma } from "@/lib/prisma";
import { exportFiltersSchema } from "@/lib/validators/appointment";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/export?from=&to=&dentistId=&status= — .xlsx download.
 *
 * A route handler rather than a Server Action because it returns a file:
 * actions cannot stream a binary body with content-disposition.
 *
 * ADMIN only. A dentist has a legitimate view of their own schedule in the UI,
 * but a spreadsheet of patient names and phone numbers leaving the building is
 * a different question, and `docs/api-conventions.md` scopes this to admins.
 */
export async function GET(req: NextRequest) {
  try {
    await requireRole("ADMIN");

    const filters = exportFiltersSchema.parse({
      from: req.nextUrl.searchParams.get("from"),
      to: req.nextUrl.searchParams.get("to"),
      dentistId: req.nextUrl.searchParams.get("dentistId"),
      status: req.nextUrl.searchParams.get("status"),
    });

    const appointments = await prisma.appointment.findMany({
      where: {
        appointmentDate: {
          gte: appointmentDateFromKey(filters.from),
          lte: appointmentDateFromKey(filters.to),
        },
        ...(filters.dentistId ? { dentistId: filters.dentistId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        dentist: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        service: true,
      },
      orderBy: [{ appointmentDate: "asc" }, { startTime: "asc" }],
    });

    const buffer = workbookToBuffer(buildAppointmentWorkbook(appointments));

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="appointments-${filters.from}-to-${filters.to}.xlsx"`,
        // Patient data — never let a proxy or the browser keep a copy.
        "Cache-Control": "no-store, private",
      },
    });
  } catch (err) {
    return handleApiError(err, { route: "/api/admin/export", method: "GET" });
  }
}
