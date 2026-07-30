import { describe, expect, it } from "vitest";
import {
  layoutDaySchedule,
  localMinutesInDay,
  scheduleStatusLabel,
  scheduleStatusTone,
  type ScheduleTaskLike
} from "./scheduleLayout";

const TZ = "Asia/Shanghai";

function task(overrides: Partial<ScheduleTaskLike>): ScheduleTaskLike {
  return {
    id: overrides.id ?? "t1",
    title: overrides.title ?? "训练",
    status: overrides.status ?? "pending",
    durationMinutes: overrides.durationMinutes ?? 30,
    scheduledStart: overrides.scheduledStart ?? null,
    scheduledEnd: overrides.scheduledEnd ?? null
  };
}

describe("localMinutesInDay", () => {
  it("returns minutes since local midnight", () => {
    expect(localMinutesInDay("2026-07-29T12:30:00+08:00", TZ)).toBe(750);
    // A UTC timestamp that lands on a different clock time in Shanghai.
    expect(localMinutesInDay("2026-07-29T04:30:00.000Z", TZ)).toBe(750);
  });

  it("returns null for unparseable input", () => {
    expect(localMinutesInDay("not-a-date", TZ)).toBeNull();
  });
});

describe("layoutDaySchedule", () => {
  it("positions a task by its scheduled window", () => {
    const { timed } = layoutDaySchedule(
      [task({ scheduledStart: "2026-07-29T12:00:00+08:00", scheduledEnd: "2026-07-29T12:25:00+08:00" })],
      { timeZone: TZ, startHour: 6, hourHeight: 60 }
    );

    expect(timed).toHaveLength(1);
    expect(timed[0].top).toBe(360); // 12:00 is six hours past the 6:00 ruler start
    expect(timed[0].height).toBe(44); // 25 minutes scales to 25pt, below the 44pt minimum
  });

  it("scales card height with duration beyond the minimum", () => {
    const { timed } = layoutDaySchedule(
      [task({ scheduledStart: "2026-07-29T09:00:00+08:00", scheduledEnd: "2026-07-29T11:00:00+08:00" })],
      { timeZone: TZ, startHour: 6, hourHeight: 60 }
    );

    expect(timed[0].top).toBe(180);
    expect(timed[0].height).toBe(120);
  });

  it("clamps sessions that start before the ruler instead of dropping them", () => {
    const { timed, untimed } = layoutDaySchedule(
      [task({ scheduledStart: "2026-07-29T04:00:00+08:00", scheduledEnd: "2026-07-29T07:00:00+08:00" })],
      { timeZone: TZ, startHour: 6, hourHeight: 60 }
    );

    expect(untimed).toHaveLength(0);
    expect(timed[0].top).toBe(0);
    expect(timed[0].height).toBe(60);
  });

  it("sends untimed and inverted windows to the untimed list", () => {
    const { timed, untimed } = layoutDaySchedule(
      [
        task({ id: "no-time" }),
        task({
          id: "backwards",
          scheduledStart: "2026-07-29T10:00:00+08:00",
          scheduledEnd: "2026-07-29T09:00:00+08:00"
        })
      ],
      { timeZone: TZ }
    );

    expect(timed).toHaveLength(0);
    expect(untimed.map((item) => item.id)).toEqual(["no-time", "backwards"]);
  });

  it("sorts cards by start time", () => {
    const { timed } = layoutDaySchedule(
      [
        task({ id: "late", scheduledStart: "2026-07-29T18:00:00+08:00", scheduledEnd: "2026-07-29T19:00:00+08:00" }),
        task({ id: "early", scheduledStart: "2026-07-29T08:00:00+08:00", scheduledEnd: "2026-07-29T09:00:00+08:00" })
      ],
      { timeZone: TZ }
    );

    expect(timed.map((item) => item.task.id)).toEqual(["early", "late"]);
  });
});

describe("schedule status presentation", () => {
  it("maps status to Chinese labels", () => {
    expect(scheduleStatusLabel("completed")).toBe("已完成");
    expect(scheduleStatusLabel("skipped")).toBe("已跳过");
    expect(scheduleStatusLabel("pending")).toBe("待完成");
    expect(scheduleStatusLabel("planned")).toBe("待完成");
  });

  it("maps status to accent tones", () => {
    expect(scheduleStatusTone("completed")).toBe("tint");
    expect(scheduleStatusTone("skipped")).toBe("labelTertiary");
    expect(scheduleStatusTone("pending")).toBe("controlFill");
  });
});
