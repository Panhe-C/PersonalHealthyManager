import { describe, expect, it } from "vitest";
import { generateWeeklyPlan } from "@/src/planning/engine";
import { calendarSnapshot, recovery, sleep } from "@/src/test/factories";

describe("planning engine", () => {
  it("blocks hard training when sleep is poor", () => {
    const plan = generateWeeklyPlan({
      weekStart: new Date("2026-06-01T00:00:00+08:00"),
      profile: { trainingExperience: "intermediate", injuries: [] },
      goals: [{ title: "Marathon", type: "short_term_event", priority: 9 }],
      activities: [],
      sleepRecords: [sleep({ durationMinutes: 280, qualityScore: 45 })],
      recoveryRecords: [recovery({ recoveryPercent: 38 })],
      calendar: calendarSnapshot(),
      mealMenus: []
    });

    expect(plan.tasks[0].intensity).toBe("recovery");
    expect(plan.explanation).toContain("sleep");
  });

  it("uses available calendar windows for scheduled training", () => {
    const plan = generateWeeklyPlan({
      weekStart: new Date("2026-06-01T00:00:00+08:00"),
      profile: { trainingExperience: "intermediate", injuries: [] },
      goals: [{ title: "Fat loss", type: "primary", priority: 8 }],
      activities: [],
      sleepRecords: [sleep()],
      recoveryRecords: [recovery()],
      calendar: calendarSnapshot(),
      mealMenus: []
    });

    expect(plan.tasks[0].scheduledStart).toBe("2026-06-02T10:00:00.000Z");
  });

  it("uses the highest-priority event goal for the endurance session", () => {
    const plan = generateWeeklyPlan({
      weekStart: new Date("2026-06-01T00:00:00+08:00"),
      profile: { trainingExperience: "intermediate", injuries: [] },
      goals: [
        { title: "General fitness", type: "primary", priority: 6 },
        { title: "Marathon", type: "short_term_event", priority: 10 }
      ],
      activities: [],
      sleepRecords: [sleep()],
      recoveryRecords: [recovery()],
      calendar: calendarSnapshot(),
      mealMenus: []
    });

    expect(plan.summary).toContain("Marathon");
    expect(plan.tasks[2].title).toBe("Long easy run");
  });
});
