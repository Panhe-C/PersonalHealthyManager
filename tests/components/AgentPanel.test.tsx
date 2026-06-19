import React from "react";
import { render, screen, within } from "@testing-library/react";
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
});
