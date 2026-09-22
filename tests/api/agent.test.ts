import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/agent/route";
import { prisma } from "@/src/db/client";
import {
  createAgentResponse,
  createAgentResponseForUser,
  createStreamingAgentResponseForUser
} from "@/src/services/agent";
import { buildAgentContext } from "@/src/services/agentContext";
import {
  AGENT_STREAM_MEDIA_TYPE,
  createAgentStreamParser
} from "@hbm/contracts";

vi.mock("@/src/auth/api", () => ({
  withUser:
    (handler: (...args: unknown[]) => Promise<Response>) =>
    (request: Request) =>
      handler({ id: "user-1", timezone: "Asia/Shanghai" }, request)
}));

vi.mock("@/src/db/client", () => ({
  prisma: {
    agentConversation: {
      findFirst: vi.fn(),
      update: vi.fn()
    },
    agentMessage: {
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn()
    },
    trainingTask: { findFirst: vi.fn() },
    sleepRecord: { findFirst: vi.fn() },
    recoveryRecord: { findFirst: vi.fn() },
    calendarSnapshot: { findFirst: vi.fn() },
    bodyProfile: { findUnique: vi.fn() }
  }
}));

vi.mock("@/src/services/agent", () => ({
  createAgentResponse: vi.fn(),
  createAgentResponseForUser: vi.fn(),
  createStreamingAgentResponseForUser: vi.fn()
}));

vi.mock("@/src/services/agentContext", () => ({
  buildAgentContext: vi.fn()
}));

