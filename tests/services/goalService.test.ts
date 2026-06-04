import { describe, expect, it } from "vitest";
import { sortGoalsByPriority } from "@/src/services/goalService";

describe("goal service", () => {
  it("sorts primary and event goals by priority", () => {
    const goals = sortGoalsByPriority([
      { title: "Sleep better", type: "long_term", priority: 3 },
      { title: "Marathon", type: "short_term_event", priority: 9 },
      { title: "Fat loss", type: "primary", priority: 8 }
    ]);

    expect(goals.map((goal) => goal.title)).toEqual(["Marathon", "Fat loss", "Sleep better"]);
  });

  it("does not mutate the caller's goal order", () => {
    const goals = [
      { title: "Sleep better", type: "long_term", priority: 3 },
      { title: "Marathon", type: "short_term_event", priority: 9 }
    ];

    sortGoalsByPriority(goals);

    expect(goals.map((goal) => goal.title)).toEqual(["Sleep better", "Marathon"]);
  });
});
