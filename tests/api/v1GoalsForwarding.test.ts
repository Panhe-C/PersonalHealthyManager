import { beforeEach, describe, expect, it, vi } from "vitest";

// The v1 route re-exports handlers from the non-v1 route, which use withUser + goalService.
// Mocking goalService verifies the v1 route wires through to the same service logic.
vi.mock("@/src/auth/api", () => ({
  withUser:
    (handler: (...args: unknown[]) => Promise<Response>) =>
    (request: Request) =>
      handler({ id: "user-1", timezone: "Asia/Shanghai" }, request)
}));

vi.mock("@/src/services/goalService", () => ({
  createGoal: vi.fn(),
  listGoals: vi.fn()
}));

import { GET, POST } from "@/app/api/v1/goals/route";
import { createGoal, listGoals } from "@/src/services/goalService";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("/api/v1/goals thin forwarding", () => {
  it("GET forwards to listGoals", async () => {
    vi.mocked(listGoals).mockResolvedValue([] as never);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(listGoals).toHaveBeenCalledWith("user-1");
  });

  it("POST forwards to createGoal", async () => {
    vi.mocked(createGoal).mockResolvedValue({ id: "g1" } as never);

    const response = await POST(
      new Request("http://localhost/api/v1/goals", {
        method: "POST",
        body: JSON.stringify({ title: "Goal", type: "long_term", priority: 5 })
      })
    );

    expect(response.status).toBe(201);
    expect(createGoal).toHaveBeenCalledWith("user-1", expect.objectContaining({ title: "Goal" }));
  });
});
