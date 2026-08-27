"use server";

import { revalidatePath } from "next/cache";

import { runAction, type ActionResult } from "@/lib/action-result";
import {
  blockDate,
  setAvailability,
  unblockDate,
} from "@/lib/admin/availability";
import { requireRole } from "@/lib/auth";
import {
  createBlockedDateSchema,
  updateAvailabilitySchema,
} from "@/lib/validators/dentist";

function revalidateScheduleViews() {
  revalidatePath("/admin/dentists");
  revalidatePath("/book");
}

export async function setAvailabilityAction(
  dentistId: string,
  input: unknown,
): Promise<ActionResult<null>> {
  return runAction("setAvailabilityAction", async () => {
    await requireRole("ADMIN");

    const data = updateAvailabilitySchema.parse(input);
    await setAvailability(dentistId, data);

    revalidateScheduleViews();
    return null;
  });
}

/**
 * Block a date. Returns how many appointments already sit on it — blocking
 * does not cancel them, so the admin needs to know they are there.
 */
export async function blockDateAction(
  input: unknown,
): Promise<ActionResult<{ clashingAppointments: number }>> {
  return runAction("blockDateAction", async () => {
    await requireRole("ADMIN");

    const data = createBlockedDateSchema.parse(input);
    const { clashingAppointments } = await blockDate(data);

    revalidateScheduleViews();
    return { clashingAppointments };
  });
}

export async function unblockDateAction(
  blockedDateId: string,
): Promise<ActionResult<null>> {
  return runAction("unblockDateAction", async () => {
    await requireRole("ADMIN");

    await unblockDate(blockedDateId);
    revalidateScheduleViews();
    return null;
  });
}
