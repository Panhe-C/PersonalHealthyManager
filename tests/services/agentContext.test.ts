import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildAgentContext, shouldRefreshCoros } from "@/src/services/agentContext";
import { prisma } from "@/src/db/client";
import { syncCorosFromSettings } from "@/src/services/syncService";

vi.mock("@/src/services/syncService", () => ({ syncCorosFromSettings: vi.fn() }));

vi.mock("@/src/db/client", () => ({
  prisma: {
    bodyProfile: { findUnique: vi.fn() },
    goal: { findMany: vi.fn() },
    activityRecord: { findMany: vi.fn() },
    sleepRecord: { findMany: vi.fn() },
    recoveryRecord: { findMany: vi.fn() },
    plan: { findFirst: vi.fn() },
    calendarSnapshot: { findFirst: vi.fn() },
    calendarEventDraft: { findMany: vi.fn() }
  }
}));

describe("agent context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.bodyProfile.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.goal.findMany).mockResolvedValue([]);
    vi.mocked(prisma.activityRecord.findMany).mockResolvedValue([]);
    vi.mocked(prisma.sleepRecord.findMany).mockResolvedValue([]);
    vi.mocked(prisma.recoveryRecord.findMany).mockResolvedValue([]);
    vi.mocked(prisma.plan.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.calendarSnapshot.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.calendarEventDraft.findMany).mockResolvedValue([]);
  });

  it("detects explicit fresh-data phrases", () => {
    expect(shouldRefreshCoros("同步一下最新 COROS 数据")).toBe(true);
    expect(shouldRefreshCoros("pull latest recovery")).toBe(true);
    expect(shouldRefreshCoros("我昨晚没睡好，今天还适合跑吗？")).toBe(false);
  });

  it("loads recovery context without live sync by default", async () => {
    vi.mocked(prisma.sleepRecord.findMany).mockResolvedValue([
      { date: new Date("2026-06-20T00:00:00+08:00"), durationMinutes: 390, qualityScore: 72 }
    ] as never);
    vi.mocked(prisma.recoveryRecord.findMany).mockResolvedValue([
      { date: new Date("2026-06-20T00:00:00+08:00"), recoveryPercent: 64, hrvMs: 45, restingHeartRateBpm: 58 }
    ] as never);

    const context = await buildAgentContext("user-1", "recovery_check", "我昨晚没睡好，今天还适合跑吗？");

    expect(syncCorosFromSettings).not.toHaveBeenCalled();
    expect(context.freshSync).toEqual({ attempted: false, succeeded: false });
    expect(context.sections.map((section) => section.title)).toContain("Recent sleep");
    expect(context.sections.map((section) => section.title)).toContain("Recent recovery");
  });

  it("runs COROS sync only when latest data is requested", async () => {
    vi.mocked(syncCorosFromSettings).mockResolvedValue({ activities: 1, sleep: 1, recovery: 1 });

    const context = await buildAgentContext("user-1", "recovery_check", "同步一下最新恢复数据");

    expect(syncCorosFromSettings).toHaveBeenCalledWith("user-1");
    expect(context.freshSync).toEqual({ attempted: true, succeeded: true });
  });

  it("keeps local context when COROS sync fails", async () => {
    vi.mocked(syncCorosFromSettings).mockRejectedValue(new Error("COROS MCP endpoint is not configured."));

    const context = await buildAgentContext("user-1", "recovery_check", "拉取最新恢复数据");

    expect(context.freshSync).toEqual({
      attempted: true,
      succeeded: false,
      error: "COROS MCP endpoint is not configured."
    });
  });
});
