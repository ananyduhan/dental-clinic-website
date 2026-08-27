"use server";

import { revalidatePath } from "next/cache";

import { runAction, type ActionResult } from "@/lib/action-result";
import { auth } from "@/lib/auth";
import { UnauthorizedError } from "@/lib/errors";
import { changePassword, updateProfile, type Profile } from "@/lib/profile";
import {
  changePasswordSchema,
  updateProfileSchema,
} from "@/lib/validators/profile";

export async function updateMyProfile(
  input: unknown,
): Promise<ActionResult<Profile>> {
  return runAction("updateMyProfile", async () => {
    const session = await auth();
    if (!session?.user?.id) throw new UnauthorizedError();

    const data = updateProfileSchema.parse(input);
    const profile = await updateProfile(session.user.id, data);

    revalidatePath("/profile");
    return profile;
  });
}

export async function changeMyPassword(
  input: unknown,
): Promise<ActionResult<null>> {
  return runAction("changeMyPassword", async () => {
    const session = await auth();
    if (!session?.user?.id) throw new UnauthorizedError();

    const data = changePasswordSchema.parse(input);
    await changePassword(session.user.id, data);

    return null;
  });
}
