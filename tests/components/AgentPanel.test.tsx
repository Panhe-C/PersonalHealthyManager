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

vi.mock("@/components/AgentMemoryPanel", () => ({
  AgentMemoryPanel: () => null
}));

const conversations = [
  { id: "conv-1", title: "Recovery", updatedAt: "2026-06-21T01:00:00.000Z" },
  { id: "conv-2", title: "Calendar", updatedAt: "2026-06-20T01:00:00.000Z" }
];

const finalConversation = {
  id: "conv-1",
  title: "训练建议",
  updatedAt: "2026-07-30T01:00:00.000Z"
};

function controlledNdjsonResponse() {
  const encoder = new TextEncoder();
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  return {
    response: new Response(new ReadableStream({
      start(value) {
        controller = value;
      }
    }), {
      status: 200,
      headers: { "Content-Type": "application/x-ndjson" }
    }),
    event(value: unknown) {
      controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
    },
    close() {
      controller.close();
    }
  };
}

function completedNdjsonResponse(message: string, conversation = finalConversation) {
  const encoder = new TextEncoder();
  const body = [
    { type: "start", requestId: "req-complete" },
    { type: "delta", text: message },
    {
      type: "final",
      message,
      intent: "general",
      source: "model",
      conversation,
      adjustments: [],
      appliedMemories: []
    }
  ].map((event) => `${JSON.stringify(event)}\n`).join("");
  return new Response(encoder.encode(body), {
    status: 200,
    headers: { "Content-Type": "application/x-ndjson" }
  });
}

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

  it("renders a ChatGPT-style conversation shell with a sidebar and active chat header", () => {
    const { container } = render(
      <AgentPanel
        initialConversations={conversations}
        initialConversationId="conv-1"
        initialMessages={[{ id: "msg-1", role: "assistant", content: "Recovery answer" }]}
      />
    );

    expect(container.querySelector(".agent-chat-shell")).toBeInTheDocument();
    expect(container.querySelector(".agent-rail-brand")).toHaveTextContent("Healthy Body Agent");
    expect(container.querySelector(".agent-chat-header")).toHaveTextContent("Recovery");
    expect(container.querySelector(".agent-panel")).not.toHaveClass("surface");
    expect(screen.getByRole("button", { name: "New chat" })).toHaveClass("agent-new-chat");
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

  it("renders fenced code blocks as <pre> without showing the backtick fences", () => {
    const markdown = ["先看这段配置：", "```json", '{"intensity":"easy"}', "```", "再继续说明。"].join("\n");

    render(
      <AgentPanel
        initialConversations={conversations}
        initialConversationId="conv-1"
        initialMessages={[{ id: "assistant-1", role: "assistant", content: markdown }]}
      />
    );

    const assistantMessage = screen.getByLabelText("AI message");
    const codeBlock = within(assistantMessage).getByText('{"intensity":"easy"}');
    expect(codeBlock.closest(".rich-code-block")).toBeInTheDocument();
    expect(within(assistantMessage).queryByText(/```/)).not.toBeInTheDocument();
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

  it("tailors suggested prompts to the current conversation content", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("/api/agent");
      expect(JSON.parse(String(init?.body))).toEqual({ conversationId: "conv-1", message: "给我下周跑步安排" });
      return completedNdjsonResponse("好的，下周安排已基于恢复状态调整。", {
        id: "conv-1",
        title: "训练分析",
        updatedAt: "2026-06-21T02:00:00.000Z"
      });
    });
    vi.stubGlobal("fetch", fetchMock);

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

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.getByPlaceholderText("Ask about training, recovery, calendar, or meals")).toHaveValue("");
    await waitFor(() => expect(screen.getByText("好的，下周安排已基于恢复状态调整。")).toBeInTheDocument());
    vi.unstubAllGlobals();
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

  it("renders deltas into one assistant message and reconciles final metadata", async () => {
    const stream = controlledNdjsonResponse();
    const fetchMock = vi.fn().mockResolvedValue(stream.response);
    vi.stubGlobal("fetch", fetchMock);
    render(
      <AgentPanel
        initialConversations={conversations}
        initialConversationId="conv-1"
        initialMessages={[]}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Ask about training, recovery, calendar, or meals"), {
      target: { value: "今天怎么练？" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/agent",
      expect.objectContaining({
        headers: expect.objectContaining({ Accept: "application/x-ndjson" })
      })
    ));
    stream.event({ type: "start", requestId: "req-1" });
    stream.event({ type: "delta", text: "建议" });
    await waitFor(() => expect(screen.getByLabelText("AI message")).toHaveTextContent("建议"));

    stream.event({ type: "delta", text: "恢复跑。" });
    stream.event({
      type: "final",
      message: "建议恢复跑。\n已安全调整",
      intent: "replan",
      source: "model",
      conversation: finalConversation,
      adjustments: [{ id: "adj-1", label: "已安全调整", undoneAt: null }],
      appliedMemories: []
    });
    stream.close();

    await waitFor(() => {
      expect(screen.getByLabelText("AI message")).toHaveTextContent("建议恢复跑。 已安全调整");
    });
    expect(screen.getAllByLabelText("AI message")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "撤销" })).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("sends messages with the selected conversation id", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe("/api/agent");
        expect(JSON.parse(String(init?.body))).toEqual({ conversationId: "conv-1", message: "测试消息位置" });
        return completedNdjsonResponse("Assistant reply", {
          id: "conv-1",
          title: "测试消息位置",
          updatedAt: "2026-06-21T02:00:00.000Z"
        });
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

  it("refreshes suggestion chips after a send based on the new conversation topic", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => completedNdjsonResponse("本周跑步训练量偏高，建议降低强度并关注恢复。", {
        id: "conv-1",
        title: "训练分析",
        updatedAt: "2026-06-21T02:00:00.000Z"
      }))
    );

    render(<AgentPanel initialConversations={conversations} initialConversationId="conv-1" initialMessages={[]} />);

    expect(screen.getByRole("button", { name: "今天午餐这些菜怎么选？" })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Ask about training, recovery, calendar, or meals"), {
      target: { value: "分析我这周的运动数据" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "拉取最新 COROS 数据后再分析" })).toBeInTheDocument()
    );
    expect(screen.queryByRole("button", { name: "今天午餐这些菜怎么选？" })).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("scrolls the conversation container to the latest message after sending", async () => {
    const scrollTo = vi.fn();
    const originalScrollTo = Element.prototype.scrollTo;
    Element.prototype.scrollTo = scrollTo;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => completedNdjsonResponse("Assistant reply"))
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

  it("keeps partial text and reports an interrupted stream without a terminal event", async () => {
    const stream = controlledNdjsonResponse();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(stream.response));

    render(<AgentPanel initialConversations={conversations} initialConversationId="conv-1" initialMessages={[]} />);
    fireEvent.change(screen.getByPlaceholderText("Ask about training, recovery, calendar, or meals"), {
      target: { value: "给我建议" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    stream.event({ type: "start", requestId: "req-interrupted" });
    stream.event({ type: "delta", text: "已经生成的部分" });
    stream.close();

    await waitFor(() => expect(screen.getByLabelText("AI message")).toHaveTextContent("已经生成的部分"));
    expect(screen.getByText("回复中断，请重试。")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ask about training, recovery, calendar, or meals")).toBeEnabled();
    expect(screen.getByLabelText("Agent status")).toHaveTextContent("Ready");
    vi.unstubAllGlobals();
  });
});
