/**
 * Seed script — creates an initial admin user.
 *
 * Usage:
 *   npx tsx scripts/seed-admin.ts
 *
 * Or with custom values:
 *   ADMIN_EMAIL=jake@lelandmills.com ADMIN_PASSWORD=yourpassword npx tsx scripts/seed-admin.ts
 *
 * TODO: Jake should run this after `npx prisma db push` to set up the first admin account.
 */

import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://localhost:5432/leland_mills";

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@lelandmills.com";
  const password = process.env.ADMIN_PASSWORD ?? "changeme123";
  const name = process.env.ADMIN_NAME ?? "Admin";

  // Check if admin already exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin user already exists: ${email}`);
    console.log("Updating password...");
    const hashed = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: existing.id },
      data: { password: hashed, role: "admin" },
    });
    console.log("Admin password updated.");
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      name,
      password: hashedPassword,
      role: "admin",
    },
  });

  console.log("✅ Admin user created:");
  console.log(`   Email: ${user.email}`);
  console.log(`   Name:  ${user.name}`);
  console.log(`   Role:  ${user.role}`);
  console.log(`   ID:    ${user.id}`);
  console.log("\n⚠  Change the password immediately after first login.");
}

main()
  .catch((err) => {
    console.error("Failed to seed admin user:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });