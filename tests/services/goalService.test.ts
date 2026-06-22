import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/src/db/client";
import { removeGoal, sortGoalsByPriority, updateGoal } from "@/src/services/goalService";

vi.mock("@/src/db/client", () => ({
  prisma: {
    goal: {
      update: vi.fn(),
      updateMany: vi.fn()
    },
    $transaction: vi.fn()
  }
}));

describe("goal service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(prisma as never));
  });

  it("sorts primary and event goals by priority", () => {
    const goals = sortGoalsByPriority([
      { title: "Sleep better", type: "long_term", priority: 3 },
      { title: "Marathon", type: "short_term_event", priority: 9 },
      { title: "Fat loss", type: "primary", priority: 8 }
    ]);

    expect(goals.map((goal) => goal.title)).toEqual(["Marathon", "Fat loss", "Sleep better"]);
  });

  it("does not mutate the caller's goal order", () => {
    const goals = [
      { title: "Sleep better", type: "long_term", priority: 3 },
      { title: "Marathon", type: "short_term_event", priority: 9 }
    ];

    sortGoalsByPriority(goals);

    expect(goals.map((goal) => goal.title)).toEqual(["Sleep better", "Marathon"]);
  });

  it("demotes other active primary goals when updating a goal to active primary", async () => {
    vi.mocked(prisma.goal.update).mockResolvedValue({
      id: "goal-1",
      userId: "user-1",
      title: "Marathon",
      type: "primary",
      priority: 10,
      status: "active",
      targetDate: null,
      metricsJson: "{}",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z")
    } as never);

    await updateGoal("user-1", "goal-1", {
      title: "Marathon",
      type: "primary",
      priority: 10,
      status: "active",
      metrics: {}
    });

    expect(prisma.goal.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", type: "primary", status: "active", NOT: { id: "goal-1" } },
      data: { type: "secondary" }
    });
    expect(prisma.goal.update).toHaveBeenCalledWith({
      where: { id_userId: { id: "goal-1", userId: "user-1" } },
      data: expect.objectContaining({
        title: "Marathon",
        type: "primary",
        priority: 10,
        status: "active",
        metricsJson: "{}"
      })
    });
  });

  it("removes a goal from active planning without deleting the row", async () => {
    vi.mocked(prisma.goal.update).mockResolvedValue({
      id: "goal-1",
      userId: "user-1",
      title: "Sleep better",
      type: "long_term",
      priority: 6,
      status: "paused",
      targetDate: null,
      metricsJson: "{}",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z")
    } as never);

    await removeGoal("user-1", "goal-1");

    expect(prisma.goal.update).toHaveBeenCalledWith({
      where: { id_userId: { id: "goal-1", userId: "user-1" } },
      data: { status: "paused" }
    });
  });
});
