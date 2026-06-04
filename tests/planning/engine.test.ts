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

  it("raises the priority of a near-term event goal", () => {
    const plan = generateWeeklyPlan({
      weekStart: new Date("2026-06-01T00:00:00+08:00"),
      profile: { trainingExperience: "intermediate", injuries: [] },
      goals: [
        { title: "Fat loss", type: "primary", priority: 9 },
        {
          title: "Marathon",
          type: "short_term_event",
          priority: 7,
          targetDate: new Date("2026-06-20T00:00:00+08:00")
        }
      ],
      activities: [],
      sleepRecords: [sleep()],
      recoveryRecords: [recovery()],
      calendar: calendarSnapshot(),
      mealMenus: []
    });

    expect(plan.summary).toContain("Marathon");
  });

  it("applies injury and recovery constraints to every task", () => {
    const plan = generateWeeklyPlan({
      weekStart: new Date("2026-06-01T00:00:00+08:00"),
      profile: { trainingExperience: "advanced", injuries: ["knee pain"] },
      goals: [{ title: "Marathon", type: "short_term_event", priority: 10 }],
      activities: [],
      sleepRecords: [sleep()],
      recoveryRecords: [recovery({ recoveryPercent: 35 })],
      calendar: calendarSnapshot(),
      mealMenus: []
    });

    expect(plan.tasks.every((task) => ["recovery", "easy"].includes(task.intensity))).toBe(true);
    expect(Math.max(...plan.tasks.map((task) => task.durationMinutes))).toBeLessThanOrEqual(45);
  });

  it("only schedules tasks into windows that are long enough", () => {
    const plan = generateWeeklyPlan({
      weekStart: new Date("2026-06-01T00:00:00+08:00"),
      profile: { trainingExperience: "intermediate", injuries: [] },
      goals: [{ title: "Fat loss", type: "primary", priority: 8 }],
      activities: [],
      sleepRecords: [sleep()],
      recoveryRecords: [recovery()],
      calendar: calendarSnapshot({
        freeWindows: [
          { start: "2026-06-02T10:00:00.000Z", end: "2026-06-02T10:30:00.000Z" },
          { start: "2026-06-03T10:00:00.000Z", end: "2026-06-03T11:30:00.000Z" }
        ]
      }),
      mealMenus: []
    });

    expect(plan.tasks[0].scheduledStart).toBe("2026-06-03T10:00:00.000Z");
    expect(plan.tasks[0].scheduledEnd).toBe("2026-06-03T10:50:00.000Z");
  });

  it("keeps beginner weekly volume below intermediate volume", () => {
    const baseInput = {
      weekStart: new Date("2026-06-01T00:00:00+08:00"),
      goals: [{ title: "General fitness", type: "primary", priority: 8 }],
      activities: [],
      sleepRecords: [sleep()],
      recoveryRecords: [recovery()],
      calendar: calendarSnapshot(),
      mealMenus: []
    };
    const beginner = generateWeeklyPlan({
      ...baseInput,
      profile: { trainingExperience: "beginner", injuries: [] }
    });
    const intermediate = generateWeeklyPlan({
      ...baseInput,
      profile: { trainingExperience: "intermediate", injuries: [] }
    });

    expect(beginner.tasks.reduce((total, task) => total + task.durationMinutes, 0)).toBeLessThan(
      intermediate.tasks.reduce((total, task) => total + task.durationMinutes, 0)
    );
  });
});
