import { beforeEach, describe, expect, it, vi } from "vitest";

const { planFindFirst, recoveryFindFirst, sleepFindFirst, goalFindFirst } = vi.hoisted(() => ({
  planFindFirst: vi.fn(),
  recoveryFindFirst: vi.fn(),
  sleepFindFirst: vi.fn(),
  goalFindFirst: vi.fn()
}));

vi.mock("@/src/db/client", () => ({
  prisma: {
    plan: { findFirst: planFindFirst },
    recoveryRecord: { findFirst: recoveryFindFirst },
    sleepRecord: { findFirst: sleepFindFirst },
    goal: { findFirst: goalFindFirst }
  }
}));

import { getTodayOverview } from "@/src/services/planQueryService";

beforeEach(() => {
  vi.clearAllMocks();
  recoveryFindFirst.mockResolvedValue(null);
  sleepFindFirst.mockResolvedValue(null);
  goalFindFirst.mockResolvedValue(null);
});

describe("getTodayOverview timezone filtering", () => {
  it("keeps only tasks whose date falls on the user's current calendar day", async () => {
    // Monday 2026-06-29 09:00 Asia/Shanghai => 01:00 UTC. Tasks on 06-29 (Shanghai) stay.
    planFindFirst.mockResolvedValue({
      id: "plan-1",
      trainingTasks: [
        { id: "t1", date: new Date("2026-06-29T00:30:00+08:00") }, // early Monday Shanghai
        { id: "t2", date: new Date("2026-06-28T23:30:00+08:00") }, // Sunday Shanghai
        { id: "t3", date: new Date("2026-06-29T22:00:00+08:00") }  // late Monday Shanghai
      ]
    });

    const result = await getTodayOverview("user-1", "Asia/Shanghai");

    expect(result.todayTasks.map((t) => t.id)).toEqual(["t1", "t3"]);
    expect(result.activePlanId).toBe("plan-1");
  });

  it("returns empty tasks when there is no active plan", async () => {
    planFindFirst.mockResolvedValue(null);
    const result = await getTodayOverview("user-1", "Asia/Shanghai");
    expect(result.todayTasks).toEqual([]);
    expect(result.activePlanId).toBeNull();
  });
});
