import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/agent/route";
import { prisma } from "@/src/db/client";
import { createAgentResponse, createAgentResponseForUser } from "@/src/services/agent";
import { buildAgentContext } from "@/src/services/agentContext";
import { executeAgentAction } from "@/src/services/agentActions/executor";
import { applyMemories } from "@/src/services/agentMemory/memoryService";
import { maybeRefreshSummary } from "@/src/services/agentMemory/summaryService";

vi.mock("@/src/auth/api", () => ({
  withUser:
    (handler: (...args: unknown[]) => Promise<Response>) =>
    (request: Request) =>
      handler({ id: "user-1", timezone: "Asia/Shanghai" }, request)
}));

vi.mock("@/src/db/client", () => ({
  prisma: {
    agentConversation: { findFirst: vi.fn(), update: vi.fn() },
    agentMessage: { create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    trainingTask: { findFirst: vi.fn() },
    sleepRecord: { findFirst: vi.fn() },
    recoveryRecord: { findFirst: vi.fn() },
    calendarSnapshot: { findFirst: vi.fn() },
    bodyProfile: { findUnique: vi.fn() }
  }
}));

vi.mock("@/src/services/agent", () => ({
  createAgentResponse: vi.fn(),
  createAgentResponseForUser: vi.fn()
}));

vi.mock("@/src/services/agentContext", () => ({ buildAgentContext: vi.fn() }));
vi.mock("@/src/services/agentActions/executor", () => ({ executeAgentAction: vi.fn() }));
vi.mock("@/src/services/agentMemory/memoryService", () => ({ applyMemories: vi.fn() }));
vi.mock("@/src/services/agentMemory/summaryService", () => ({ maybeRefreshSummary: vi.fn() }));

const replyWithActions = [
  "<explanation>已为你把周三降为 easy</explanation>",
  "<actions>",
  '[{"id":"adjust_task_intensity","args":{"taskId":"t1","intensity":"easy"}}]',
  "</actions>"
].join("\n");

describe("agent action execution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createAgentResponse).mockReturnValue({
      intent: "replan",
      message: "local guidance",
      source: "rules"
    });
    vi.mocked(buildAgentContext).mockResolvedValue({
      intent: "replan",
      freshSync: { attempted: false, succeeded: false },
      sections: [{ title: "Body profile", content: "ok" }]
    });
    vi.mocked(prisma.agentConversation.findFirst).mockResolvedValue({
      id: "conv-1",
      title: "New conversation",
      updatedAt: new Date("2026-06-26T09:00:00+08:00")
    } as never);
    vi.mocked(prisma.agentMessage.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.agentMessage.create).mockResolvedValue({
      id: "msg-1",
      role: "assistant",
      content: ""
    } as never);
    vi.mocked(prisma.agentMessage.update).mockResolvedValue({ id: "msg-1" } as never);
    vi.mocked(prisma.agentConversation.update).mockResolvedValue({
      id: "conv-1",
      title: "New conversation",
      updatedAt: new Date("2026-06-26T09:30:00+08:00")
    } as never);
    vi.mocked(applyMemories).mockResolvedValue({ applied: [], warnings: [] });
    vi.mocked(maybeRefreshSummary).mockResolvedValue({ refreshed: false });
  });

  it("executes reversible actions and returns adjustments", async () => {
    vi.mocked(createAgentResponseForUser).mockResolvedValue({
      intent: "replan",
      message: replyWithActions,
      source: "model"
    });
    vi.mocked(prisma.trainingTask.findFirst).mockResolvedValue({
      id: "t1",
      intensity: "moderate",
      planId: "plan-1",
      date: new Date("2026-06-24"),
      plan: { id: "plan-1", status: "active" }
    } as never);
    vi.mocked(prisma.sleepRecord.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.recoveryRecord.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.calendarSnapshot.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.bodyProfile.findUnique).mockResolvedValue({ injuriesJson: "[]" } as never);
    vi.mocked(executeAgentAction).mockResolvedValue({
      id: "adj-1",
      label: "已将训练强度调整为 easy",
      undoneAt: null
    });

    const response = await POST(
      new Request("http://localhost/api/agent", {
        method: "POST",
        body: JSON.stringify({ conversationId: "conv-1", message: "把周三降为 easy" })
      })
    );

    expect(executeAgentAction).toHaveBeenCalledWith(
      "user-1",
      { id: "adjust_task_intensity", args: { taskId: "t1", intensity: "easy" } },
      "msg-1"
    );
    const body = await response.json();
    expect(body.adjustments).toEqual([{ id: "adj-1", label: "已将训练强度调整为 easy", undoneAt: null }]);
    expect(body.message).toContain("已为你把周三降为 easy");
  });

  it("reports a safety block in the message and does not execute", async () => {
    vi.mocked(createAgentResponseForUser).mockResolvedValue({
      intent: "replan",
      message: [
        "<explanation>尝试上调强度</explanation>",
        "<actions>",
        '[{"id":"adjust_task_intensity","args":{"taskId":"t1","intensity":"moderate"}}]',
        "</actions>"
      ].join("\n"),
      source: "model"
    });
    vi.mocked(prisma.trainingTask.findFirst).mockResolvedValue({
      id: "t1",
      intensity: "easy",
      planId: "plan-1",
      date: new Date("2026-06-24"),
      plan: { id: "plan-1", status: "active" }
    } as never);
    vi.mocked(prisma.sleepRecord.findFirst).mockResolvedValue({ qualityScore: 40 } as never);
    vi.mocked(prisma.recoveryRecord.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.calendarSnapshot.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.bodyProfile.findUnique).mockResolvedValue({ injuriesJson: "[]" } as never);

    const response = await POST(
      new Request("http://localhost/api/agent", {
        method: "POST",
        body: JSON.stringify({ conversationId: "conv-1", message: "今天升强度" })
      })
    );

    expect(executeAgentAction).toHaveBeenCalledWith(
      "user-1",
      { id: "adjust_task_intensity", args: { taskId: "t1", intensity: "easy" } },
      "msg-1"
    );
    const body = await response.json();
    expect(body.message).toContain("Recovery/sleep/injury signals block");
  });

  it("applies memories with explicit source when the user asks to remember something", async () => {
    vi.mocked(createAgentResponseForUser).mockResolvedValue({
      intent: "general",
      message: [
        "<explanation>好的，我记住了你喜欢晨跑</explanation>",
        "<memories>",
        '[{"op":"add","kind":"preference","category":"training","content":"喜欢晨跑","confidence":0.9}]',
        "</memories>"
      ].join("\n"),
      source: "model"
    });
    vi.mocked(applyMemories).mockResolvedValue({
      applied: [{ op: "add", id: "mem-1", content: "喜欢晨跑", status: "created" }],
      warnings: []
    });

    const response = await POST(
      new Request("http://localhost/api/agent", {
        method: "POST",
        body: JSON.stringify({ conversationId: "conv-1", message: "记住我喜欢晨跑" })
      })
    );

    expect(applyMemories).toHaveBeenCalledWith(
      "user-1",
      [{ op: "add", kind: "preference", category: "training", content: "喜欢晨跑", confidence: 0.9, targetContent: undefined }],
      expect.objectContaining({ source: "explicit", conversationId: "conv-1" })
    );
    const body = await response.json();
    expect(body.message).toContain("已记住：喜欢晨跑");
    expect(body.message).not.toContain("<memories>");
  });

  it("applies memories with auto source for ordinary messages", async () => {
    vi.mocked(createAgentResponseForUser).mockResolvedValue({
      intent: "general",
      message: [
        "<explanation>了解了</explanation>",
        "<memories>",
        '[{"op":"add","kind":"fact","category":"nutrition","content":"对麸质过敏","confidence":0.8}]',
        "</memories>"
      ].join("\n"),
      source: "model"
    });
    vi.mocked(applyMemories).mockResolvedValue({ applied: [], warnings: [] });

    await POST(
      new Request("http://localhost/api/agent", {
        method: "POST",
        body: JSON.stringify({ conversationId: "conv-1", message: "我对麸质过敏" })
      })
    );

    expect(applyMemories).toHaveBeenCalledWith(
      "user-1",
      expect.any(Array),
      expect.objectContaining({ source: "auto" })
    );
  });
});
