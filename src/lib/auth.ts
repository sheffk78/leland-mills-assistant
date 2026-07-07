import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import type { Role } from "@/generated/prisma/enums";

/**
 * NextAuth v5 configuration for the Leland Mills AI Assistant.
 *
 * Authentication supports two flows:
 *   1. Email + password (for ADMIN and STAFF roles)
 *   2. PIN code (for DRIVER role — simple login on mobile devices)
 *
 * Sessions use JWT strategy (required for Credentials provider).
 */

export const authConfig: NextAuthConfig = {
  trustHost: true,
  providers: [
    Credentials({
      id: "credentials",
      name: "Leland Mills Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        pinCode: { label: "PIN Code", type: "text" },
      },
      async authorize(credentials) {
        // Flow 1: PIN code login (for drivers)
        if (credentials?.pinCode && !credentials?.email) {
          const pin = String(credentials.pinCode);

          // Look up a user by their PIN code
          // TODO: For production, add rate limiting on PIN attempts
          const users = await prisma.user.findMany();

          for (const user of users) {
            if (
              user.pinCode &&
              (await bcrypt.compare(pin, user.pinCode))
            ) {
              await prisma.user.update({
                where: { id: user.id },
                data: { lastLogin: new Date() },
              });
              return {
                id: user.id,
                email: user.email ?? undefined,
                name: user.name,
                role: user.role,
              };
            }
          }
          return null;
        }

        // Flow 2: Email/username + password login (for admin/staff)
        if (credentials?.email && credentials?.password) {
          const loginInput = String(credentials.email).trim();
          const password = String(credentials.password);

          // Try looking up by email first, then by username
          let user = await prisma.user.findUnique({
            where: { email: loginInput },
          });

          if (!user) {
            user = await prisma.user.findUnique({
              where: { username: loginInput },
            });
          }

          if (!user || !user.password) {
            return null;
          }

          const valid = await bcrypt.compare(password, user.password);
          if (!valid) {
            return null;
          }

          await prisma.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() },
          });

          return {
            id: user.id,
            email: user.email ?? undefined,
            name: user.name,
            role: user.role,
          };
        }

        return null;
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role ?? "STAFF";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);