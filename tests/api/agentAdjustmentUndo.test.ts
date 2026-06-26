import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/agent/adjustments/[id]/undo/route";
import { undoAgentAdjustment } from "@/src/services/agentActions/undo";

vi.mock("@/src/auth/api", () => ({
  withUser:
    (handler: (...args: unknown[]) => Promise<Response>) =>
    (request: Request, context: unknown) =>
      handler({ id: "user-1", timezone: "Asia/Shanghai" }, request, context)
}));

vi.mock("@/src/services/agentActions/undo", () => ({
  undoAgentAdjustment: vi.fn()
}));

describe("agent adjustment undo API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 when the adjustment is undone", async () => {
    vi.mocked(undoAgentAdjustment).mockResolvedValue({ ok: true });

    const response = await POST(
      new Request("http://localhost/api/agent/adjustments/adj-1/undo", { method: "POST" }),
      { params: Promise.resolve({ id: "adj-1" }) }
    );

    expect(undoAgentAdjustment).toHaveBeenCalledWith("user-1", "adj-1");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.id).toBe("adj-1");
    expect(body.undoneAt).toBeTruthy();
  });

  it("returns 404 when the adjustment does not belong to the user", async () => {
    vi.mocked(undoAgentAdjustment).mockResolvedValue({ ok: false, status: 404, error: "Adjustment not found" });

    const response = await POST(
      new Request("http://localhost/api/agent/adjustments/adj-other/undo", { method: "POST" }),
      { params: Promise.resolve({ id: "adj-other" }) }
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Adjustment not found" });
  });

  it("returns 409 when the plan is superseded", async () => {
    vi.mocked(undoAgentAdjustment).mockResolvedValue({ ok: false, status: 409, error: "该调整已过期，无法撤销" });

    const response = await POST(
      new Request("http://localhost/api/agent/adjustments/adj-1/undo", { method: "POST" }),
      { params: Promise.resolve({ id: "adj-1" }) }
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "该调整已过期，无法撤销" });
  });

  it("returns 409 when a touched task has already started", async () => {
    vi.mocked(undoAgentAdjustment).mockResolvedValue({ ok: false, status: 409, error: "部分任务已开始，无法整体撤销" });

    const response = await POST(
      new Request("http://localhost/api/agent/adjustments/adj-1/undo", { method: "POST" }),
      { params: Promise.resolve({ id: "adj-1" }) }
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "部分任务已开始，无法整体撤销" });
  });
});
