/**
 * E2E: Login flow.
 *
 * Tests the complete login experience against the live app:
 * 1. Login page renders correctly with branding
 * 2. Staff login with email/password works
 * 3. Invalid credentials show error
 * 4. Redirect after login lands on chat page
 * 5. Unauthenticated chat access redirects to login
 */

import { test, expect } from "@playwright/test";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "change-me";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "jake@lelandmills.com";

test.describe("Login page", () => {
  test("renders logo and hero image", async ({ page }) => {
    await page.goto("/login");

    // Logo image (gold background with white logo)
    const logo = page.getByRole("img", { name: "Leland Mills", exact: true });
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute("src", /leland-mills-logo-white/);

    // Hero image — Leland Mills facility
    const hero = page.getByAltText("Leland Milling Company facility");
    await expect(hero).toBeVisible();
  });

  test("shows AI Assistant heading and description", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "AI Assistant" })).toBeVisible();
    await expect(page.getByText(/truck inspections, feed inventory/i)).toBeVisible();
  });

  test("has Staff and Driver login tabs", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Staff Login" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Driver Login" })).toBeVisible();
  });

  test("defaults to Staff Login with email + password fields", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
  });

  test("Driver Login tab shows PIN code field", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Driver Login" }).click();
    await expect(page.getByLabel("PIN Code")).toBeVisible();
    await expect(page.getByLabel("Email")).not.toBeVisible();
  });

  test("shows error for invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Username or Email").fill("wrong@lelandmills.com");
    await page.getByLabel("Password").fill("wrongpassword");
    await page.getByRole("button", { name: "Sign In" }).click();

    await expect(page.getByText(/Invalid username\/email or password/i)).toBeVisible({ timeout: 10000 });
  });

  test("shows First time here? onboarding section", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "First time here?" })).toBeVisible();
    await expect(page.getByText(/Truck pre-trip and post-trip/i)).toBeVisible();
  });

  test("shows heritage tagline", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Leland Mills Feed Company")).toBeVisible();
    await expect(page.getByText("Fresh Feed Milled Daily Since 1898")).toBeVisible();
  });
});

test.describe("Login flow", () => {
  test("staff login redirects to chat page", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Username or Email").fill(ADMIN_EMAIL);
    await page.getByRole("button", { name: "Sign In" }).click();

    // Should redirect to /chat
    await expect(page).toHaveURL(/\/chat/, { timeout: 15000 });

    // Chat page should show the empty state
    await expect(page.getByRole("heading", { name: "How can I help you today?" })).toBeVisible({ timeout: 10000 });
  });

  test("unauthenticated /chat access redirects to login", async ({ page }) => {
    // Clear any existing session
    await page.context().clearCookies();
    await page.goto("/chat");

    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test("unauthenticated /admin access redirects to login", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/admin");

    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});
