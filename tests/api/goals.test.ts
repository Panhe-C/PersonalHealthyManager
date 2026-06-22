import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, PATCH } from "@/app/api/goals/[goalId]/route";
import { removeGoal, updateGoal } from "@/src/services/goalService";

vi.mock("@/src/auth/api", () => ({
  withUser:
    (handler: (...args: unknown[]) => Promise<Response>) =>
    (request: Request, context: { params: Promise<{ goalId: string }> }) =>
      handler({ id: "user-1", timezone: "Asia/Shanghai" }, request, context)
}));

vi.mock("@/src/services/goalService", () => ({
  removeGoal: vi.fn(),
  updateGoal: vi.fn()
}));

describe("goals API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates a goal owned by the current user", async () => {
    vi.mocked(updateGoal).mockResolvedValue({
      id: "goal-1",
      title: "Marathon",
      type: "primary",
      priority: 10,
      status: "active"
    } as never);

    const response = await PATCH(
      new Request("http://localhost/api/goals/goal-1", {
        method: "PATCH",
        body: JSON.stringify({
          title: "Marathon",
          type: "primary",
          priority: 10,
          status: "active",
          metrics: {}
        })
      }),
      { params: Promise.resolve({ goalId: "goal-1" }) }
    );

    expect(updateGoal).toHaveBeenCalledWith("user-1", "goal-1", {
      title: "Marathon",
      type: "primary",
      priority: 10,
      status: "active",
      metrics: {}
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ id: "goal-1", title: "Marathon" }));
  });

  it("removes a goal from active planning for the current user", async () => {
    vi.mocked(removeGoal).mockResolvedValue({ id: "goal-1", status: "paused" } as never);

    const response = await DELETE(new Request("http://localhost/api/goals/goal-1", { method: "DELETE" }), {
      params: Promise.resolve({ goalId: "goal-1" })
    });

    expect(removeGoal).toHaveBeenCalledWith("user-1", "goal-1");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
