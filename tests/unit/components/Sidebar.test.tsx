/**
 * Tests for Sidebar component.
 *
 * Tests logo rendering, new chat button, conversation list,
 * search, mobile overlay, and settings link.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { render, screen, fireEvent } from "@testing-library/react";
import { Sidebar, type ConversationListItem } from "@/components/Sidebar";

const sampleConversations: ConversationListItem[] = [
  { id: "c1", title: "Pre-trip inspection", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), _count: { messages: 3 } },
  { id: "c2", title: "Feed inventory question", createdAt: new Date().toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString(), _count: { messages: 1 } },
  { id: "c3", title: "DOT hours of service", createdAt: new Date().toISOString(), updatedAt: new Date(Date.now() - 172800000).toISOString(), _count: { messages: 5 } },
];

describe("Sidebar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the full Leland Mills logo", () => {
    render(<Sidebar conversations={[]} />);
    const logo = screen.getByAltText("Leland Mills");
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute("src", "/leland-mills-full-logo-black-white.png");
  });

  it("renders 'AI Assistant' label next to logo", () => {
    render(<Sidebar conversations={[]} />);
    expect(screen.getByText("AI Assistant")).toBeInTheDocument();
  });

  it("renders New Chat button with gold accent", () => {
    render(<Sidebar conversations={[]} />);
    const newChatBtn = screen.getByText("New Chat").closest("button");
    expect(newChatBtn).toBeInTheDocument();
    expect(newChatBtn?.style.backgroundColor).toBe("var(--color-accent)");
  });

  it("calls onNewChat when New Chat is clicked", () => {
    const onNewChat = vi.fn();
    render(<Sidebar conversations={[]} onNewChat={onNewChat} />);

    fireEvent.click(screen.getByText("New Chat"));
    expect(onNewChat).toHaveBeenCalled();
  });

  it("renders conversation list with titles", () => {
    render(<Sidebar conversations={sampleConversations} />);

    expect(screen.getByText("Pre-trip inspection")).toBeInTheDocument();
    expect(screen.getByText("Feed inventory question")).toBeInTheDocument();
    expect(screen.getByText("DOT hours of service")).toBeInTheDocument();
  });

  it("shows message count for conversations", () => {
    render(<Sidebar conversations={sampleConversations} />);

    expect(screen.getByText("3 msg")).toBeInTheDocument();
    expect(screen.getByText("1 msg")).toBeInTheDocument();
  });

  it("shows empty state when no conversations", () => {
    render(<Sidebar conversations={[]} />);
    expect(screen.getByText(/No conversations yet/i)).toBeInTheDocument();
  });

  it("renders Settings button", () => {
    render(<Sidebar conversations={[]} />);
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("does not render search when fewer than 6 conversations", () => {
    render(<Sidebar conversations={sampleConversations} />);
    expect(screen.queryByPlaceholderText("Search conversations...")).not.toBeInTheDocument();
  });

  it("renders search when more than 5 conversations", () => {
    const manyConvos: ConversationListItem[] = Array.from({ length: 6 }, (_, i) => ({
      id: `c${i}`,
      title: `Conversation ${i}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    render(<Sidebar conversations={manyConvos} />);
    expect(screen.getByPlaceholderText("Search conversations...")).toBeInTheDocument();
  });

  it("highlights active conversation with accent border", () => {
    render(<Sidebar conversations={sampleConversations} activeId="c1" />);

    const activeBtn = screen.getByText("Pre-trip inspection").closest("button");
    expect(activeBtn).toBeInTheDocument();
    // Check that the inline style was applied (jsdom keeps the raw string)
    expect(activeBtn?.style.borderLeft).toContain("3px");
    expect(activeBtn?.style.borderLeft).toContain("var(--color-accent)");
  });

  it("renders mobile close button when open", () => {
    render(<Sidebar conversations={[]} isOpen={true} onClose={vi.fn()} />);
    const closeBtn = screen.getByLabelText("Close sidebar");
    expect(closeBtn).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(<Sidebar conversations={[]} isOpen={true} onClose={onClose} />);

    fireEvent.click(screen.getByLabelText("Close sidebar"));
    expect(onClose).toHaveBeenCalled();
  });
});