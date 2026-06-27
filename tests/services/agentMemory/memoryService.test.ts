import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyMemories,
  loadActiveMemoriesForContext
} from "@/src/services/agentMemory/memoryService";
import type { MemoryProposal } from "@/src/services/agentMemory/memories";

vi.mock("@/src/db/client", () => {
  const store = {
    agentMemory: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    }
  };
  return { prisma: store };
});

import { prisma } from "@/src/db/client";

const baseCtx = { source: "auto" as const, messageId: "msg-1", conversationId: "conv-1" };

function mockFindMany(rows: Array<{ id: string; content: string }>) {
  vi.mocked(prisma.agentMemory.findMany).mockResolvedValue(rows as never);
}

function mockCreate() {
  vi.mocked(prisma.agentMemory.create).mockImplementation(async (args) => ({
    id: `mem-${Math.random().toString(36).slice(2)}`
  }) as never);
}

function proposal(over: Partial<MemoryProposal>): MemoryProposal {
  return {
    op: "add",
    kind: "preference",
    category: "training",
    content: "习惯晨跑",
    confidence: 0.9,
    ...over
  };
}

describe("applyMemories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate();
    vi.mocked(prisma.agentMemory.update).mockResolvedValue({} as never);
  });

  it("creates a new memory when no duplicate exists", async () => {
    mockFindMany([]);
    const outcome = await applyMemories("user-1", [proposal({ content: "习惯晨跑" })], baseCtx);

    expect(outcome.applied).toHaveLength(1);
    expect(outcome.applied[0].status).toBe("created");
    expect(prisma.agentMemory.create).toHaveBeenCalledOnce();
  });

  it("skips an add that exactly duplicates an existing memory", async () => {
    mockFindMany([{ id: "mem-existing", content: "习惯晨跑" }]);
    const outcome = await applyMemories("user-1", [proposal({ content: "习惯 晨跑！" })], baseCtx);

    expect(outcome.applied[0].status).toBe("skipped");
    expect(prisma.agentMemory.create).not.toHaveBeenCalled();
  });

  it("skips an add whose tokens heavily overlap an existing memory", async () => {
    mockFindMany([{ id: "mem-existing", content: "我每天早上习惯去跑步" }]);
    const outcome = await applyMemories("user-1", [proposal({ content: "每天早上习惯去跑步" })], baseCtx);

    expect(outcome.applied[0].status).toBe("skipped");
    expect(prisma.agentMemory.create).not.toHaveBeenCalled();
  });

  it("drops auto-extracted memories below the confidence threshold", async () => {
    mockFindMany([]);
    const outcome = await applyMemories("user-1", [proposal({ confidence: 0.3 })], baseCtx);

    expect(outcome.applied).toEqual([]);
    expect(outcome.warnings.length).toBe(1);
    expect(prisma.agentMemory.create).not.toHaveBeenCalled();
  });

  it("keeps explicit memories regardless of confidence", async () => {
    mockFindMany([]);
    const outcome = await applyMemories(
      "user-1",
      [proposal({ confidence: 0.2 })],
      { ...baseCtx, source: "explicit" }
    );

    expect(outcome.applied[0].status).toBe("created");
    expect(prisma.agentMemory.create).toHaveBeenCalledOnce();
  });

  it("supersedes a matched memory on update", async () => {
    mockFindMany([{ id: "mem-old", content: "习惯夜跑" }]);
    const outcome = await applyMemories(
      "user-1",
      [proposal({ op: "update", content: "改成晨跑", targetContent: "习惯夜跑" })],
      baseCtx
    );

    expect(outcome.applied[0].status).toBe("superseded");
    expect(prisma.agentMemory.update).toHaveBeenCalledWith({
      where: { id_userId: { id: "mem-old", userId: "user-1" } },
      data: { status: "superseded" }
    });
    expect(prisma.agentMemory.create).toHaveBeenCalledOnce();
  });

  it("falls back to creating a new memory when update target is not found", async () => {
    mockFindMany([{ id: "mem-other", content: "完全不同的内容" }]);
    const outcome = await applyMemories(
      "user-1",
      [proposal({ op: "update", content: "改成晨跑", targetContent: "习惯夜跑" })],
      baseCtx
    );

    expect(outcome.applied[0].status).toBe("created");
    expect(prisma.agentMemory.update).not.toHaveBeenCalled();
  });

  it("soft-deletes a matched memory on delete", async () => {
    mockFindMany([{ id: "mem-old", content: "对麸质过敏" }]);
    const outcome = await applyMemories(
      "user-1",
      [proposal({ op: "delete", content: "对麸质过敏" })],
      baseCtx
    );

    expect(outcome.applied[0].status).toBe("deleted");
    expect(prisma.agentMemory.update).toHaveBeenCalledWith({
      where: { id_userId: { id: "mem-old", userId: "user-1" } },
      data: { status: "deleted" }
    });
  });

  it("warns when a delete target is not found", async () => {
    mockFindMany([{ id: "mem-other", content: "完全不同的内容" }]);
    const outcome = await applyMemories(
      "user-1",
      [proposal({ op: "delete", content: "对麸质过敏" })],
      baseCtx
    );

    expect(outcome.applied).toEqual([]);
    expect(outcome.warnings.length).toBe(1);
  });
});

describe("loadActiveMemoriesForContext", () => {
  beforeEach(() => vi.clearAllMocks());

  it("orders memories by intent-relevant category first, then confidence", async () => {
    vi.mocked(prisma.agentMemory.findMany).mockResolvedValue([
      { id: "1", kind: "fact", category: "general", content: "g", confidence: 1.0, status: "active", updatedAt: new Date(1) },
      { id: "2", kind: "fact", category: "nutrition", content: "n", confidence: 0.7, status: "active", updatedAt: new Date(2) },
      { id: "3", kind: "fact", category: "training", content: "t", confidence: 0.9, status: "active", updatedAt: new Date(3) }
    ] as never);

    const rows = await loadActiveMemoriesForContext("user-1", "training_analysis");

    // training is highest priority for training_analysis, then recovery, then general
    expect(rows.map((row) => row.id)).toEqual(["3", "1", "2"]);
  });
});
