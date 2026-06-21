import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AgentPanel } from "@/components/AgentPanel";

vi.mock("@/components/ActionButton", () => ({
  ActionButton: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  )
}));

const conversations = [
  { id: "conv-1", title: "Recovery", updatedAt: "2026-06-21T01:00:00.000Z" },
  { id: "conv-2", title: "Calendar", updatedAt: "2026-06-20T01:00:00.000Z" }
];

describe("AgentPanel", () => {
  it("renders user and assistant messages with distinct row and avatar roles", () => {
    const { container } = render(
      <AgentPanel
        initialConversations={conversations}
        initialConversationId="conv-1"
        initialMessages={[
          { id: "user-1", role: "user", content: "我昨晚没睡好，今天还适合跑吗？" },
          {
            id: "assistant-1",
            role: "assistant",
            content: "I will check sleep and recovery first."
          }
        ]}
      />
    );

    const userMessage = screen.getByLabelText("User message");
    const assistantMessage = screen.getByLabelText("AI message");

    expect(userMessage).toHaveClass("chat-row-user");
    expect(within(userMessage).getByText("我昨晚没睡好，今天还适合跑吗？")).toBeInTheDocument();
    expect(userMessage.querySelector(".chat-avatar-user")).toHaveTextContent("You");

    expect(assistantMessage).toHaveClass("chat-row-assistant");
    expect(within(assistantMessage).getByText("I will check sleep and recovery first.")).toBeInTheDocument();
    expect(assistantMessage.querySelector(".chat-avatar-assistant")).toHaveTextContent("AI");

    expect(container.querySelectorAll(".chat-row")).toHaveLength(2);
  });

  it("marks the message list as scrollable and the composer as a bottom dock", () => {
    render(<AgentPanel initialConversations={conversations} initialConversationId="conv-1" initialMessages={[]} />);

    expect(screen.getByLabelText("Conversation messages")).toHaveClass("agent-messages-scroll");
    expect(screen.getByRole("form", { name: "Message composer" })).toHaveClass("agent-composer-dock");
  });

  it("renders conversation list and selected messages", () => {
    render(
      <AgentPanel
        initialConversations={conversations}
        initialConversationId="conv-1"
        initialMessages={[{ id: "msg-1", role: "assistant", content: "Recovery answer" }]}
      />
    );

    expect(screen.getByRole("button", { name: "New chat" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Recovery" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Recovery answer")).toBeInTheDocument();
  });

  it("loads messages when switching conversations", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        expect(String(input)).toBe("/api/agent/conversations/conv-2");
        return {
          ok: true,
          json: async () => ({
            id: "conv-2",
            title: "Calendar",
            updatedAt: "2026-06-20T01:00:00.000Z",
            messages: [{ id: "msg-2", role: "assistant", content: "Calendar answer" }]
          })
        };
      })
    );

    render(<AgentPanel initialConversations={conversations} initialConversationId="conv-1" initialMessages={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Calendar" }));

    await waitFor(() => expect(screen.getByText("Calendar answer")).toBeInTheDocument());
    vi.unstubAllGlobals();
  });

  it("creates and selects a new conversation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          id: "conv-new",
          title: "New conversation",
          updatedAt: "2026-06-21T02:00:00.000Z",
          messages: []
        })
      }))
    );

    render(<AgentPanel initialConversations={conversations} initialConversationId="conv-1" initialMessages={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "New chat" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "New conversation" })).toHaveAttribute("aria-pressed", "true"));
    vi.unstubAllGlobals();
  });

  it("sends messages with the selected conversation id", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe("/api/agent");
        expect(JSON.parse(String(init?.body))).toEqual({ conversationId: "conv-1", message: "测试消息位置" });
        return {
          ok: true,
          json: async () => ({
            message: "Assistant reply",
            conversation: { id: "conv-1", title: "测试消息位置", updatedAt: "2026-06-21T02:00:00.000Z" }
          })
        };
      })
    );

    render(<AgentPanel initialConversations={conversations} initialConversationId="conv-1" initialMessages={[]} />);
    fireEvent.change(screen.getByPlaceholderText("Ask about training, recovery, calendar, or meals"), {
      target: { value: "测试消息位置" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(screen.getByText("Assistant reply")).toBeInTheDocument());
    vi.unstubAllGlobals();
  });

  it("scrolls the conversation container to the latest message after sending", async () => {
    const scrollTo = vi.fn();
    const originalScrollTo = Element.prototype.scrollTo;
    Element.prototype.scrollTo = scrollTo;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ message: "Assistant reply" })
      }))
    );

    try {
      render(
        <AgentPanel
          initialConversations={conversations}
          initialConversationId="conv-1"
          initialMessages={[{ id: "assistant-1", role: "assistant", content: "Previous answer" }]}
        />
      );
      scrollTo.mockClear();

      fireEvent.change(screen.getByPlaceholderText("Ask about training, recovery, calendar, or meals"), {
        target: { value: "测试消息位置" }
      });
      fireEvent.click(screen.getByRole("button", { name: "Send" }));

      await waitFor(() => expect(scrollTo).toHaveBeenCalled());
      expect(scrollTo).toHaveBeenCalledWith({ top: expect.any(Number) });
    } finally {
      Element.prototype.scrollTo = originalScrollTo;
      vi.unstubAllGlobals();
    }
  });
});
