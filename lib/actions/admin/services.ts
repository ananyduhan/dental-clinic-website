"use server";

import { revalidatePath } from "next/cache";

import { runAction, type ActionResult } from "@/lib/action-result";
import {
  assertServiceNameFree,
  createService,
  deactivateService,
  updateService,
} from "@/lib/admin/services";
import { requireRole } from "@/lib/auth";
import {
  createServiceSchema,
  updateServiceSchema,
} from "@/lib/validators/service";

function revalidateServiceViews() {
  revalidatePath("/admin/services");
  revalidatePath("/book");
  revalidatePath("/");
}

export async function createServiceAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction("createServiceAction", async () => {
    await requireRole("ADMIN");

    const data = createServiceSchema.parse(input);
    await assertServiceNameFree(data.name);

    const service = await createService(data);
    revalidateServiceViews();
    return { id: service.id };
  });
}

export async function updateServiceAction(
  serviceId: string,
  input: unknown,
): Promise<ActionResult<null>> {
  return runAction("updateServiceAction", async () => {
    await requireRole("ADMIN");

    const data = updateServiceSchema.parse(input);
    if (data.name) await assertServiceNameFree(data.name, serviceId);

    await updateService(serviceId, data);
    revalidateServiceViews();
    return null;
  });
}

/** Deactivates rather than deletes; reports what is still booked against it. */
export async function deactivateServiceAction(
  serviceId: string,
): Promise<ActionResult<{ upcomingAppointments: number }>> {
  return runAction("deactivateServiceAction", async () => {
    await requireRole("ADMIN");

    const { upcomingAppointments } = await deactivateService(serviceId);
    revalidateServiceViews();
    return { upcomingAppointments };
  });
}
