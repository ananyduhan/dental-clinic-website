import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";
import { loginSchema } from "@/lib/validators/auth";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";

/**
 * Sign-in rejections, in the only shape NextAuth understands.
 *
 * `authorize` may reject in exactly two ways: return `null`, or throw a
 * `CredentialsSignin`. Anything else it throws — including our own `AppError`
 * subclasses from `lib/errors.ts` — gets wrapped in `CallbackRouteError`, and
 * `isClientError` in @auth/core only whitelists Auth.js's own error types. The
 * client is then told `error=Configuration`, which is how every failed sign-in
 * (wrong password, unknown email, unverified address alike) came to show a
 * toast reading "Configuration" and nothing else.
 *
 * `code` is echoed into the redirect URL, so it must not narrow down which half
 * of the credentials was wrong — one shared code covers every bad-credential
 * case. `email_not_verified` is only reachable *after* a correct password, so
 * it tells an attacker nothing they did not already know.
 */
class InvalidCredentialsError extends CredentialsSignin {
  code = "invalid_credentials";
}

class EmailNotVerifiedError extends CredentialsSignin {
  code = "email_not_verified";
}

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
        if (!parsed.success) throw new InvalidCredentialsError();

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });

        if (!user || !user.passwordHash) throw new InvalidCredentialsError();

        const passwordValid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!passwordValid) throw new InvalidCredentialsError();

        if (!user.emailVerified) throw new EmailNotVerifiedError();

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
