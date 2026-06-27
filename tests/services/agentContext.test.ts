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
    calendarEventDraft: { findMany: vi.fn() },
    agentMemory: { findMany: vi.fn() },
    agentConversation: { findFirst: vi.fn(), findMany: vi.fn() }
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
    vi.mocked(prisma.agentMemory.findMany).mockResolvedValue([]);
    vi.mocked(prisma.agentConversation.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.agentConversation.findMany).mockResolvedValue([]);
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

  it("keeps local activity context for weekly sport analysis when fresh sync fails", async () => {
    vi.mocked(syncCorosFromSettings).mockRejectedValue(new Error("COROS MCP returned HTTP 404."));
    vi.mocked(prisma.activityRecord.findMany).mockResolvedValue([
      {
        startedAt: new Date("2026-06-20T06:00:00+08:00"),
        sportType: "boxing",
        durationMinutes: 60,
        distanceKm: null,
        averageHeartRateBpm: 130,
        intensity: "easy"
      },
      {
        startedAt: new Date("2026-06-17T06:30:00+08:00"),
        sportType: "run",
        durationMinutes: 45,
        distanceKm: 7.2,
        averageHeartRateBpm: 148,
        intensity: "moderate"
      }
    ] as never);

    const context = await buildAgentContext("user-1", "training_analysis", "拉取最新数据，分析本周运动情况");

    expect(context.freshSync).toEqual({
      attempted: true,
      succeeded: false,
      error: "COROS MCP returned HTTP 404."
    });
    expect(context.sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Recent activities",
          content: expect.stringContaining("2026-06-20: boxing, 60 min, HR 130, intensity easy.")
        }),
        expect.objectContaining({
          title: "Recent activities",
          content: expect.stringContaining("2026-06-17: run, 45 min, 7.2 km, HR 148, intensity moderate.")
        })
      ])
    );
  });
});
