/**
 * Tests for ChatInterface component.
 *
 * Tests empty state rendering, starter prompt buttons,
 * message sending, loading state, and error handling.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChatInterface } from "@/components/ChatInterface";

describe("ChatInterface - Empty State", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the full Leland Mills logo", () => {
    render(<ChatInterface />);
    const logo = screen.getByAltText("Leland Mills");
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute("src", "/leland-mills-full-logo-black-white.png");
  });

  it("renders 'How can I help you today?' heading", () => {
    render(<ChatInterface />);
    expect(screen.getByText("How can I help you today?")).toBeInTheDocument();
  });

  it("renders starter prompts in categories", () => {
    render(<ChatInterface />);

    // Safety & Compliance
    expect(screen.getByText("Safety & Compliance")).toBeInTheDocument();
    expect(screen.getByText("Pre-trip inspection checklist")).toBeInTheDocument();
    expect(screen.getByText("DOT hours of service limits")).toBeInTheDocument();

    // Inventory & Feed
    expect(screen.getByText("Inventory & Feed")).toBeInTheDocument();
    expect(screen.getByText("Feed inventory reorder points")).toBeInTheDocument();

    // Getting Started
    expect(screen.getByText("Getting Started")).toBeInTheDocument();
    expect(screen.getByText("What can you help me with?")).toBeInTheDocument();
  });

  it("clicking a starter prompt fills the input", () => {
    render(<ChatInterface />);
    const promptBtn = screen.getByText("Pre-trip inspection checklist");
    fireEvent.click(promptBtn);

    const input = screen.getByPlaceholderText("Type your message...") as HTMLTextAreaElement;
    expect(input.value).toBe("Pre-trip inspection checklist");
  });

  it("renders the tip for new users", () => {
    render(<ChatInterface />);
    expect(screen.getByText(/New here\? Just type a question/i)).toBeInTheDocument();
  });
});

describe("ChatInterface - Message Sending", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends a message and displays the response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        response: "Here is the inspection checklist...",
        conversationId: "conv-1",
        userMessageId: "m1",
        assistantMessageId: "m2",
        createdAt: new Date().toISOString(),
      }),
    });

    render(<ChatInterface />);

    const input = screen.getByPlaceholderText("Type your message...");
    fireEvent.change(input, { target: { value: "What is the pre-trip checklist?" } });

    const form = input.closest("form");
    if (form) {
      fireEvent.submit(form);
    }

    await waitFor(() => {
      expect(screen.getByText("Here is the inspection checklist...")).toBeInTheDocument();
    });
  });

  it("shows typing indicator while waiting for response", async () => {
    let resolveFetch: (value: unknown) => void;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    mockFetch.mockReturnValueOnce(fetchPromise);

    render(<ChatInterface />);

    const input = screen.getByPlaceholderText("Type your message...");
    fireEvent.change(input, { target: { value: "hello" } });

    const form = input.closest("form");
    if (form) fireEvent.submit(form);

    await waitFor(() => {
      // The typing indicator uses animate-bounce spans
      const indicators = document.querySelectorAll(".animate-bounce");
      expect(indicators.length).toBeGreaterThan(0);
    });

    // Resolve the fetch to clean up
    resolveFetch!({
      ok: true,
      json: async () => ({
        response: "reply",
        conversationId: "c1",
        createdAt: new Date().toISOString(),
      }),
    });

    await waitFor(() => {
      expect(screen.getByText("reply")).toBeInTheDocument();
    });
  });

  it("shows error message when API fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => "Internal server error",
    });

    render(<ChatInterface />);

    const input = screen.getByPlaceholderText("Type your message...");
    fireEvent.change(input, { target: { value: "test" } });

    const form = input.closest("form");
    if (form) fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/Internal server error/i)).toBeInTheDocument();
    });
  });

  it("does not send empty messages", async () => {
    mockFetch.mockClear();

    render(<ChatInterface />);

    const submitBtn = screen.getByRole("button", { name: "" }); // The send button has no text
    expect(submitBtn).toBeDisabled();
  });
});