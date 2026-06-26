import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AgentPanel } from "@/components/AgentPanel";

vi.mock("@/components/ActionButton", () => ({
  ActionButton: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  )
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() })
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

  it("renders assistant markdown as structured rich content", () => {
    const markdown = [
      "### 睡眠时长与评分概览",
      "| 日期 | 时长 | 评分 |",
      "| --- | --- | --- |",
      "| 6月17日 | 591 | 73 |",
      "| 6月18日 | 462 | 64 |",
      "",
      "**关键发现**：6月21日睡眠时长偏短。",
      "- 建议今天降低训练强度"
    ].join("\n");

    render(
      <AgentPanel
        initialConversations={conversations}
        initialConversationId="conv-1"
        initialMessages={[{ id: "assistant-1", role: "assistant", content: markdown }]}
      />
    );

    const assistantMessage = screen.getByLabelText("AI message");
    expect(within(assistantMessage).getByRole("heading", { name: "睡眠时长与评分概览" })).toBeInTheDocument();
    expect(within(assistantMessage).getByRole("table")).toBeInTheDocument();
    expect(within(assistantMessage).getByText("关键发现")).toHaveClass("rich-strong");
    expect(within(assistantMessage).getByText("建议今天降低训练强度")).toBeInTheDocument();
    expect(assistantMessage).not.toHaveTextContent("| --- | --- | --- |");
  });

  it("renders an explanatory fallback instead of an empty markdown table", () => {
    const markdown = ["### 改进建议", "| 当前问题 | 建议调整 |", "| --- | --- |"].join("\n");

    render(
      <AgentPanel
        initialConversations={conversations}
        initialConversationId="conv-1"
        initialMessages={[{ id: "assistant-1", role: "assistant", content: markdown }]}
      />
    );

    const assistantMessage = screen.getByLabelText("AI message");
    expect(within(assistantMessage).queryByRole("table")).not.toBeInTheDocument();
    expect(within(assistantMessage).getByText("当前问题 / 建议调整")).toBeInTheDocument();
    expect(within(assistantMessage).getByText("这张表没有提供明细。")).toBeInTheDocument();
  });

  it("shows a retry notice for clearly truncated assistant messages", () => {
    render(
      <AgentPanel
        initialConversations={conversations}
        initialConversationId="conv-1"
        initialMessages={[
          {
            id: "assistant-1",
            role: "assistant",
            content: "好的，以下是对你 **6月15日（周一）至6月20日（周六）** 这一周运动"
          }
        ]}
      />
    );

    const assistantMessage = screen.getByLabelText("AI message");
    expect(within(assistantMessage).getByText("这条回复生成时被截断了，请重新发送问题以获取完整分析。")).toBeInTheDocument();
    expect(assistantMessage).not.toHaveTextContent("这一周运动");
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

  it("tailors suggested prompts to the current conversation content", () => {
    render(
      <AgentPanel
        initialConversations={conversations}
        initialConversationId="conv-1"
        initialMessages={[
          { id: "user-1", role: "user", content: "分析我这周的运动数据" },
          { id: "assistant-1", role: "assistant", content: "本周跑步训练量偏高，建议降低强度；如果感到疲劳可减少一次。" }
        ]}
      />
    );

    expect(screen.getByRole("button", { name: "拉取最新 COROS 数据后再分析" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "给我下周跑步安排" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "今天午餐这些菜怎么选？" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "给我下周跑步安排" }));
    expect(screen.getByPlaceholderText("Ask about training, recovery, calendar, or meals")).toHaveValue("给我下周跑步安排");
  });

  it("refreshes suggested prompts after switching conversations", async () => {
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
            messages: [
              { id: "user-2", role: "user", content: "帮我把本周训练写入飞书日历" },
              { id: "assistant-2", role: "assistant", content: "我可以先生成日历草稿，确认后再写入飞书。" }
            ]
          })
        };
      })
    );

    render(
      <AgentPanel
        initialConversations={conversations}
        initialConversationId="conv-1"
        initialMessages={[{ id: "user-1", role: "user", content: "分析我这周的运动数据" }]}
      />
    );

    expect(screen.getByRole("button", { name: "拉取最新 COROS 数据后再分析" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Calendar" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "查看明天有哪些训练空档" })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "拉取最新 COROS 数据后再分析" })).not.toBeInTheDocument();
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

  it("confirms and deletes the selected conversation, then loads the next conversation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input) === "/api/agent/conversations/conv-1") {
          expect(init?.method).toBe("DELETE");
          return {
            ok: true,
            json: async () => ({ deleted: true })
          };
        }
        if (String(input) === "/api/agent/conversations/conv-2") {
          return {
            ok: true,
            json: async () => ({
              id: "conv-2",
              title: "Calendar",
              updatedAt: "2026-06-20T01:00:00.000Z",
              messages: [{ id: "msg-2", role: "assistant", content: "Calendar answer" }]
            })
          };
        }
        throw new Error(`Unexpected request: ${String(input)}`);
      })
    );

    render(
      <AgentPanel
        initialConversations={conversations}
        initialConversationId="conv-1"
        initialMessages={[{ id: "msg-1", role: "assistant", content: "Recovery answer" }]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete conversation Recovery" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete Recovery" }));

    await waitFor(() => expect(screen.queryByRole("button", { name: "Recovery" })).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Calendar" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Calendar answer")).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("renders an undo affordance for executed adjustments and undoes on click", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        expect(String(input)).toBe("/api/agent/adjustments/adj-1/undo");
        return { ok: true, json: async () => ({ id: "adj-1", undoneAt: "2026-06-26T14:00:00.000Z" }) };
      })
    );

    render(
      <AgentPanel
        initialConversations={conversations}
        initialConversationId="conv-1"
        initialMessages={[
          {
            id: "m1",
            role: "assistant",
            content: "已把周三降为 easy",
            adjustments: [{ id: "adj-1", label: "已把周三降为 easy", undoneAt: null }]
          }
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "撤销" }));
    await waitFor(() => expect(screen.getByText("已撤销")).toBeInTheDocument());
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
