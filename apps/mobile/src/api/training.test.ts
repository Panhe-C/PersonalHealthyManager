import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      extra: {
        apiBaseUrl: "http://localhost:3000"
      }
    }
  }
}));

const tokenStore = vi.hoisted(() => ({
  getAccessToken: vi.fn(),
  getRefreshToken: vi.fn(),
  setTokens: vi.fn(),
  resetTokens: vi.fn()
}));

vi.mock("../auth/tokenStore", () => ({
  getAccessToken: tokenStore.getAccessToken,
  getRefreshToken: tokenStore.getRefreshToken,
  setTokens: tokenStore.setTokens,
  resetTokens: tokenStore.resetTokens
}));

import { completeTrainingTask, generateActivePlan } from "./training";

const checklistItem = {
  id: "item-1",
  taskId: "task-1",
  label: "完成热身",
  order: 1,
  required: true,
  status: "completed"
};

const trainingTask = {
  id: "task-1",
  planId: "plan-1",
  userId: "user-1",
  date: "2026-07-06T00:00:00.000Z",
  title: "Easy run",
  trainingType: "run",
  durationMinutes: 40,
  intensity: "easy",
  targetJson: "{}",
  scheduledStart: null,
  scheduledEnd: null,
  goalId: null,
  status: "completed",
  checklistItems: [checklistItem],
  completion: { id: "completion-1", status: "completed" },
  createdAt: "2026-07-05T00:00:00.000Z",
  updatedAt: "2026-07-05T01:00:00.000Z"
};

const activePlan = {
  id: "plan-1",
  userId: "user-1",
  weekStart: "2026-07-05T16:00:00.000Z",
  weekEnd: "2026-07-12T15:59:59.999Z",
  status: "active",
  summary: "本周以恢复跑为主",
  trainingLoadGoal: 120,
  nutritionTargetsJson: "{}",
  menuRecommendationsJson: "{}",
  explanation: "根据当前恢复情况生成。",
  trainingTasks: [trainingTask],
  createdAt: "2026-07-05T00:00:00.000Z",
  updatedAt: "2026-07-05T01:00:00.000Z"
};

describe("mobile training actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tokenStore.getAccessToken.mockResolvedValue("access-token");
    vi.stubGlobal("fetch", vi.fn());
  });

  it("submits checklist completion for a training task", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(trainingTask), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    const result = await completeTrainingTask("task-1", {
      actualLoad: 38,
      perceivedEffort: "easy",
      items: [{ id: "item-1", label: "完成热身", status: "completed" }]
    });

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/v1/training/tasks/task-1/completion",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          actualLoad: 38,
          perceivedEffort: "easy",
          items: [{ id: "item-1", label: "完成热身", status: "completed" }]
        })
      })
    );
    expect(result.status).toBe("completed");
    expect(result.completion?.status).toBe("completed");
  });

  it("generates a plan for the requested week", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(activePlan), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    const result = await generateActivePlan("2026-07-05T16:00:00.000Z");

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/v1/plan/generate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ weekStart: "2026-07-05T16:00:00.000Z" })
      })
    );
    expect(result.summary).toBe("本周以恢复跑为主");
  });
});
