import { describe, expect, it } from "vitest";
import { buildChecklistCompletion, reconcileStoredChecklistItems } from "@/src/services/checklistService";

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

  it("rounds fractional actual load before calculating remaining work", () => {
    const result = buildChecklistCompletion({
      plannedLoad: 70,
      actualLoad: 100.6,
      items: [{ label: "Workout", status: "completed" }]
    });

    expect(JSON.parse(result.completion.plannedVsActualJson)).toMatchObject({
      actualLoad: 101,
      remainingLoadAdjustment: -31
    });
  });

  it("uses all stored checklist items as the authoritative completion state", () => {
    const items = reconcileStoredChecklistItems(
      [
        { id: "warmup", label: "Warmup", status: "pending" },
        { id: "workout", label: "Workout", status: "pending" }
      ],
      [{ id: "warmup", label: "Warmup", status: "completed" }]
    );
    const result = buildChecklistCompletion({ plannedLoad: 60, items });

    expect(result.completion.status).toBe("partial");
    expect(items).toEqual([
      { id: "warmup", label: "Warmup", status: "completed" },
      { id: "workout", label: "Workout", status: "pending" }
    ]);
  });

  it("rejects checklist items that do not belong to the task", () => {
    expect(() =>
      reconcileStoredChecklistItems(
        [{ id: "warmup", label: "Warmup", status: "pending" }],
        [{ id: "other", label: "Other", status: "completed" }]
      )
    ).toThrow("Checklist item does not belong to training task");
  });
});
