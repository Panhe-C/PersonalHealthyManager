import { describe, expect, it } from "vitest";
import { buildWeekLedger, selectFocusedTaskId } from "@/src/presentation/weekLedger";

const task = (id: string, date: Date) => ({
  id,
  date,
  title: id,
  trainingType: "run",
  durationMinutes: 45,
  intensity: "moderate",
  status: "planned"
});

describe("week ledger presentation", () => {
  it("builds seven local-date columns and groups tasks into their day", () => {
    const monday = new Date(2026, 5, 1);
    const ledger = buildWeekLedger(
      [task("tuesday-a", new Date(2026, 5, 2, 7)), task("tuesday-b", new Date(2026, 5, 2, 18))],
      monday,
      new Date(2026, 5, 4)
    );

    expect(ledger).toHaveLength(7);
    expect(ledger[1].tasks.map((item) => item.id)).toEqual(["tuesday-a", "tuesday-b"]);
    expect(ledger[3].isToday).toBe(true);
  });

  it("focuses today's first task", () => {
    expect(
      selectFocusedTaskId(
        [task("yesterday", new Date(2026, 5, 3)), task("today", new Date(2026, 5, 4, 18))],
        new Date(2026, 5, 4, 8)
      )
    ).toBe("today");
  });

  it("focuses the nearest upcoming task when today is empty", () => {
    expect(
      selectFocusedTaskId(
        [task("later", new Date(2026, 5, 6)), task("next", new Date(2026, 5, 5))],
        new Date(2026, 5, 4)
      )
    ).toBe("next");
  });

  it("focuses the most recent task when no upcoming task exists", () => {
    expect(
      selectFocusedTaskId(
        [task("older", new Date(2026, 5, 1)), task("recent", new Date(2026, 5, 3))],
        new Date(2026, 5, 4)
      )
    ).toBe("recent");
  });
});
