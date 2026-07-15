/**
 * Migration script — converts from hardcoded Prisma Role enum to dynamic
 * database-driven roles.
 *
 * This script:
 *   1. Seeds the Role table with three system roles (admin, staff, driver)
 *      including their system prompts copied from the chat route
 *   2. Updates all existing User records: lowercase their role value
 *      (ADMIN → admin, STAFF → staff, DRIVER → driver)
 *
 * Usage:
 *   npx tsx scripts/migrate-roles.ts
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

// System prompts copied from the original src/app/api/chat/route.ts
// These are the exact prompts that were hardcoded for each role.
const SYSTEM_PROMPTS = {
  admin: `[Context: The user {name} is an ADMINISTRATOR with full access. You can help with: all operational tools, sales pipeline, financial summaries, HR policies, compliance, fleet management, strategic questions, and anything else related to running the business.]`,
  staff: `[Context: The user {name} is WAREHOUSE STAFF. Focus on: inventory management, feed types and storage, maintenance scheduling, delivery coordination, safety procedures, equipment operation. You can also help with basic sales lookups and customer delivery instructions.]`,
  driver: `[Context: The user {name} is a DRIVER. Focus on: pre-trip inspections, delivery instructions, DOT hours of service, route information, delivery notes, vehicle defects. Do not provide information about sales leads, financial data, HR matters, or admin functions unless directly safety-relevant.]`,
};

async function main() {
  console.log("🔄 Starting role migration...\n");

  // Step 1: Seed the Role table with system roles
  console.log("Step 1: Seeding Role table with system roles...");

  const systemRoles = [
    {
      key: "admin",
      name: "Admin",
      description: "Full access administrator with access to all tools and the admin panel",
      systemPrompt: SYSTEM_PROMPTS.admin,
      isAdmin: true,
      isSystem: true,
    },
    {
      key: "staff",
      name: "Staff",
      description: "Warehouse staff with access to inventory, delivery coordination, and safety tools",
      systemPrompt: SYSTEM_PROMPTS.staff,
      isAdmin: false,
      isSystem: true,
    },
    {
      key: "driver",
      name: "Driver",
      description: "Driver with access to pre-trip inspections, delivery instructions, and route information",
      systemPrompt: SYSTEM_PROMPTS.driver,
      isAdmin: false,
      isSystem: true,
    },
  ];

  for (const roleData of systemRoles) {
    const existing = await prisma.role.findUnique({
      where: { key: roleData.key },
    });

    if (existing) {
      // Update existing role (in case prompts changed)
      await prisma.role.update({
        where: { key: roleData.key },
        data: {
          name: roleData.name,
          description: roleData.description,
          systemPrompt: roleData.systemPrompt,
          isAdmin: roleData.isAdmin,
          isSystem: roleData.isSystem,
        },
      });
      console.log(`   ✅ Updated existing role: ${roleData.key} (${roleData.name})`);
    } else {
      await prisma.role.create({
        data: roleData,
      });
      console.log(`   ✅ Created role: ${roleData.key} (${roleData.name})`);
    }
  }

  console.log();

  // Step 2: Update all existing User records to lowercase role values
  console.log("Step 2: Lowercasing user role values...");

  // Fetch all users and update their role to lowercase
  const users = await prisma.user.findMany({
    select: { id: true, name: true, role: true },
  });

  let updatedCount = 0;
  for (const user of users) {
    const lowerRole = user.role.toLowerCase();
    if (user.role !== lowerRole) {
      await prisma.user.update({
        where: { id: user.id },
        data: { role: lowerRole },
      });
      console.log(`   ✅ Updated user "${user.name}": ${user.role} → ${lowerRole}`);
      updatedCount++;
    }
  }

  if (updatedCount === 0) {
    console.log("   ℹ  All user roles are already lowercase.");
  } else {
    console.log(`   ✅ Updated ${updatedCount} user(s).`);
  }

  // Step 3: Also lowercase UsageLog role values
  console.log("\nStep 3: Lowercasing UsageLog role values...");

  const logs = await prisma.usageLog.findMany({
    select: { id: true, role: true },
  });

  let logUpdatedCount = 0;
  for (const log of logs) {
    const lowerRole = (log.role as string).toLowerCase();
    if (log.role !== lowerRole) {
      await prisma.usageLog.update({
        where: { id: log.id },
        data: { role: lowerRole },
      });
      logUpdatedCount++;
    }
  }

  if (logUpdatedCount === 0) {
    console.log("   ℹ  All usage log roles are already lowercase.");
  } else {
    console.log(`   ✅ Updated ${logUpdatedCount} usage log(s).`);
  }

  // Step 4: Migrate UsageLimit PK from uppercase to lowercase
  console.log("\nStep 4: Lowercasing UsageLimit role keys...");

  const limits = await prisma.usageLimit.findMany();
  for (const limit of limits) {
    const lowerRole = (limit.role as string).toLowerCase();
    if (limit.role !== lowerRole) {
      // Delete old + create new (since role is PK)
      await prisma.usageLimit.delete({ where: { role: limit.role } });
      await prisma.usageLimit.create({
        data: {
          role: lowerRole,
          hourlyLimit: limit.hourlyLimit,
          dailyLimit: limit.dailyLimit,
          monthlyLimit: limit.monthlyLimit,
        },
      });
      console.log(`   ✅ Migrated usage limit: ${limit.role} → ${lowerRole}`);
    }
  }

  console.log("\n✅ Migration complete!\n");
  console.log("Summary:");
  console.log(`  - System roles seeded: ${systemRoles.length}`);
  console.log(`  - Users updated: ${updatedCount}`);
  console.log(`  - Usage logs updated: ${logUpdatedCount}`);
  console.log("\nNext steps:");
  console.log("  1. Restart the app: pm2 restart archie");
  console.log("  2. Verify in admin panel: /admin/roles");
}

main()
  .catch((err) => {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });