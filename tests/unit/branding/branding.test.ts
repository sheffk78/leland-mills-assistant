/**
 * Branding & visual asset tests.
 *
 * Verifies that:
 * 1. The correct logo file (full text logo, not icon-only) exists and is used
 * 2. Real lelandmills.com product images are present in public/
 * 3. CSS color variables match lelandmills.com's theme
 * 4. No black background boxes around the logo (the old wrong approach)
 * 5. Source code references the correct logo file
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, statSync } from "fs";
import { join } from "path";

const PUBLIC_DIR = join(process.cwd(), "public");
const SRC_DIR = join(process.cwd(), "src");

function readFile(path: string): string {
  return readFileSync(path, "utf-8");
}

function fileExists(path: string): boolean {
  try {
    return existsSync(path);
  } catch {
    return false;
  }
}

describe("Logo assets", () => {
  it("has the full text logo from lelandmills.com (not icon-only)", () => {
    const logoPath = join(PUBLIC_DIR, "leland-mills-full-logo-black-white.png");
    expect(fileExists(logoPath), "leland-mills-full-logo-black-white.png must exist").toBe(true);

    const stats = statSync(logoPath);
    // The real logo is 1600x372 — much wider than tall (it has text)
    expect(stats.size).toBeGreaterThan(10000); // At least 10KB
  });

  it("the old icon-only logo is not used as the primary logo", () => {
    // leland-mills-official-logo.png was the icon-only mark — it should NOT be
    // referenced in any component source files
    const componentFiles = [
      "src/components/LoginForm.tsx",
      "src/components/Sidebar.tsx",
      "src/components/ChatInterface.tsx",
      "src/app/chat/page.tsx",
    ];

    for (const file of componentFiles) {
      const content = readFile(join(process.cwd(), file));
      expect(
        content,
        `${file} should not reference the icon-only logo`,
      ).not.toContain("leland-mills-official-logo.png");
    }
  });

  it("all component files reference the full text logo", () => {
    const componentFiles = [
      "src/components/LoginForm.tsx",
      "src/components/Sidebar.tsx",
      "src/components/ChatInterface.tsx",
      "src/app/chat/page.tsx",
    ];

    for (const file of componentFiles) {
      const content = readFile(join(process.cwd(), file));
      expect(
        content,
        `${file} should reference leland-mills-full-logo-black-white.png`,
      ).toContain("leland-mills-full-logo-black-white.png");
    }
  });
});

describe("Brand images from lelandmills.com", () => {
  it("has real product images downloaded from lelandmills.com CDN", () => {
    const expectedImages = [
      "lm-feed-bags-garden.png",
      "lm-feed-bags-lawn.png",
      "lm-chicken-feed.png",
      "lm-cattle-feed.png",
      "lm-horse-feed.png",
      "lm-poultry-feed.jpg",
    ];

    for (const img of expectedImages) {
      const path = join(PUBLIC_DIR, img);
      expect(fileExists(path), `${img} should exist in public/`).toBe(true);
    }
  });

  it("login page uses a real feed bag image as hero", () => {
    const loginForm = readFile(join(SRC_DIR, "components/LoginForm.tsx"));
    expect(loginForm).toContain("lm-feed-bags-garden.png");
    // Should NOT be using the old building image
    expect(loginForm).not.toContain("leland-mill-building.jpg");
  });
});

describe("CSS color scheme matches lelandmills.com", () => {
  it("uses gold (#FFB800) as the accent color", () => {
    const css = readFile(join(SRC_DIR, "app/globals.css"));
    expect(css).toContain("#FFB800");
  });

  it("uses warm cream (#f7f6f4) as the background", () => {
    const css = readFile(join(SRC_DIR, "app/globals.css"));
    expect(css).toContain("#f7f6f4");
  });

  it("uses dark blue-gray (#222831) for foreground text", () => {
    const css = readFile(join(SRC_DIR, "app/globals.css"));
    expect(css).toContain("#222831");
  });
});

describe("No black background boxes around logo", () => {
  it("LoginForm does not use inline black background style for logo container", () => {
    const content = readFile(join(SRC_DIR, "components/LoginForm.tsx"));
    // The old code had style={{ backgroundColor: "#000000" }} around the logo
    // It should not be there anymore
    expect(content).not.toContain('backgroundColor: "#000000"');
  });

  it("Sidebar does not use inline black background style for logo container", () => {
    const content = readFile(join(SRC_DIR, "components/Sidebar.tsx"));
    expect(content).not.toContain('backgroundColor: "#000000"');
  });

  it("ChatInterface does not use inline black background style for logo", () => {
    const content = readFile(join(SRC_DIR, "components/ChatInterface.tsx"));
    expect(content).not.toContain('backgroundColor: "#000000"');
  });

  it("mobile header in chat/page.tsx does not use black background for logo", () => {
    const content = readFile(join(SRC_DIR, "app/chat/page.tsx"));
    expect(content).not.toContain('backgroundColor: "#000000"');
  });
});