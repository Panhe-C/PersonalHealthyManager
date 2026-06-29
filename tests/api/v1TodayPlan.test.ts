import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/src/auth/api", () => ({
  withUser:
    (handler: (...args: unknown[]) => Promise<Response>) =>
    (request: Request) =>
      handler({ id: "user-1", timezone: "Asia/Shanghai" }, request)
}));

const { getActivePlan, getTodayOverview } = vi.hoisted(() => ({
  getActivePlan: vi.fn(),
  getTodayOverview: vi.fn()
}));

vi.mock("@/src/services/planQueryService", () => ({
  getActivePlan,
  getTodayOverview
}));

import { GET as getActive } from "@/app/api/v1/plan/active/route";
import { GET as getToday } from "@/app/api/v1/today/route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/v1/plan/active", () => {
  it("returns the active plan for the current user", async () => {
    const plan = { id: "plan-1", weekStart: "2026-06-29T00:00:00+08:00", trainingTasks: [] };
    getActivePlan.mockResolvedValue(plan);

    const response = await getActive(new Request("http://localhost/api/v1/plan/active"));

    expect(response.status).toBe(200);
    expect(getActivePlan).toHaveBeenCalledWith("user-1");
    expect(await response.json()).toMatchObject({ id: "plan-1" });
  });

  it("returns null when there is no active plan", async () => {
    getActivePlan.mockResolvedValue(null);
    const response = await getActive(new Request("http://localhost/api/v1/plan/active"));
    expect(response.status).toBe(200);
    expect(await response.json()).toBeNull();
  });
});

describe("GET /api/v1/today", () => {
  it("returns today overview filtered to the user timezone", async () => {
    const overview = {
      date: "2026-06-29T00:00:00.000Z",
      primaryGoal: { id: "g1", title: "Run", type: "primary", priority: 5, status: "active" },
      latestRecovery: null,
      latestSleep: null,
      todayTasks: [],
      activePlanId: "plan-1"
    };
    getTodayOverview.mockResolvedValue(overview);

    const response = await getToday(new Request("http://localhost/api/v1/today"));

    expect(response.status).toBe(200);
    expect(getTodayOverview).toHaveBeenCalledWith("user-1", "Asia/Shanghai");
    expect(await response.json()).toMatchObject({ activePlanId: "plan-1" });
  });
});
