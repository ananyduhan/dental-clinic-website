import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

import type { Actor } from "./transition";

/**
 * Turn a session into an `Actor` the domain can reason about.
 *
 * The JWT carries a role and a user id but not a `Dentist.id`, and every
 * dentist rule is scoped to their own appointments — so that one lookup has to
 * happen somewhere. Doing it here means no caller can forget it and
 * accidentally hand the state machine a dentist actor with no scope.
 */
export async function resolveActor(session: {
  user?: { id?: string; role?: string } | null;
}): Promise<Actor> {
  const user = session.user;
  if (!user?.id || !user.role) throw new UnauthorizedError();

  switch (user.role) {
    case "ADMIN":
      return { role: "ADMIN", userId: user.id };

    case "PATIENT":
      return { role: "PATIENT", userId: user.id };

    case "DENTIST": {
      const dentist = await prisma.dentist.findUnique({
        where: { userId: user.id },
        select: { id: true, isActive: true },
      });
      // A DENTIST role with no dentist row, or a deactivated one, is a broken
      // account rather than an authorization near-miss. Refuse it outright.
      if (!dentist || !dentist.isActive) {
        throw new ForbiddenError("This dentist account is not active");
      }
      return { role: "DENTIST", userId: user.id, dentistId: dentist.id };
    }

    default:
      throw new ForbiddenError();
  }
}
