import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAgentConversation,
  deleteAgentConversationForUser,
  getAgentConversationForUser,
  listAgentConversations,
  titleFromFirstMessage
} from "@/src/services/agentConversations";
import { prisma } from "@/src/db/client";

vi.mock("@/src/db/client", () => ({
  prisma: {
    agentConversation: {
      create: vi.fn(),
      delete: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn()
    }
  }
}));

describe("agent conversation service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists current-user conversations newest first", async () => {
    vi.mocked(prisma.agentConversation.findMany).mockResolvedValue([
      { id: "conv-2", title: "Today", updatedAt: new Date("2026-06-21T09:00:00+08:00") }
    ] as never);

    await expect(listAgentConversations("user-1")).resolves.toEqual([
      { id: "conv-2", title: "Today", updatedAt: "2026-06-21T01:00:00.000Z" }
    ]);
    expect(prisma.agentConversation.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: { id: true, title: true, updatedAt: true }
    });
  });

  it("creates an empty current-user conversation", async () => {
    vi.mocked(prisma.agentConversation.create).mockResolvedValue({
      id: "conv-new",
      title: "New conversation",
      updatedAt: new Date("2026-06-21T09:30:00+08:00")
    } as never);

    await expect(createAgentConversation("user-1")).resolves.toEqual({
      id: "conv-new",
      title: "New conversation",
      updatedAt: "2026-06-21T01:30:00.000Z",
      messages: []
    });
  });

  it("fetches one conversation only when it belongs to the user", async () => {
    vi.mocked(prisma.agentConversation.findFirst).mockResolvedValue({
      id: "conv-1",
      title: "Recovery",
      updatedAt: new Date("2026-06-21T09:30:00+08:00"),
      messages: [{ id: "msg-1", role: "user", content: "最新恢复怎么样？" }]
    } as never);

    await expect(getAgentConversationForUser("user-1", "conv-1")).resolves.toEqual({
      id: "conv-1",
      title: "Recovery",
      updatedAt: "2026-06-21T01:30:00.000Z",
      messages: [{ id: "msg-1", role: "user", content: "最新恢复怎么样？" }]
    });
  });

  it("loads the latest message window and returns it in chronological order", async () => {
    vi.mocked(prisma.agentConversation.findFirst).mockResolvedValue({
      id: "conv-1",
      title: "Recovery",
      updatedAt: new Date("2026-06-21T09:30:00+08:00"),
      messages: [
        { id: "msg-new", role: "assistant", content: "最新回复" },
        { id: "msg-old", role: "user", content: "最新问题" }
      ]
    } as never);

    await expect(getAgentConversationForUser("user-1", "conv-1")).resolves.toMatchObject({
      messages: [
        { id: "msg-old", role: "user", content: "最新问题" },
        { id: "msg-new", role: "assistant", content: "最新回复" }
      ]
    });
    expect(prisma.agentConversation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          messages: expect.objectContaining({
            orderBy: { createdAt: "desc" },
            take: 100
          })
        })
      })
    );
  });

  it("deletes one conversation only when it belongs to the user", async () => {
    vi.mocked(prisma.agentConversation.findFirst).mockResolvedValue({
      id: "conv-1",
      title: "Recovery",
      updatedAt: new Date("2026-06-21T09:30:00+08:00")
    } as never);
    vi.mocked(prisma.agentConversation.delete).mockResolvedValue({
      id: "conv-1"
    } as never);

    await expect(deleteAgentConversationForUser("user-1", "conv-1")).resolves.toBe(true);
    expect(prisma.agentConversation.findFirst).toHaveBeenCalledWith({
      where: { id: "conv-1", userId: "user-1" },
      select: { id: true }
    });
    expect(prisma.agentConversation.delete).toHaveBeenCalledWith({
      where: { id_userId: { id: "conv-1", userId: "user-1" } },
      select: { id: true }
    });
  });

  it("does not delete another user's conversation", async () => {
    vi.mocked(prisma.agentConversation.findFirst).mockResolvedValue(null);

    await expect(deleteAgentConversationForUser("user-1", "conv-other")).resolves.toBe(false);
    expect(prisma.agentConversation.delete).not.toHaveBeenCalled();
  });

  it("builds compact titles from first user messages", () => {
    expect(titleFromFirstMessage("  最新恢复情况怎么样？今天能不能跑  ")).toBe("最新恢复情况怎么样？今天能不能跑");
    expect(titleFromFirstMessage("a".repeat(80))).toBe(`${"a".repeat(46)}...`);
    expect(titleFromFirstMessage("")).toBe("New conversation");
  });
});
