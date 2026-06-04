import { beforeEach, describe, expect, it, vi } from "vitest";
import { completeTrainingTask } from "@/src/services/checklistService";
import { POST } from "@/app/api/training/tasks/[id]/completion/route";

vi.mock("@/src/auth/api", () => ({
  withUser:
    (handler: (...args: unknown[]) => Promise<Response>) =>
    (request: Request, context: { params: Promise<{ id: string }> }) =>
      handler({ id: "user-1" }, request, context)
}));

vi.mock("@/src/services/checklistService", () => ({
  completeTrainingTask: vi.fn()
}));

describe("training completion API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for a negative actual load", async () => {
    const response = await POST(
      new Request("http://localhost/api/training/tasks/task-1/completion", {
        method: "POST",
        body: JSON.stringify({
          actualLoad: -1,
          items: [{ id: "item-1", label: "Warmup", status: "completed" }]
        })
      }),
      { params: Promise.resolve({ id: "task-1" }) }
    );

    expect(response.status).toBe(400);
    expect(completeTrainingTask).not.toHaveBeenCalled();
  });

  it("returns 400 when checklist items are empty", async () => {
    const response = await POST(
      new Request("http://localhost/api/training/tasks/task-1/completion", {
        method: "POST",
        body: JSON.stringify({ items: [] })
      }),
      { params: Promise.resolve({ id: "task-1" }) }
    );

    expect(response.status).toBe(400);
    expect(completeTrainingTask).not.toHaveBeenCalled();
  });
});
