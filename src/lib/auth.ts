import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { checkRateLimit, recordFailedAttempt, resetAttempts, getClientIp } from "@/lib/pin-rate-limiter";

/**
 * NextAuth v5 configuration for the Leland Mills AI Assistant.
 *
 * Authentication supports two flows:
 *   1. Email + password (for admin/staff roles)
 *   2. PIN code (for driver role — simple login on mobile devices)
 *
 * Sessions use JWT strategy (required for Credentials provider).
 *
 * Role details (display name, isAdmin flag) are loaded from the Role table
 * during sign-in and propagated to the JWT token and session.
 */

/**
 * Look up a Role by its key and return the display name and admin flag.
 * Falls back to safe defaults if the Role row doesn't exist (e.g. before migration).
 */
async function getRoleDetails(roleKey: string): Promise<{ name: string; isAdmin: boolean }> {
  const role = await prisma.role.findUnique({
    where: { key: roleKey },
    select: { name: true, isAdmin: true },
  });

  if (role) {
    return { name: role.name, isAdmin: role.isAdmin };
  }

  // Fallback for legacy uppercase values or missing Role rows
  const lowerKey = roleKey.toLowerCase();
  if (lowerKey === "admin") return { name: "Admin", isAdmin: true };
  if (lowerKey === "driver") return { name: "Driver", isAdmin: false };
  return { name: "Staff", isAdmin: false };
}

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
      async authorize(credentials, request) {
        // Flow 1: PIN code login (for drivers)
        if (credentials?.pinCode && !credentials?.email) {
          const pin = String(credentials.pinCode);

          // Rate limit: max 5 failed PIN attempts per IP per 15 minutes
          const ip = request ? getClientIp(request) : "unknown";
          const { locked, minutesRemaining } = checkRateLimit(ip);
          if (locked) {
            throw new Error(
              `Too many failed attempts. Try again in ${minutesRemaining} minute${minutesRemaining === 1 ? "" : "s"}.`,
            );
          }

          // Look up a user by their PIN code
          const users = await prisma.user.findMany();

          let authenticated = false;
          for (const user of users) {
            if (
              user.pinCode &&
              (await bcrypt.compare(pin, user.pinCode))
            ) {
              authenticated = true;
              await prisma.user.update({
                where: { id: user.id },
                data: { lastLogin: new Date() },
              });

              // Reset rate limiter on successful login
              resetAttempts(ip);

              const roleKey = user.role.toLowerCase();
              const { name: roleName, isAdmin } = await getRoleDetails(roleKey);

              return {
                id: user.id,
                email: user.email ?? undefined,
                name: user.name,
                role: roleKey,
                roleName,
                isAdmin,
              };
            }
          }

          // Record failed attempt
          recordFailedAttempt(ip);
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

          const roleKey = user.role.toLowerCase();
          const { name: roleName, isAdmin } = await getRoleDetails(roleKey);

          return {
            id: user.id,
            email: user.email ?? undefined,
            name: user.name,
            role: roleKey,
            roleName,
            isAdmin,
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
        token.role = user.role ?? "staff";
        token.roleName = user.roleName ?? "Staff";
        token.isAdmin = user.isAdmin ?? false;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.roleName = token.roleName as string;
        session.user.isAdmin = token.isAdmin as boolean;
      }
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);