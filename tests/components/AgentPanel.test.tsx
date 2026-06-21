import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AgentPanel } from "@/components/AgentPanel";

vi.mock("@/components/ActionButton", () => ({
  ActionButton: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  )
}));

describe("AgentPanel", () => {
  it("renders user and assistant messages with distinct row and avatar roles", () => {
    const { container } = render(
      <AgentPanel
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
    render(<AgentPanel initialMessages={[]} />);

    expect(screen.getByLabelText("Conversation messages")).toHaveClass("agent-messages-scroll");
    expect(screen.getByRole("form", { name: "Message composer" })).toHaveClass("agent-composer-dock");
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
      render(<AgentPanel initialMessages={[{ id: "assistant-1", role: "assistant", content: "Previous answer" }]} />);
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
