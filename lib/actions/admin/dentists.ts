"use server";

import { revalidatePath } from "next/cache";

import { runAction, type ActionResult } from "@/lib/action-result";
import {
  createDentist,
  deactivateDentist,
  updateDentist,
} from "@/lib/admin/dentists";
import { requireRole } from "@/lib/auth";
import {
  createDentistSchema,
  updateDentistSchema,
} from "@/lib/validators/dentist";

function revalidateDentistViews() {
  revalidatePath("/admin/dentists");
  revalidatePath("/book");
  revalidatePath("/");
}

export async function createDentistAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction("createDentistAction", async () => {
    await requireRole("ADMIN");

    const data = createDentistSchema.parse(input);
    const dentist = await createDentist(data);

    revalidateDentistViews();
    return { id: dentist.id };
  });
}

export async function updateDentistAction(
  dentistId: string,
  input: unknown,
): Promise<ActionResult<null>> {
  return runAction("updateDentistAction", async () => {
    await requireRole("ADMIN");

    const data = updateDentistSchema.parse(input);
    await updateDentist(dentistId, data);

    revalidateDentistViews();
    return null;
  });
}

export async function deactivateDentistAction(
  dentistId: string,
): Promise<ActionResult<{ upcomingAppointments: number }>> {
  return runAction("deactivateDentistAction", async () => {
    await requireRole("ADMIN");

    const { upcomingAppointments } = await deactivateDentist(dentistId);
    revalidateDentistViews();
    return { upcomingAppointments };
  });
}
