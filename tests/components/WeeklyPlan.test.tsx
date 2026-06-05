import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WeeklyPlan } from "@/components/WeeklyPlan";

vi.mock("@/components/Checklist", () => ({
  Checklist: () => <div data-testid="checklist" />
}));

const plan = {
  summary: "Marathon build",
  explanation: "Balanced load for race preparation.",
  trainingTasks: [
    {
      id: "today",
      date: new Date(2026, 5, 4),
      title: "Tempo run",
      trainingType: "run",
      status: "planned",
      intensity: "moderate",
      durationMinutes: 45,
      scheduledStart: new Date(2026, 5, 4, 18),
      checklistItems: [{ id: "warmup", label: "Warm up", status: "pending" }]
    },
    {
      id: "saturday",
      date: new Date(2026, 5, 6),
      title: "Long run",
      trainingType: "run",
      status: "planned",
      intensity: "easy",
      durationMinutes: 90,
      scheduledStart: null,
      checklistItems: []
    }
  ]
};

describe("WeeklyPlan", () => {
  it("renders a seven-day ledger and expands today's task", () => {
    const { container } = render(
      <WeeklyPlan
        plan={plan}
        activities={[]}
        today={new Date(2026, 5, 4)}
        weekStart={new Date(2026, 5, 1)}
      />
    );

    const ledger = screen.getByLabelText("Week ledger");
    expect(within(ledger).getAllByRole("article")).toHaveLength(7);
    expect(container.querySelector("#task-today")).toHaveAttribute("open");
    expect(container.querySelector("#task-saturday")).not.toHaveAttribute("open");
  });
});
