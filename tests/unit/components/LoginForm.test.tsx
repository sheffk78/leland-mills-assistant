/**
 * Tests for LoginForm component.
 *
 * Tests rendering, mode switching, form submission,
 * and branding elements.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Mock next-auth/react and next/navigation
vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { LoginForm } from "@/components/LoginForm";
import { signIn } from "next-auth/react";

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the full Leland Mills logo", () => {
    render(<LoginForm />);
    const logo = screen.getByAltText("Leland Mills");
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute("src", "/leland-mills-full-logo-black-white.png");
  });

  it("renders the hero feed bag image", () => {
    render(<LoginForm />);
    const heroImg = screen.getByAltText("Leland Mills feed products");
    expect(heroImg).toBeInTheDocument();
    expect(heroImg).toHaveAttribute("src", "/lm-feed-bags-garden.png");
  });

  it("renders 'AI Assistant' heading", () => {
    render(<LoginForm />);
    expect(screen.getByText("AI Assistant")).toBeInTheDocument();
  });

  it("defaults to Staff Login mode", () => {
    render(<LoginForm />);
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("Password")).toBeInTheDocument();
  });

  it("switches to Driver Login mode with PIN field", () => {
    render(<LoginForm />);
    fireEvent.click(screen.getByText("Driver Login"));

    expect(screen.getByText("PIN Code")).toBeInTheDocument();
    expect(screen.queryByText("Email")).not.toBeInTheDocument();
  });

  it("switches back to Staff Login from Driver Login", () => {
    render(<LoginForm />);

    // Switch to Driver
    fireEvent.click(screen.getByText("Driver Login"));
    expect(screen.getByText("PIN Code")).toBeInTheDocument();

    // Switch back to Staff
    fireEvent.click(screen.getByText("Staff Login"));
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.queryByText("PIN Code")).not.toBeInTheDocument();
  });

  it("shows contextual help text for staff mode", () => {
    render(<LoginForm />);
    expect(screen.getByText(/office staff, managers, and administrators/i)).toBeInTheDocument();
  });

  it("shows contextual help text for driver mode", () => {
    render(<LoginForm />);
    fireEvent.click(screen.getByText("Driver Login"));
    expect(screen.getByText(/delivery drivers/i)).toBeInTheDocument();
  });

  it("renders the heritage tagline", () => {
    render(<LoginForm />);
    expect(screen.getByText("Leland Mills Feed Company")).toBeInTheDocument();
    expect(screen.getByText("Fresh Feed Milled Daily Since 1898")).toBeInTheDocument();
  });

  it("renders the 'First time here?' onboarding section", () => {
    render(<LoginForm />);
    expect(screen.getByText("First time here?")).toBeInTheDocument();
    expect(screen.getByText(/Truck pre-trip and post-trip inspection checklists/i)).toBeInTheDocument();
  });

  it("has a Sign In button with gold accent background", () => {
    render(<LoginForm />);
    const signInBtn = screen.getByText("Sign In").closest("button");
    expect(signInBtn).toBeInTheDocument();
    expect(signInBtn?.style.backgroundColor).toBe("var(--color-accent)");
  });

  it("does not submit with empty fields", async () => {
    const mockSignIn = vi.mocked(signIn);
    mockSignIn.mockClear();
    render(<LoginForm />);

    // The Sign In button should not trigger signIn when fields are empty
    // because HTML required validation prevents form submission
    const btn = screen.getByText("Sign In").closest("button");
    expect(btn).not.toBeDisabled(); // Button itself isn't disabled, but form won't submit

    // Try clicking - browser validation should block it in real usage
    // In jsdom, the form may submit, so we verify signIn wasn't called with empty values
    fireEvent.click(btn!);
    await new Promise(r => setTimeout(r, 100));
    // signIn should not have been called with empty email/password
    if (mockSignIn.mock.calls.length > 0) {
      const callArgs = mockSignIn.mock.calls[0][1] as Record<string, string>;
      expect(callArgs.email).not.toBe("");
      expect(callArgs.password).not.toBe("");
    }
  });

  it("calls signIn with credentials on staff login submit", async () => {
    const mockSignIn = vi.mocked(signIn);
    mockSignIn.mockResolvedValue({ ok: true, error: null } as never);

    render(<LoginForm />);

    fireEvent.change(screen.getByPlaceholderText("you@lelandmills.com"), {
      target: { value: "admin@lelandmills.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), {
      target: { value: "change-me" },
    });
    fireEvent.click(screen.getByText("Sign In"));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith("credentials", expect.objectContaining({
        email: "admin@lelandmills.com",
        password: "change-me",
      }));
    });
  });
});