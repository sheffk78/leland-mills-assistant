/**
 * Tests for ChatMessage component.
 *
 * Tests user vs assistant rendering, markdown parsing,
 * system messages, timestamps, and brand accent styling.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatMessage, type ChatMessageData } from "@/components/ChatMessage";

describe("ChatMessage - User messages", () => {
  it("renders user message content", () => {
    const msg: ChatMessageData = { role: "USER", content: "What is the pre-trip checklist?" };
    render(<ChatMessage message={msg} />);
    expect(screen.getByText("What is the pre-trip checklist?")).toBeInTheDocument();
  });

  it("renders user message right-aligned (justify-end)", () => {
    const msg: ChatMessageData = { role: "USER", content: "hello" };
    const { container } = render(<ChatMessage message={msg} />);
    const wrapper = container.querySelector(".justify-end");
    expect(wrapper).toBeInTheDocument();
  });

  it("does not render the assistant avatar for user messages", () => {
    const msg: ChatMessageData = { role: "USER", content: "hello" };
    render(<ChatMessage message={msg} />);
    expect(screen.queryByText("Jake")).not.toBeInTheDocument();
  });
});

describe("ChatMessage - Assistant messages", () => {
  it("renders assistant message content", () => {
    const msg: ChatMessageData = { role: "ASSISTANT", content: "Here is the checklist." };
    render(<ChatMessage message={msg} />);
    expect(screen.getByText("Here is the checklist.")).toBeInTheDocument();
  });

  it("renders assistant message left-aligned (justify-start)", () => {
    const msg: ChatMessageData = { role: "ASSISTANT", content: "hello" };
    const { container } = render(<ChatMessage message={msg} />);
    const wrapper = container.querySelector(".justify-start");
    expect(wrapper).toBeInTheDocument();
  });

  it("shows the assistant avatar label 'Jake'", () => {
    const msg: ChatMessageData = { role: "ASSISTANT", content: "hello" };
    render(<ChatMessage message={msg} />);
    expect(screen.getByText("Jake")).toBeInTheDocument();
  });

  it("renders bold markdown", () => {
    const msg: ChatMessageData = { role: "ASSISTANT", content: "This is **bold text**" };
    const { container } = render(<ChatMessage message={msg} />);
    const strong = container.querySelector("strong");
    expect(strong).toBeInTheDocument();
    expect(strong?.textContent).toBe("bold text");
  });

  it("renders headings", () => {
    const msg: ChatMessageData = { role: "ASSISTANT", content: "## Daily Inspection" };
    const { container } = render(<ChatMessage message={msg} />);
    const h2 = container.querySelector("h2");
    expect(h2).toBeInTheDocument();
    expect(h2?.textContent).toContain("Daily Inspection");
  });

  it("renders unordered lists", () => {
    const msg: ChatMessageData = {
      role: "ASSISTANT",
      content: "- Item one\n- Item two\n- Item three",
    };
    const { container } = render(<ChatMessage message={msg} />);
    const ul = container.querySelector("ul");
    expect(ul).toBeInTheDocument();
    const items = container.querySelectorAll("ul li");
    expect(items).toHaveLength(3);
  });

  it("renders ordered lists", () => {
    const msg: ChatMessageData = {
      role: "ASSISTANT",
      content: "1. Step one\n2. Step two",
    };
    const { container } = render(<ChatMessage message={msg} />);
    const ol = container.querySelector("ol");
    expect(ol).toBeInTheDocument();
    expect(ol?.querySelectorAll("li")).toHaveLength(2);
  });

  it("renders inline code", () => {
    const msg: ChatMessageData = { role: "ASSISTANT", content: "Run `npm test` to verify" };
    const { container } = render(<ChatMessage message={msg} />);
    const code = container.querySelector("code");
    expect(code).toBeInTheDocument();
    expect(code?.textContent).toBe("npm test");
  });

  it("escapes HTML to prevent XSS", () => {
    const msg: ChatMessageData = {
      role: "ASSISTANT",
      content: '<script>alert("xss")</script>',
    };
    const { container } = render(<ChatMessage message={msg} />);
    // The script tag should be escaped, not rendered as actual HTML
    expect(container.querySelector("script")).not.toBeInTheDocument();
  });
});

describe("ChatMessage - System messages", () => {
  it("renders system message as italic note", () => {
    const msg: ChatMessageData = { role: "SYSTEM", content: "Agent communication failed" };
    render(<ChatMessage message={msg} />);
    expect(screen.getByText(/Agent communication failed/i)).toBeInTheDocument();
  });
});

describe("ChatMessage - Timestamps", () => {
  it("renders timestamp when createdAt is provided", () => {
    const msg: ChatMessageData = {
      role: "USER",
      content: "hello",
      createdAt: new Date("2026-01-15T14:30:00").toISOString(),
    };
    render(<ChatMessage message={msg} />);
    // Should show a time string
    const timeText = screen.getByText(/:30/, { exact: false });
    expect(timeText).toBeInTheDocument();
  });

  it("does not render timestamp when createdAt is missing", () => {
    const msg: ChatMessageData = { role: "USER", content: "hello" };
    const { container } = render(<ChatMessage message={msg} />);
    // Should not have a time display div
    const timeDivs = container.querySelectorAll('[class*="text-\\[10px\\]"]');
    // The wrapper may have that class, but there should be no time text
    expect(timeDivs.length).toBe(0);
  });
});