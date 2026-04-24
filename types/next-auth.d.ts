import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      firstName: string;
      lastName: string;
      isEmailVerified: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: Role;
    firstName: string;
    lastName: string;
    isEmailVerified: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    firstName: string;
    lastName: string;
    isEmailVerified: boolean;
  }
}
