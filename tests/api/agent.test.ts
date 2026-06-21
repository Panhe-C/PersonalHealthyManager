import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/agent/route";
import { prisma } from "@/src/db/client";
import { createAgentResponse, createAgentResponseForUser } from "@/src/services/agent";
import { buildAgentContext } from "@/src/services/agentContext";

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
      createMany: vi.fn(),
      findMany: vi.fn()
    }
  }
}));

vi.mock("@/src/services/agent", () => ({
  createAgentResponse: vi.fn(),
  createAgentResponseForUser: vi.fn()
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

  it("uses only selected conversation history and persists messages there", async () => {
    vi.mocked(prisma.agentConversation.findFirst).mockResolvedValue({
      id: "conv-1",
      title: "New conversation",
      updatedAt: new Date("2026-06-21T09:00:00+08:00")
    } as never);
    vi.mocked(prisma.agentMessage.findMany).mockResolvedValue([{ role: "assistant", content: "上一次回复" }] as never);
    vi.mocked(prisma.agentMessage.createMany).mockResolvedValue({ count: 2 } as never);
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
    expect(prisma.agentMessage.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ userId: "user-1", conversationId: "conv-1", role: "user" }),
          expect.objectContaining({
            userId: "user-1",
            conversationId: "conv-1",
            role: "assistant",
            content: "模型回复",
            metadataJson: expect.stringContaining("Body profile")
          })
        ])
      })
    );
    expect(await response.json()).toEqual(
      expect.objectContaining({ message: "模型回复", source: "model", conversation: expect.objectContaining({ id: "conv-1" }) })
    );
  });
});
