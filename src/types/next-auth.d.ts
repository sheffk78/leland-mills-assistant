/**
 * NextAuth v5 type augmentation.
 *
 * Adds `role` (string key), `roleName` (display name), `isAdmin` (boolean),
 * and `id` to the User, Session, and JWT types so they can be accessed
 * type-safely without inline casts.
 *
 * The actual values are populated in src/lib/auth.ts (jwt and session callbacks).
 * Role details are loaded from the Role table in the database.
 */

import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;       // Role.key — e.g. "admin", "staff", "driver"
      roleName: string;   // Role.name — display name, e.g. "Admin"
      isAdmin: boolean;   // Role.isAdmin — whether this role has admin panel access
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: string;
    roleName?: string;
    isAdmin?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    roleName: string;
    isAdmin: boolean;
  }
}