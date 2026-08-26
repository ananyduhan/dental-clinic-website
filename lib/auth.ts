import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";
import { loginSchema } from "@/lib/validators/auth";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";

/**
 * Node-runtime NextAuth instance: edge-safe `authConfig` plus the Credentials
 * provider, which needs Prisma and bcrypt and therefore cannot run on the edge.
 *
 * Import this from route handlers, server components, and server actions.
 * `middleware.ts` deliberately imports `lib/auth.config.ts` instead.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) throw new UnauthorizedError("Invalid credentials");

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });

        if (!user || !user.passwordHash) throw new UnauthorizedError("Invalid credentials");

        const passwordValid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!passwordValid) throw new UnauthorizedError("Invalid credentials");

        if (!user.emailVerified) throw new ForbiddenError("Please verify your email before logging in");

        return {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isEmailVerified: user.emailVerified,
        };
      },
    }),
  ],
  // `callbacks` (jwt, session) live in lib/auth.config.ts so middleware shares
  // exactly the same token shape. Do not redeclare them here — spreading
  // authConfig above already supplies them, and a duplicate key would silently
  // win over the shared one.
});

export async function requireRole(...roles: Role[]) {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();
  if (!roles.includes(session.user.role as Role)) throw new ForbiddenError();
  return session;
}
