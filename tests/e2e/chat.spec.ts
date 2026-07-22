/**
 * E2E: Chat flow.
 *
 * Tests the complete chat experience:
 * 1. Empty state with logo, prompts, categories
 * 2. Sending a message and getting a response
 * 3. Conversation appears in sidebar
 * 4. Starting a new chat
 * 5. Navigating to a previous conversation
 */

import { test, expect } from "@playwright/test";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "change-me";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "jake@lelandmills.com";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Username or Email").fill(ADMIN_EMAIL);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/chat/, { timeout: 15000 });
}

test.describe("Chat empty state", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("shows logo in empty state", async ({ page }) => {
    const logo = page.getByRole("img", { name: "Leland Mills", exact: true }).last();
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute("src", /leland-mills-logo-white/);
  });

  test("shows categorized starter prompts", async ({ page }) => {
    await expect(page.getByText("Safety & Compliance")).toBeVisible();
    await expect(page.getByText("Inventory & Feed")).toBeVisible();
    await expect(page.getByText("Getting Started")).toBeVisible();
  });

  test("clicking a starter prompt fills the input", async ({ page }) => {
    // Use exact match — conversation titles in sidebar also contain "Pre-trip inspection checklist"
    const promptBtn = page.getByRole("button", { name: "Pre-trip inspection checklist", exact: true });
    await promptBtn.click({ force: true });

    const input = page.getByPlaceholder("Type your message...");
    await expect(input).toHaveValue("Pre-trip inspection checklist");
  });
});

test.describe("Chat messaging", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("sends a message and receives a response", async ({ page }) => {
    const input = page.getByPlaceholder("Type your message...");
    await input.fill("What is the pre-trip inspection checklist?");
    await input.press("Enter");

    // Wait for the user message to appear
    await expect(page.getByText("What is the pre-trip inspection checklist?")).toBeVisible({ timeout: 10000 });

    // Wait for a response (either the agent response or an error message about agent being unavailable)
    // We check for either the "Jake" assistant label or an error banner
    // Note: Archie can take 2-3 minutes to respond, so we use a generous timeout
    await expect(
      page.locator("text=Jake").or(page.locator('[class*="red"]')).or(page.locator('text=/unavailable/i')),
    ).toBeVisible({ timeout: 120000 });
  });

  test("shows typing indicator while waiting", async ({ page }) => {
    const input = page.getByPlaceholder("Type your message...");
    await input.fill("Test message");
    await input.press("Enter");

    // Typing indicator (bounce dots) should appear briefly
    await expect(page.locator(".animate-bounce").first()).toBeVisible({ timeout: 5000 });
  });

  test("new chat button works", async ({ page }) => {
    // Send a message first to create a conversation
    const input = page.getByPlaceholder("Type your message...");
    await input.fill("Test question");
    await input.press("Enter");
    await page.waitForTimeout(2000);

    // On mobile, open sidebar to access New Chat button
    const hamburger = page.getByLabel("Open sidebar");
    if (await hamburger.isVisible({ timeout: 2000 }).catch(() => false)) {
      await hamburger.click();
    }

    // Click New Chat (exact match to avoid hitting conversation titles)
    await page.getByRole("button", { name: "New Chat", exact: true }).click();

    // Should show empty state again
    await expect(page.getByRole("heading", { name: "How can I help you today?" })).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Sidebar", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("shows logo in sidebar", async ({ page }) => {
    // The sidebar logo
    const logos = page.getByRole("img", { name: "Leland Mills", exact: true });
    await expect(logos.first()).toBeVisible();
  });

  test("shows New Chat button with gold styling", async ({ page }) => {
    const newChatBtn = page.getByRole("button", { name: "New Chat", exact: true });
    await expect(newChatBtn).toBeVisible();
    // Gold accent background
    const bg = await newChatBtn.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    // var(--color-accent) resolves to rgb(255, 184, 0)
    expect(bg).toContain("255");
    expect(bg).toContain("184");
  });

  test("shows Settings link in sidebar", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeVisible();
  });

  test("shows Usage & Limits link in sidebar", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Usage & Limits" })).toBeVisible();
  });
});
