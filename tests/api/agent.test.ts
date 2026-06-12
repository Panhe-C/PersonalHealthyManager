import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/agent/route";
import { prisma } from "@/src/db/client";
import { createAgentResponseForUser } from "@/src/services/agent";

vi.mock("@/src/auth/api", () => ({
  withUser:
    (handler: (...args: unknown[]) => Promise<Response>) =>
    (request: Request) =>
      handler({ id: "user-1", timezone: "Asia/Shanghai" }, request)
}));

vi.mock("@/src/db/client", () => ({
  prisma: {
    agentMessage: {
      createMany: vi.fn(),
      findMany: vi.fn()
    }
  }
}));

vi.mock("@/src/services/agent", () => ({
  createAgentResponseForUser: vi.fn()
}));

describe("agent API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the configured model-backed agent response for chat messages", async () => {
    vi.mocked(prisma.agentMessage.findMany).mockResolvedValue([{ role: "assistant", content: "上一次回复" }] as never);
    vi.mocked(prisma.agentMessage.createMany).mockResolvedValue({ count: 2 } as never);
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
        body: JSON.stringify({ message: "今天怎么训练？" })
      })
    );

    expect(createAgentResponseForUser).toHaveBeenCalledWith("user-1", "今天怎么训练？", [
      { role: "assistant", content: "上一次回复" }
    ]);
    expect(prisma.agentMessage.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ role: "assistant", content: "模型回复", metadataJson: expect.stringContaining("DeepSeek") })
        ])
      })
    );
    expect(await response.json()).toEqual(expect.objectContaining({ message: "模型回复", source: "model" }));
  });
});
