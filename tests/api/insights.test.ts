import { beforeEach, describe, expect, it, vi } from "vitest";

const { activityFindMany, recoveryFindMany, sleepFindMany } = vi.hoisted(() => ({
  activityFindMany: vi.fn(),
  recoveryFindMany: vi.fn(),
  sleepFindMany: vi.fn()
}));

vi.mock("@/src/auth/api", () => ({
  withUser:
    (handler: (...args: unknown[]) => Promise<Response>) =>
    (request: Request) =>
      handler({ id: "user-1", timezone: "Asia/Shanghai" }, request)
}));

vi.mock("@/src/db/client", () => ({
  prisma: {
    activityRecord: { findMany: activityFindMany },
    recoveryRecord: { findMany: recoveryFindMany },
    sleepRecord: { findMany: sleepFindMany }
  }
}));

import { GET as getActivities } from "@/app/api/v1/insights/activities/route";
import { GET as getRecovery } from "@/app/api/v1/insights/recovery/route";
import { GET as getSleep } from "@/app/api/v1/insights/sleep/route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/v1/insights/activities", () => {
  it("returns activities ordered by startedAt desc with default limit", async () => {
    activityFindMany.mockResolvedValue([]);

    const response = await getActivities(new Request("http://localhost/api/v1/insights/activities"));

    expect(response.status).toBe(200);
    expect(activityFindMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { startedAt: "desc" },
      take: 50
    });
  });

  it("filters by startedAt when ?since= is provided", async () => {
    activityFindMany.mockResolvedValue([]);

    await getActivities(new Request("http://localhost/api/v1/insights/activities?since=2026-06-01T00:00:00%2B08:00&limit=10"));

    expect(activityFindMany).toHaveBeenCalledWith({
      where: { userId: "user-1", startedAt: { gte: new Date("2026-06-01T00:00:00+08:00") } },
      orderBy: { startedAt: "desc" },
      take: 10
    });
  });

  it("returns 400 for an invalid since datetime", async () => {
    const response = await getActivities(new Request("http://localhost/api/v1/insights/activities?since=not-a-date"));

    expect(response.status).toBe(400);
  });
});

describe("GET /api/v1/insights/recovery", () => {
  it("filters by date when ?since= is provided", async () => {
    recoveryFindMany.mockResolvedValue([]);

    await getRecovery(new Request("http://localhost/api/v1/insights/recovery?since=2026-06-01T00:00:00%2B08:00"));

    expect(recoveryFindMany).toHaveBeenCalledWith({
      where: { userId: "user-1", date: { gte: new Date("2026-06-01T00:00:00+08:00") } },
      orderBy: { date: "desc" },
      take: 50
    });
  });
});

describe("GET /api/v1/insights/sleep", () => {
  it("returns sleep records", async () => {
    sleepFindMany.mockResolvedValue([]);

    const response = await getSleep(new Request("http://localhost/api/v1/insights/sleep"));

    expect(response.status).toBe(200);
    expect(sleepFindMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { date: "desc" },
      take: 50
    });
  });
});
