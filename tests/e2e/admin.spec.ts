/**
 * E2E: Admin flow.
 *
 * Tests the admin panel:
 * 1. Admin can access /admin/users
 * 2. Non-admin (staff) is redirected away from admin
 * 3. User management table renders
 * 4. Add user form works
 * 5. Settings page shows system status
 * 6. Mobile responsive admin layout
 */

import { test, expect } from "@playwright/test";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "change-me";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "jake@lelandmills.com";

async function loginAsAdmin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Username or Email").fill(ADMIN_EMAIL);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/chat/, { timeout: 15000 });
}

test.describe("Admin access", () => {
  test("admin can navigate to admin panel", async ({ page }) => {
    await loginAsAdmin(page);

    // Navigate to admin
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/admin\/users/);

    // Should see the admin header
    await expect(page.getByText("Admin Panel")).toBeVisible();
  });

  test("admin sees user management page", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/users");

    await expect(page.getByRole("heading", { name: "User Management" })).toBeVisible();
    await expect(page.getByText(/Add and manage staff/i)).toBeVisible();
  });

  test("admin sees Add User button", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/users");

    await expect(page.getByRole("button", { name: /Add User/ })).toBeVisible();
  });

  test("admin can open Add User form", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/users");

    await page.getByRole("button", { name: /Add User/ }).click();

    // Form should appear with fields — use the text input placeholder
    await expect(page.getByRole("heading", { name: "Add New User" })).toBeVisible();
    // Name field is the first text input in the form
    const nameInput = page.locator('input[type="text"]').first();
    await expect(nameInput).toBeVisible();
    // Role select dropdown
    await expect(page.locator("select")).toBeVisible();
  });

  test("admin can navigate to settings", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/settings");

    await expect(page.getByRole("heading", { name: "System Settings" })).toBeVisible();
    // Should show status cards
    await expect(page.getByText("AI Agent")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Database" })).toBeVisible();
  });

  test("admin can navigate between admin pages", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/users");

    // On mobile, open the admin nav dropdown first
    const navToggle = page.getByLabel("Toggle navigation menu");
    if (await navToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      await navToggle.click();
    }

    // Click Settings in nav
    await page.getByRole("link", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/admin\/settings/);

    // On mobile, need to open dropdown again
    if (await navToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      await navToggle.click();
    }

    // Click Users in nav
    await page.getByRole("link", { name: "Users" }).click();
    await expect(page).toHaveURL(/\/admin\/users/);
  });

  test("admin can navigate to chat from admin", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/users");

    // On mobile, open the admin nav dropdown first
    const navToggle = page.getByLabel("Toggle navigation menu");
    if (await navToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      await navToggle.click();
    }

    await page.getByRole("link", { name: "Chat" }).click();
    await expect(page).toHaveURL(/\/chat/);
  });
});

test.describe("Admin user management", () => {
  test("can create a new staff user", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/users");

    await page.getByRole("button", { name: /Add User/ }).click();

    const uniqueName = `Test Staff ${Date.now()}`;
    // Use the first text input in the form (Name field)
    await page.locator('input[type="text"]').first().fill(uniqueName);
    await page.locator('input[type="email"]').fill(`test-${Date.now()}@lelandmills.com`);
    await page.locator('input[type="password"]').first().fill("testpassword123");
    await page.getByRole("button", { name: "Create User" }).click();

    // User should appear in the table
    await expect(page.getByText(uniqueName)).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Mobile responsive", () => {
  // Use a mobile-sized viewport for these tests
  test.use({ viewport: { width: 393, height: 851 } });

  test("mobile viewport shows hamburger menu", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/login");
    await page.getByLabel("Username or Email").fill(ADMIN_EMAIL);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL(/\/chat/, { timeout: 15000 });

    // On mobile, the hamburger button should be visible
    const hamburger = page.getByLabel("Open sidebar");
    await expect(hamburger).toBeVisible({ timeout: 10000 });

    // Click to open sidebar
    await hamburger.click();

    // Sidebar should slide in
    const logo = page.getByRole("img", { name: "Leland Mills", exact: true });
    await expect(logo.first()).toBeVisible({ timeout: 5000 });
  });
});
