/**
 * E2E: Mobile sidebar navigation.
 *
 * Tests the exact bug Jake reported: Settings button on mobile doesn't
 * navigate to the settings page because the sidebar overlay stays open.
 *
 * Covers:
 * 1. Settings button navigates to /admin/settings AND closes sidebar
 * 2. Usage & Limits button navigates to /admin/usage AND closes sidebar
 * 3. New Chat button navigates to /chat AND closes sidebar
 * 4. Conversation list item navigates to conversation AND closes sidebar
 * 5. Hamburger menu opens and closes correctly
 * 6. Sidebar overlay has backdrop that closes on tap
 */

import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "jake@lelandmills.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "changeme123";

async function loginOnMobile(page: import("@playwright/test").Page) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Username or Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/chat/, { timeout: 15000 });
}

// All tests use mobile viewport
test.use({ viewport: { width: 393, height: 851 } });

// Helper: check if the mobile sidebar overlay is visible
// The overlay is a div with class "fixed inset-0 bg-black/50 z-30 md:hidden"
async function sidebarIsOpen(page: import("@playwright/test").Page): Promise<boolean> {
  const overlay = page.locator("div.fixed.inset-0.z-30");
  return await overlay.isVisible().catch(() => false);
}

test.describe("Mobile sidebar navigation", () => {
  test.beforeEach(async ({ page }) => {
    await loginOnMobile(page);
  });

  test("hamburger menu opens sidebar", async ({ page }) => {
    const hamburger = page.getByLabel("Open sidebar");
    await expect(hamburger).toBeVisible();
    await hamburger.click();

    // Sidebar should be visible with New Chat button (use exact to avoid matching conversation titles)
    await expect(page.getByRole("button", { name: "New Chat", exact: true })).toBeVisible({ timeout: 5000 });
  });

  test("Settings button navigates to settings page and closes sidebar", async ({ page }) => {
    // Open sidebar
    await page.getByLabel("Open sidebar").click();
    await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeVisible({ timeout: 5000 });

    // Click Settings (exact match — conversation titles can contain "Settings")
    await page.getByRole("button", { name: "Settings", exact: true }).click();

    // Should be on settings page
    await expect(page).toHaveURL(/\/admin\/settings/, { timeout: 10000 });

    // Settings page heading should be visible (not covered by sidebar overlay)
    await expect(page.getByRole("heading", { name: "System Settings" })).toBeVisible({ timeout: 10000 });

    // The mobile overlay should be gone (sidebar closed)
    expect(await sidebarIsOpen(page)).toBe(false);
  });

  test("Usage & Limits button navigates to usage page and closes sidebar", async ({ page }) => {
    await page.getByLabel("Open sidebar").click();
    await expect(page.getByRole("button", { name: "Usage & Limits" })).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: "Usage & Limits" }).click();

    await expect(page).toHaveURL(/\/admin\/usage/, { timeout: 10000 });

    // Usage page should be visible, not covered by overlay
    expect(await sidebarIsOpen(page)).toBe(false);
  });

  test("New Chat button closes sidebar and stays on chat", async ({ page }) => {
    // Open sidebar
    await page.getByLabel("Open sidebar").click();
    await expect(page.getByRole("button", { name: "New Chat", exact: true })).toBeVisible({ timeout: 5000 });

    // Click New Chat
    await page.getByRole("button", { name: "New Chat", exact: true }).click();

    // Should still be on /chat
    await expect(page).toHaveURL(/\/chat/, { timeout: 5000 });

    // Empty state heading should be visible (sidebar closed)
    await expect(page.getByRole("heading", { name: "How can I help you today?" })).toBeVisible({ timeout: 10000 });
  });

  test("tapping backdrop closes sidebar without navigating", async ({ page }) => {
    await page.getByLabel("Open sidebar").click();
    await expect(page.getByRole("button", { name: "New Chat", exact: true })).toBeVisible({ timeout: 5000 });

    // Tap the backdrop overlay
    const overlay = page.locator("div.fixed.inset-0.z-30");
    await expect(overlay).toBeVisible();
    await overlay.click();

    // Overlay should be gone (sidebar closed)
    await expect(overlay).not.toBeVisible({ timeout: 5000 });

    // Still on chat page
    await expect(page).toHaveURL(/\/chat/);
  });

  test("conversation list item navigates to conversation and closes sidebar", async ({ page }) => {
    // First, send a message to create a conversation
    const input = page.getByPlaceholder("Type your message...");
    await input.fill("Test message for sidebar navigation");
    await input.press("Enter");
    await page.waitForTimeout(3000);

    // Open sidebar
    await page.getByLabel("Open sidebar").click();

    // Find the first conversation button in the list (not the New Chat button)
    const conversationItems = page.locator("li button");
    const firstConversation = conversationItems.first();
    await expect(firstConversation).toBeVisible({ timeout: 5000 });

    // Click it
    await firstConversation.click();

    // Should navigate to a conversation URL
    await expect(page).toHaveURL(/\/chat\//, { timeout: 10000 });

    // Sidebar should be closed
    expect(await sidebarIsOpen(page)).toBe(false);
  });
});

test.describe("Mobile sidebar — regression: Settings button (Bug: 2026-07-20)", () => {
  // This test explicitly guards against the regression where the Settings
  // button failed to close the mobile sidebar overlay, making it look like
  // the app reloaded the home page. Fixed by adding onClose?.() to the button handler.

  test.use({ viewport: { width: 393, height: 851 } });

  test("Settings button does not leave sidebar overlay open", async ({ page }) => {
    await loginOnMobile(page);

    // Open sidebar, click Settings
    await page.getByLabel("Open sidebar").click();
    await page.getByRole("button", { name: "Settings", exact: true }).click();

    // The critical assertion: the dark overlay must be gone
    // If onClose() is missing from the handler, this will fail
    const overlay = page.locator("div.fixed.inset-0.z-30");
    await expect(overlay).not.toBeVisible({ timeout: 10000 });

    // And we should see the settings page content
    await expect(page.getByRole("heading", { name: "System Settings" })).toBeVisible({ timeout: 10000 });
  });
});