import { beforeEach, describe, expect, it, vi } from "vitest";
import { maybeRefreshSummary } from "@/src/services/agentMemory/summaryService";

vi.mock("@/src/db/client", () => ({
  prisma: {
    agentConversation: { findFirst: vi.fn(), update: vi.fn() },
    agentMessage: { count: vi.fn(), findMany: vi.fn() }
  }
}));

vi.mock("@/src/settings/service", () => ({
  loadModelRuntimeConfig: vi.fn()
}));

vi.mock("@/src/services/agent", () => ({
  runModelCompletion: vi.fn()
}));

import { prisma } from "@/src/db/client";
import { loadModelRuntimeConfig } from "@/src/settings/service";
import { runModelCompletion } from "@/src/services/agent";

describe("maybeRefreshSummary throttling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips refresh when message growth is below the threshold", async () => {
    vi.mocked(prisma.agentConversation.findFirst).mockResolvedValue({
      id: "conv-1",
      summary: "old summary",
      summaryMessageCount: 10
    } as never);
    vi.mocked(prisma.agentMessage.count).mockResolvedValue(12 as never);

    const outcome = await maybeRefreshSummary("user-1", "conv-1", { threshold: 6 });

    expect(outcome.refreshed).toBe(false);
    expect(loadModelRuntimeConfig).not.toHaveBeenCalled();
    expect(runModelCompletion).not.toHaveBeenCalled();
  });

  it("skips refresh when no model is configured", async () => {
    vi.mocked(prisma.agentConversation.findFirst).mockResolvedValue({
      id: "conv-1",
      summary: null,
      summaryMessageCount: 0
    } as never);
    vi.mocked(prisma.agentMessage.count).mockResolvedValue(8 as never);
    vi.mocked(loadModelRuntimeConfig).mockResolvedValue(null);

    const outcome = await maybeRefreshSummary("user-1", "conv-1", { threshold: 6 });

    expect(outcome.refreshed).toBe(false);
    expect(outcome.reason).toBe("no model configured");
    expect(runModelCompletion).not.toHaveBeenCalled();
  });

  it("refreshes the summary when growth crosses the threshold and a model is configured", async () => {
    vi.mocked(prisma.agentConversation.findFirst).mockResolvedValue({
      id: "conv-1",
      summary: "old summary",
      summaryMessageCount: 2
    } as never);
    vi.mocked(prisma.agentMessage.count).mockResolvedValue(9 as never);
    vi.mocked(loadModelRuntimeConfig).mockResolvedValue({
      provider: "openai",
      providerLabel: "openai",
      modelName: "gpt-4o-mini",
      baseUrl: "https://api",
      apiKey: "k"
    } as never);
    vi.mocked(prisma.agentMessage.findMany).mockResolvedValue([
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" }
    ] as never);
    vi.mocked(runModelCompletion).mockResolvedValue("new rolling summary");
    vi.mocked(prisma.agentConversation.update).mockResolvedValue({} as never);

    const outcome = await maybeRefreshSummary("user-1", "conv-1", { threshold: 6 });

    expect(outcome.refreshed).toBe(true);
    expect(runModelCompletion).toHaveBeenCalledOnce();
    expect(prisma.agentConversation.update).toHaveBeenCalledWith({
      where: { id: "conv-1" },
      data: expect.objectContaining({ summary: "new rolling summary", summaryMessageCount: 9 })
    });
  });

  it("keeps the old summary when the model call fails", async () => {
    vi.mocked(prisma.agentConversation.findFirst).mockResolvedValue({
      id: "conv-1",
      summary: "old summary",
      summaryMessageCount: 0
    } as never);
    vi.mocked(prisma.agentMessage.count).mockResolvedValue(7 as never);
    vi.mocked(loadModelRuntimeConfig).mockResolvedValue({
      provider: "openai",
      providerLabel: "openai",
      modelName: "gpt-4o-mini",
      baseUrl: "https://api",
      apiKey: "k"
    } as never);
    vi.mocked(prisma.agentMessage.findMany).mockResolvedValue([
      { role: "user", content: "hi" }
    ] as never);
    vi.mocked(runModelCompletion).mockRejectedValue(new Error("boom"));

    const outcome = await maybeRefreshSummary("user-1", "conv-1", { threshold: 6 });

    expect(outcome.refreshed).toBe(false);
    expect(outcome.reason).toBe("summary model call failed");
    expect(prisma.agentConversation.update).not.toHaveBeenCalled();
  });
});
