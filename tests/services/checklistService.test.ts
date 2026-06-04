import { describe, expect, it } from "vitest";
import {
  buildAdjustedTaskUpdate,
  buildChecklistCompletion,
  reconcileStoredChecklistItems
} from "@/src/services/checklistService";

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

  it("keeps scheduled task timing and calendar draft content aligned after an adjustment", () => {
    const update = buildAdjustedTaskUpdate(
      {
        title: "Long easy run",
        trainingType: "run",
        durationMinutes: 75,
        intensity: "easy",
        scheduledStart: new Date("2026-06-06T08:00:00+08:00")
      },
      {
        title: "Reduced load: Long easy run",
        durationMinutes: 45,
        intensity: "easy"
      }
    );

    expect(update.task.scheduledEnd).toEqual(new Date("2026-06-06T08:45:00+08:00"));
    expect(update.draft).toMatchObject({
      title: "Training: Reduced load: Long easy run",
      endsAt: new Date("2026-06-06T08:45:00+08:00"),
      notes: "Type: run. Intensity: easy.",
      status: "draft",
      failureReason: null
    });
  });

  it("does not extend a scheduled task beyond its original calendar window", () => {
    const update = buildAdjustedTaskUpdate(
      {
        title: "Strength maintenance",
        trainingType: "strength",
        durationMinutes: 35,
        intensity: "moderate",
        scheduledStart: new Date("2026-06-04T18:00:00+08:00"),
        scheduledEnd: new Date("2026-06-04T18:35:00+08:00")
      },
      {
        title: "Rescheduled focus: Strength maintenance",
        durationMinutes: 55
      }
    );

    expect(update.task.durationMinutes).toBe(35);
    expect(update.task.scheduledEnd).toEqual(new Date("2026-06-04T18:35:00+08:00"));
    expect(update.draft?.endsAt).toEqual(new Date("2026-06-04T18:35:00+08:00"));
  });
});
