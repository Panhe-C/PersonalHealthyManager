import { describe, expect, it } from "vitest";
import { createCalendarDraftsFromTasks } from "@/src/planning/calendarDrafts";

describe("calendar draft generation", () => {
  it("creates draft events from scheduled training tasks", () => {
    const drafts = createCalendarDraftsFromTasks([
      {
        id: "task-1",
        title: "Aerobic base session",
        scheduledStart: "2026-06-02T10:00:00.000Z",
        scheduledEnd: "2026-06-02T11:00:00.000Z",
        trainingType: "run",
        intensity: "moderate"
      }
    ]);

    expect(drafts[0]).toMatchObject({
      title: "Training: Aerobic base session",
      notes: "Type: run. Intensity: moderate.",
      trainingTaskId: "task-1"
    });
  });

  it("ignores tasks without a complete scheduled window", () => {
    const drafts = createCalendarDraftsFromTasks([
      {
        id: "task-1",
        title: "Strength maintenance",
        trainingType: "strength",
        intensity: "moderate"
      }
    ]);

    expect(drafts).toEqual([]);
  });
});
