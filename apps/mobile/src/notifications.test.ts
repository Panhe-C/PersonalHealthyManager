import { describe, expect, it } from "vitest";
import { upcomingReminderTasks } from "./notificationSchedule";

describe("training notifications", () => {
  it("selects only actionable tasks inside the next seven days with a future reminder", () => {
    const now = new Date("2026-07-19T00:00:00.000Z");
    const tasks = [
      { id: "soon", title: "Run", scheduledStart: "2026-07-19T02:00:00.000Z", status: "planned" },
      { id: "too-close", title: "Mobility", scheduledStart: "2026-07-19T00:20:00.000Z", status: "planned" },
      { id: "done", title: "Ride", scheduledStart: "2026-07-20T02:00:00.000Z", status: "completed" },
      { id: "late", title: "Long run", scheduledStart: "2026-07-30T02:00:00.000Z", status: "planned" }
    ];
    expect(upcomingReminderTasks(tasks, now).map((task) => task.id)).toEqual(["soon"]);
  });
});
