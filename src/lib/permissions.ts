/**
 * Permission helpers — resolve effective permissions for a user.
 *
 * Resolution order:
 *   1. Start with role-level "allow" permissions.
 *   2. Remove any keys the user has a "deny" override for.
 *   3. Add any keys the user has an "allow" override for.
 *
 * Admins (Role.isAdmin === true) bypass this and have all permissions.
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Build the set of permission keys a user is effectively allowed to perform.
 *
 * Does NOT account for admin bypass — use `hasPermission` or `requirePermission`
 * for access checks that need admin short-circuiting.
 */
export async function getUserPermissions(userId: string): Promise<Set<string>> {
  // 1. Get the user (need their role key)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  const perms = new Set<string>();
  if (!user) return perms;

  // 2. Find the Role row for this user's role key
  const role = await prisma.role.findUnique({
    where: { key: user.role },
    select: { id: true },
  });

  if (role) {
    // Get all role-level "allow" permissions
    const roleAllows = await prisma.rolePermission.findMany({
      where: { roleId: role.id, effect: "allow" },
      select: { permissionKey: true },
    });
    for (const rp of roleAllows) {
      perms.add(rp.permissionKey);
    }
  }

  // 3. Get user overrides — remove "deny", add "allow"
  const userOverrides = await prisma.userPermission.findMany({
    where: { userId },
    select: { permissionKey: true, effect: true },
  });

  for (const override of userOverrides) {
    if (override.effect === "deny") {
      perms.delete(override.permissionKey);
    } else {
      perms.add(override.permissionKey);
    }
  }

  return perms;
}

/**
 * Check whether a user has a specific permission key.
 *
 * Does NOT short-circuit for admins — use `requirePermission` for route guards.
 */
export async function hasPermission(
  userId: string,
  permissionKey: string,
): Promise<boolean> {
  const perms = await getUserPermissions(userId);
  return perms.has(permissionKey);
}

/**
 * Route-guard helper: resolves the current session and checks whether the
 * signed-in user has the requested permission. Admins always pass.
 *
 * Returns `false` if there is no session or the user lacks the permission.
 */
export async function requirePermission(
  _req: Request,
  permissionKey: string,
): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;
  if (session.user.isAdmin) return true; // admins have all permissions
  return hasPermission(session.user.id, permissionKey);
}