describe("agent API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createAgentResponse).mockReturnValue({
      intent: "general",
      message: "local guidance",
      source: "rules"
    });
    vi.mocked(buildAgentContext).mockResolvedValue({
      intent: "general",
      freshSync: { attempted: false, succeeded: false },
      sections: [{ title: "Body profile", content: "No body profile saved." }]
    });
  });

  it("rejects missing conversation id", async () => {
    const response = await POST(
      new Request("http://localhost/api/agent", {
        method: "POST",
        body: JSON.stringify({ message: "今天怎么训练？" })
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Conversation is required" });
  });

  it("rejects a conversation that does not belong to the user", async () => {
    vi.mocked(prisma.agentConversation.findFirst).mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/agent", {
        method: "POST",
        body: JSON.stringify({ conversationId: "conv-other", message: "今天怎么训练？" })
      })
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Conversation not found" });
  });

  it("keeps pre-stream validation errors as JSON for NDJSON callers", async () => {
    const response = await POST(
      new Request("http://localhost/api/agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: AGENT_STREAM_MEDIA_TYPE
        },
        body: JSON.stringify({ message: "今天怎么训练？" })
      })
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({ error: "Conversation is required" });
  });

  it("uses only selected conversation history and persists messages there", async () => {
    vi.mocked(prisma.agentConversation.findFirst).mockResolvedValue({
      id: "conv-1",
      title: "New conversation",
      updatedAt: new Date("2026-06-21T09:00:00+08:00")
    } as never);
    vi.mocked(prisma.agentMessage.findMany).mockResolvedValue([{ role: "assistant", content: "上一次回复" }] as never);
    vi.mocked(prisma.agentMessage.create).mockResolvedValue({
      id: "msg-assistant",
      role: "assistant",
      content: "模型回复"
    } as never);
    vi.mocked(prisma.agentMessage.update).mockResolvedValue({ id: "msg-assistant" } as never);
    vi.mocked(prisma.agentConversation.update).mockResolvedValue({
      id: "conv-1",
      title: "New conversation",
      updatedAt: new Date("2026-06-21T09:30:00+08:00")
    } as never);
    vi.mocked(createAgentResponseForUser).mockResolvedValue({
      intent: "general",
      message: "模型回复",
      source: "model",
      modelProvider: "DeepSeek",
      modelName: "deepseek-v4-flash"
    });

    const response = await POST(
      new Request("http://localhost/api/agent", {
        method: "POST",
        body: JSON.stringify({ conversationId: "conv-1", message: "今天怎么训练？" })
      })
    );

    expect(prisma.agentMessage.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1", conversationId: "conv-1" },
      orderBy: { createdAt: "desc" },
      take: 8
    });
    expect(createAgentResponseForUser).toHaveBeenCalledWith("user-1", "今天怎么训练？", [
      { role: "assistant", content: "上一次回复" }
    ], {
      intent: "general",
      freshSync: { attempted: false, succeeded: false },
      sections: [{ title: "Body profile", content: "No body profile saved." }]
    });
    expect(prisma.agentMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: "user-1", conversationId: "conv-1", role: "assistant", content: "模型回复" })
      })
    );
    expect(await response.json()).toEqual(
      expect.objectContaining({
        message: "模型回复",
        source: "model",
        adjustments: [],
        conversation: expect.objectContaining({ id: "conv-1" })
      })
    );
  });

  it("adds a deterministic COROS reconnect instruction after an auth failure", async () => {
    vi.mocked(prisma.agentConversation.findFirst).mockResolvedValue({
      id: "conv-1",
      title: "睡眠数据",
      updatedAt: new Date("2026-07-31T09:00:00+08:00")
    } as never);
    vi.mocked(prisma.agentMessage.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.agentMessage.create).mockResolvedValue({
      id: "msg-assistant",
      role: "assistant",
      content: "暂时无法获取实时数据。"
    } as never);
    vi.mocked(prisma.agentMessage.update).mockResolvedValue({ id: "msg-assistant" } as never);
    vi.mocked(prisma.agentConversation.update).mockResolvedValue({
      id: "conv-1",
      title: "睡眠数据",
      updatedAt: new Date("2026-07-31T09:00:01+08:00")
    } as never);
    vi.mocked(buildAgentContext).mockResolvedValue({
      intent: "recovery_check",
      freshSync: {
        attempted: true,
        succeeded: false,
        authRequired: true,
        error: "COROS authorization expired (HTTP 401). Reconnect COROS in Settings."
      },
      sections: []
    });
    vi.mocked(createAgentResponseForUser).mockResolvedValue({
      intent: "recovery_check",
      message: "暂时无法获取实时数据。",
      source: "model",
      modelProvider: "DeepSeek",
      modelName: "deepseek-v4-flash"
    });

    const response = await POST(
      new Request("http://localhost/api/agent", {
        method: "POST",
        body: JSON.stringify({
          conversationId: "conv-1",
          message: "看下我昨晚的睡眠数据"
        })
      })
    );

    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        message:
          "暂时无法获取实时数据。\nCOROS 授权已过期，请到设置中重新连接 COROS 后再试。"
      })
    );
  });

  it("streams ordered NDJSON events for opted-in callers", async () => {
    vi.mocked(prisma.agentConversation.findFirst).mockResolvedValue({
      id: "conv-1",
      title: "New conversation",
      updatedAt: new Date("2026-07-30T09:00:00+08:00")
    } as never);
    vi.mocked(prisma.agentMessage.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.agentMessage.create).mockResolvedValue({
      id: "msg-assistant",
      role: "assistant",
      content: ""
    } as never);
    vi.mocked(prisma.agentMessage.update).mockResolvedValue({ id: "msg-assistant" } as never);
    vi.mocked(prisma.agentConversation.update).mockResolvedValue({
      id: "conv-1",
      title: "今天怎么训练？",
      updatedAt: new Date("2026-07-30T09:00:01+08:00")
    } as never);
    vi.mocked(createStreamingAgentResponseForUser).mockImplementation(
      async (_userId, _message, _history, _context, onDelta) => {
        await onDelta("建议");
        await onDelta("恢复跑。");
        return {
          intent: "general",
          message: "<explanation>建议恢复跑。</explanation>",
          source: "model",
          modelProvider: "DeepSeek",
          modelName: "deepseek-chat"
        };
      }
    );

    const response = await POST(
      new Request("http://localhost/api/agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: AGENT_STREAM_MEDIA_TYPE
        },
        body: JSON.stringify({
          conversationId: "conv-1",
          message: "今天怎么训练？"
        })
      })
    );
    const parser = createAgentStreamParser();
    const events = parser.push(new Uint8Array(await response.arrayBuffer()));
    parser.finish();

    expect(response.headers.get("content-type")).toContain(AGENT_STREAM_MEDIA_TYPE);
    expect(response.headers.get("x-accel-buffering")).toBe("no");
    expect(events.map((event) => event.type)).toEqual(["start", "delta", "delta", "final"]);
    expect(events.at(-1)).toMatchObject({
      type: "final",
      message: "建议恢复跑。",
      conversation: {
        id: "conv-1",
        title: "今天怎么训练？"
      }
    });
  });

  it("aborts provider generation and skips persistence when the client cancels", async () => {
    vi.mocked(prisma.agentConversation.findFirst).mockResolvedValue({
      id: "conv-1",
      title: "New conversation",
      updatedAt: new Date("2026-07-30T09:00:00+08:00")
    } as never);
    vi.mocked(prisma.agentMessage.findMany).mockResolvedValue([] as never);
    const providerAborted = vi.fn();
    vi.mocked(createStreamingAgentResponseForUser).mockImplementation(
      async (_userId, _message, _history, _context, _onDelta, signal) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener("abort", () => {
            providerAborted();
            reject(new DOMException("aborted", "AbortError"));
          }, { once: true });
        })
    );

    const response = await POST(
      new Request("http://localhost/api/agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: AGENT_STREAM_MEDIA_TYPE
        },
        body: JSON.stringify({
          conversationId: "conv-1",
          message: "今天怎么训练？"
        })
      })
    );
    const reader = response.body!.getReader();
    await reader.read();
    await reader.cancel();

    await vi.waitFor(() => expect(providerAborted).toHaveBeenCalled());
    expect(prisma.agentMessage.create).not.toHaveBeenCalled();
  });

  it("skips finalization when cancellation wins after model generation resolves", async () => {
    vi.mocked(prisma.agentConversation.findFirst).mockResolvedValue({
      id: "conv-1",
      title: "New conversation",
      updatedAt: new Date("2026-07-30T09:00:00+08:00")
    } as never);
    vi.mocked(prisma.agentMessage.findMany).mockResolvedValue([] as never);
    let resolveModel!: () => void;
    const modelGate = new Promise<void>((resolve) => {
      resolveModel = resolve;
    });
    vi.mocked(createStreamingAgentResponseForUser).mockImplementation(
      async (_userId, _message, _history, _context, onDelta) => {
        await onDelta("已生成");
        await modelGate;
        return {
          intent: "general",
          message: "<explanation>已生成</explanation>",
          source: "model"
        };
      }
    );

    const response = await POST(
      new Request("http://localhost/api/agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: AGENT_STREAM_MEDIA_TYPE
        },
        body: JSON.stringify({ conversationId: "conv-1", message: "今天怎么训练？" })
      })
    );
    const reader = response.body!.getReader();
    await reader.read();
    await reader.read();
    await reader.cancel();
    resolveModel();

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(prisma.agentMessage.create).not.toHaveBeenCalled();
  });
});
