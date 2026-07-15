/**
 * Migration script — seeds the permission catalog, role→permission assignments,
 * and agent profiles for the Leland Mills Company AI Assistant.
 *
 * This script:
 *   1. Seeds the Permission table with the default permission catalog
 *   2. Assigns ALL permissions to the admin role
 *   3. Assigns operations permissions to the staff role
 *   4. Assigns driver permissions to the driver role
 *   5. Seeds AgentProfile rows mapping Hermes profiles to Leland roles
 *
 * Usage:
 *   npx tsx scripts/migrate-permissions-skills.ts
 *
 * IMPORTANT: Run AFTER `npx prisma db push` but BEFORE `pm2 restart`.
 * This is idempotent — safe to run multiple times.
 */

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://localhost:5432/leland_mills";

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// ---------------------------------------------------------------------------
// Permission catalog — one entry per known permission key.
// ---------------------------------------------------------------------------
type PermissionSeed = {
  key: string;
  name: string;
  description: string;
  category: string;
};

const PERMISSIONS: PermissionSeed[] = [
  // People & HR
  { key: "employee_files:read", name: "Read Employee Files", description: "View employee documents and records", category: "People & HR" },
  { key: "employee_files:write", name: "Write Employee Files", description: "Create and update employee documents and records", category: "People & HR" },
  { key: "pay_rates:read", name: "Read Pay Rates", description: "View pay rate information for employees", category: "People & HR" },
  { key: "payroll:view", name: "View Payroll", description: "View payroll reports and summaries", category: "People & HR" },
  { key: "users:manage", name: "Manage Users", description: "Create, update, and delete user accounts", category: "People & HR" },

  // Administration
  { key: "roles:manage", name: "Manage Roles", description: "Create, update, and delete roles and role permissions", category: "Administration" },
  { key: "skills:manage", name: "Manage Skills", description: "Create, update, and assign skills to roles", category: "Administration" },
  { key: "settings:manage", name: "Manage Settings", description: "Edit application and system settings", category: "Administration" },
  { key: "agents:manage", name: "Manage Agent Profiles", description: "Create, update, and health-check Hermes agent profiles", category: "Administration" },

  // Operations
  { key: "inventory:read", name: "Read Inventory", description: "View inventory levels, feed types, and storage", category: "Operations" },
  { key: "inventory:write", name: "Write Inventory", description: "Update inventory levels and stock records", category: "Operations" },
  { key: "delivery:manage", name: "Manage Deliveries", description: "Schedule, dispatch, and track deliveries", category: "Operations" },
  { key: "routing:view", name: "View Routing", description: "View delivery routes and route plans", category: "Operations" },
  { key: "fleet:manage", name: "Manage Fleet", description: "Manage vehicle records, maintenance, and defects", category: "Operations" },
  { key: "scheduling:manage", name: "Manage Scheduling", description: "Create and manage staff and driver schedules", category: "Operations" },

  // Sales & Finance
  { key: "orders:view", name: "View Orders", description: "View customer orders and order history", category: "Sales & Finance" },
  { key: "orders:manage", name: "Manage Orders", description: "Create, update, and fulfill customer orders", category: "Sales & Finance" },
  { key: "customers:view", name: "View Customers", description: "View customer records and contact information", category: "Sales & Finance" },
  { key: "quotes:create", name: "Create Quotes", description: "Create and send customer quotes", category: "Sales & Finance" },
  { key: "margins:view", name: "View Margins", description: "View margin and profitability reports", category: "Sales & Finance" },
  { key: "invoicing:manage", name: "Manage Invoicing", description: "Create, send, and reconcile invoices", category: "Sales & Finance" },

  // Reporting
  { key: "reports:export", name: "Export Reports", description: "Export operational and financial reports", category: "Reporting" },
];

// ---------------------------------------------------------------------------
// Role → permission assignments
// ---------------------------------------------------------------------------
const ADMIN_PERMISSIONS = PERMISSIONS.map((p) => p.key);

const STAFF_PERMISSIONS = [
  "inventory:read",
  "inventory:write",
  "delivery:manage",
  "routing:view",
];

const DRIVER_PERMISSIONS = [
  "routing:view",
  "fleet:manage",
];

// ---------------------------------------------------------------------------
// Agent profile seeds — maps Hermes profiles to Leland roles
// ---------------------------------------------------------------------------
type AgentProfileSeed = {
  profileKey: string;
  name: string;
  description: string;
  roleKey: string;
  model?: string;
  provider?: string;
};

const AGENT_PROFILES: AgentProfileSeed[] = [
  {
    profileKey: "default",
    name: "Leland Admin Agent",
    description: "Default Hermes profile for Leland Mills with full admin access. Used for admin-role users.",
    roleKey: "admin",
    model: "gpt-5.2-mini",
    provider: "openai",
  },
  {
    profileKey: "leland-manager",
    name: "Leland Manager Agent",
    description: "Hermes profile for Leland Mills managers. Access to operations, sales, and reports.",
    roleKey: "staff",
    model: "gpt-5.2-mini",
    provider: "openai",
  },
  {
    profileKey: "leland-staff",
    name: "Leland Staff Agent",
    description: "Hermes profile for Leland Mills warehouse staff. Inventory, delivery, and safety focus.",
    roleKey: "staff",
    model: "gpt-5.2-mini",
    provider: "openai",
  },
  {
    profileKey: "leland-driver",
    name: "Leland Driver Agent",
    description: "Hermes profile for Leland Mills drivers. Pre-trip inspections, routes, and fleet focus.",
    roleKey: "driver",
    model: "gpt-5.2-mini",
    provider: "openai",
  },
];

