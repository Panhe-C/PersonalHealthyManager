import { describe, expect, it } from "vitest";
import { buildChecklistCompletion } from "@/src/services/checklistService";

describe("checklist completion service helpers", () => {
  it("builds a completion payload and adjustment from checklist state", () => {
    const result = buildChecklistCompletion({
      plannedLoad: 70,
      items: [
        { label: "Warmup", status: "completed" },
        { label: "Main run", status: "skipped" },
        { label: "Cooldown", status: "completed" }
      ]
    });

    expect(result.completion.status).toBe("partial");
    expect(result.adjustment.reason).toContain("partially completed");
    expect(result.remainingLoadAdjustment).toBeGreaterThan(0);
  });

  it("records explicit actual load in the comparison payload", () => {
    const result = buildChecklistCompletion({
      plannedLoad: 70,
      actualLoad: 100,
      items: [{ label: "Workout", status: "completed" }]
    });

    expect(JSON.parse(result.completion.plannedVsActualJson)).toMatchObject({
      plannedLoad: 70,
      actualLoad: 100,
      remainingLoadAdjustment: -30
    });
  });
});
