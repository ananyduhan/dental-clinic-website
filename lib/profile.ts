import bcrypt from "bcryptjs";

import { NotFoundError, ValidationError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import type {
  ChangePasswordInput,
  UpdateProfileInput,
} from "@/lib/validators/profile";

/** Matches `lib/accounts.ts` and the CLAUDE.md security checklist. */
const BCRYPT_ROUNDS = 12;

export type Profile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  emailVerified: boolean;
};

export async function getProfile(userId: string): Promise<Profile> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      emailVerified: true,
    },
  });

  if (!user) throw new NotFoundError("Account not found");
  return user;
}

/**
 * Update the fields a patient may change about themselves.
 *
 * Email is deliberately absent: changing it would orphan the verification state
 * and hand over an account-takeover primitive. The UI already renders it
 * disabled; this is the server side of the same rule.
 */
export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<Profile> {
  const data = {
    ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
    ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
    ...(input.phone !== undefined ? { phone: input.phone } : {}),
  };

  if (Object.keys(data).length === 0) return getProfile(userId);

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      emailVerified: true,
    },
  });

  return user;
}

/**
 * Change a password, verifying the current one first.
 *
 * The current-password check is what stops a stolen session from locking the
 * real owner out. A generic message on failure, so this is not a way to confirm
 * a guess against a hijacked session.
 */
export async function changePassword(
  userId: string,
  input: ChangePasswordInput,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true },
  });

  if (!user) throw new NotFoundError("Account not found");

  // A user created through a magic link has no password to compare against.
  if (!user.passwordHash) {
    throw new ValidationError(
      "This account has no password set. Use the reset link instead.",
    );
  }

  const matches = await bcrypt.compare(
    input.currentPassword,
    user.passwordHash,
  );
  if (!matches) {
    throw new ValidationError("Your current password is incorrect", {
      currentPassword: "Your current password is incorrect",
    });
  }

  if (await bcrypt.compare(input.newPassword, user.passwordHash)) {
    throw new ValidationError(
      "Your new password must be different from the current one",
      {
        newPassword: "Choose a password you have not used here before",
      },
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS) },
  });
}