async function seedPermissions(): Promise<void> {
  console.log("Step 1: Seeding Permission catalog...");

  let created = 0;
  let updated = 0;

  for (const perm of PERMISSIONS) {
    const existing = await prisma.permission.findUnique({
      where: { key: perm.key },
    });

    if (existing) {
      await prisma.permission.update({
        where: { key: perm.key },
        data: {
          name: perm.name,
          description: perm.description,
          category: perm.category,
        },
      });
      updated++;
    } else {
      await prisma.permission.create({
        data: {
          key: perm.key,
          name: perm.name,
          description: perm.description,
          category: perm.category,
        },
      });
      created++;
    }
  }

  console.log(`   ✅ Permissions: ${created} created, ${updated} updated (total ${PERMISSIONS.length})`);
}

async function assignRolePermissions(
  roleKey: string,
  permissionKeys: string[],
): Promise<void> {
  const role = await prisma.role.findUnique({ where: { key: roleKey } });
  if (!role) {
    console.warn(`   ⚠  Role "${roleKey}" not found — skipping permission assignment.`);
    return;
  }

  let assigned = 0;
  let skipped = 0;

  for (const permissionKey of permissionKeys) {
    // Verify the permission exists in the catalog
    const perm = await prisma.permission.findUnique({
      where: { key: permissionKey },
    });
    if (!perm) {
      console.warn(`   ⚠  Permission "${permissionKey}" not found in catalog — skipping.`);
      skipped++;
      continue;
    }

    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionKey: { roleId: role.id, permissionKey },
      },
      create: {
        roleId: role.id,
        permissionKey,
        effect: "allow",
      },
      update: {
        effect: "allow",
      },
    });
    assigned++;
  }

  console.log(`   ✅ Role "${roleKey}": ${assigned} permissions assigned${skipped ? `, ${skipped} skipped` : ""}`);
}

async function seedRolePermissions(): Promise<void> {
  console.log("\nStep 2: Assigning permissions to roles...");

  console.log("   Admin role (all permissions):");
  await assignRolePermissions("admin", ADMIN_PERMISSIONS);

  console.log("   Staff role (operations permissions):");
  await assignRolePermissions("staff", STAFF_PERMISSIONS);

  console.log("   Driver role (driver permissions):");
  await assignRolePermissions("driver", DRIVER_PERMISSIONS);
}

async function seedAgentProfiles(): Promise<void> {
  console.log("\nStep 3: Seeding AgentProfile rows...");

  let created = 0;
  let updated = 0;

  for (const profile of AGENT_PROFILES) {
    // Verify the target role exists
    const role = await prisma.role.findUnique({
      where: { key: profile.roleKey },
    });
    if (!role) {
      console.warn(`   ⚠  Role "${profile.roleKey}" not found for agent profile "${profile.profileKey}" — skipping.`);
      continue;
    }

    const existing = await prisma.agentProfile.findUnique({
      where: { profileKey: profile.profileKey },
    });

    if (existing) {
      await prisma.agentProfile.update({
        where: { profileKey: profile.profileKey },
        data: {
          name: profile.name,
          description: profile.description,
          roleKey: profile.roleKey,
          model: profile.model,
          provider: profile.provider,
        },
      });
      updated++;
    } else {
      await prisma.agentProfile.create({
        data: {
          profileKey: profile.profileKey,
          name: profile.name,
          description: profile.description,
          roleKey: profile.roleKey,
          model: profile.model,
          provider: profile.provider,
          status: "active",
        },
      });
      created++;
    }
  }

  console.log(`   ✅ Agent profiles: ${created} created, ${updated} updated (total ${AGENT_PROFILES.length})`);
}

async function main(): Promise<void> {
  console.log("🔄 Starting permissions, skills, and agent profile migration...\n");

  await seedPermissions();
  await seedRolePermissions();
  await seedAgentProfiles();

  console.log("\n✅ Migration complete!\n");
  console.log("Summary:");
  console.log(`  - Permissions seeded: ${PERMISSIONS.length}`);
  console.log(`  - Admin role permissions: ${ADMIN_PERMISSIONS.length}`);
  console.log(`  - Staff role permissions: ${STAFF_PERMISSIONS.length}`);
  console.log(`  - Driver role permissions: ${DRIVER_PERMISSIONS.length}`);
  console.log(`  - Agent profiles seeded: ${AGENT_PROFILES.length}`);
  console.log("\nNext steps:");
  console.log("  1. Restart the app: pm2 restart leland-app");
  console.log("  2. Verify in admin panel: /admin/permissions and /admin/agents");
}

main()
  .catch((err) => {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });