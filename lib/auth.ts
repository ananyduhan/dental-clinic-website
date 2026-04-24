import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validators/auth";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
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
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: Role }).role;
        token.firstName = (user as { firstName: string }).firstName;
        token.lastName = (user as { lastName: string }).lastName;
        token.isEmailVerified = (user as { isEmailVerified: boolean }).isEmailVerified;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as Role;
      session.user.firstName = token.firstName as string;
      session.user.lastName = token.lastName as string;
      session.user.isEmailVerified = token.isEmailVerified as boolean;
      return session;
    },
  },
});

export async function requireRole(...roles: Role[]) {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();
  if (!roles.includes(session.user.role as Role)) throw new ForbiddenError();
  return session;
}
