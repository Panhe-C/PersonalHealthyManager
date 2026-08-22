import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { planFindFirst, recoveryFindFirst, sleepFindFirst, goalFindFirst, loadMealMenusForDate } = vi.hoisted(() => ({
  planFindFirst: vi.fn(),
  recoveryFindFirst: vi.fn(),
  sleepFindFirst: vi.fn(),
  goalFindFirst: vi.fn(),
  loadMealMenusForDate: vi.fn()
}));

vi.mock("@/src/db/client", () => ({
  prisma: {
    plan: { findFirst: planFindFirst },
    recoveryRecord: { findFirst: recoveryFindFirst },
    sleepRecord: { findFirst: sleepFindFirst },
    goal: { findFirst: goalFindFirst }
  }
}));

vi.mock("@/src/services/mealMenuService", () => ({
  loadMealMenusForDate
}));

import { getTodayOverview } from "@/src/services/planQueryService";

const importedMenu = {
  source: "bytecanteen",
  date: new Date("2026-06-29T00:00:00+08:00"),
  meal: "breakfast",
  items: [{ name: "燕麦鸡蛋", calories: 430, proteinGrams: 24, carbohydrateGrams: 52, fatGrams: 12, tags: [] }]
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-29T01:00:00.000Z"));
  vi.clearAllMocks();
  recoveryFindFirst.mockResolvedValue(null);
  sleepFindFirst.mockResolvedValue(null);
  goalFindFirst.mockResolvedValue(null);
  loadMealMenusForDate.mockResolvedValue({ status: "ok", menus: [importedMenu] });
});

afterEach(() => {
  vi.useRealTimers();
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
    expect(result.mealMenus).toEqual([importedMenu]);
    expect(result.mealMenuStatus).toBe("ok");
  });

  it("returns empty tasks when there is no active plan", async () => {
    planFindFirst.mockResolvedValue(null);
    const result = await getTodayOverview("user-1", "Asia/Shanghai");
    expect(result.todayTasks).toEqual([]);
    expect(result.activePlanId).toBeNull();
  });

  it("reports no menus when the account has no meal menu connection", async () => {
    planFindFirst.mockResolvedValue(null);
    loadMealMenusForDate.mockResolvedValue({ status: "not_configured", menus: [] });

    const result = await getTodayOverview("user-1", "Asia/Shanghai");

    expect(result.mealMenus).toEqual([]);
    expect(result.mealMenuStatus).toBe("not_configured");
  });
});
