import { describe, expect, it } from "vitest";
import { reconcileChecklistCompletion } from "@/src/planning/checklist";

describe("training checklist reconciliation", () => {
  it("marks all items completed as a completed training task", () => {
    const result = reconcileChecklistCompletion({
      plannedLoad: 80,
      items: [
        { label: "Warmup", status: "completed" },
        { label: "Main set", status: "completed" },
        { label: "Cooldown", status: "completed" }
      ]
    });

    expect(result.status).toBe("completed");
    expect(result.remainingLoadAdjustment).toBe(0);
  });

  it("reduces remaining weekly load after over-completion", () => {
    const result = reconcileChecklistCompletion({
      plannedLoad: 80,
      actualLoad: 130,
      items: [{ label: "Workout", status: "completed" }]
    });

    expect(result.status).toBe("over_completed");
    expect(result.remainingLoadAdjustment).toBe(-50);
  });

  it("returns a reschedule recommendation when skipped", () => {
    const result = reconcileChecklistCompletion({
      plannedLoad: 80,
      items: [{ label: "Workout", status: "skipped" }]
    });

    expect(result.status).toBe("skipped");
    expect(result.adjustmentReason).toContain("reschedule");
  });

  it("calculates a conservative remaining load for partial completion", () => {
    const result = reconcileChecklistCompletion({
      plannedLoad: 90,
      items: [
        { label: "Warmup", status: "completed" },
        { label: "Main set", status: "pending" },
        { label: "Cooldown", status: "completed" }
      ]
    });

    expect(result.status).toBe("partial");
    expect(result.remainingLoadAdjustment).toBe(30);
  });
});
