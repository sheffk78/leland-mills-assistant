/**
 * NextAuth v5 type augmentation.
 *
 * Adds `role` (ADMIN | STAFF | DRIVER) and `id` to the User, Session, and JWT
 * types so they can be accessed type-safely without inline casts.
 *
 * The actual values are populated in src/lib/auth.ts (jwt and session callbacks).
 */

import type { DefaultSession } from "next-auth";
import type { Role } from "@/generated/prisma/enums";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: Role;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
  }
}