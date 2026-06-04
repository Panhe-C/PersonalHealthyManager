import { describe, expect, it } from "vitest";
import { normalizeFeishuCalendarSnapshot } from "@/src/providers/calendar";

describe("Feishu calendar normalization", () => {
  it("normalizes busy and free windows for planning", () => {
    const snapshot = normalizeFeishuCalendarSnapshot({
      rangeStart: "2026-06-01T00:00:00+08:00",
      rangeEnd: "2026-06-07T23:59:59+08:00",
      busy: [
        { start: "2026-06-02T09:00:00+08:00", end: "2026-06-02T10:00:00+08:00", title: "Weekly sync" }
      ],
      free: [
        { start: "2026-06-02T18:30:00+08:00", end: "2026-06-02T19:30:00+08:00" }
      ]
    });

    expect(snapshot.source).toBe("feishu");
    expect(snapshot.rangeStart.toISOString()).toBe("2026-05-31T16:00:00.000Z");
    expect(snapshot.rangeEnd.toISOString()).toBe("2026-06-07T15:59:59.000Z");
    expect(snapshot.busyWindows).toEqual([
      {
        start: "2026-06-02T01:00:00.000Z",
        end: "2026-06-02T02:00:00.000Z",
        title: "Weekly sync"
      }
    ]);
    expect(snapshot.freeWindows).toEqual([
      {
        start: "2026-06-02T10:30:00.000Z",
        end: "2026-06-02T11:30:00.000Z"
      }
    ]);
  });

  it("extracts important events from travel, health, and race titles", () => {
    const snapshot = normalizeFeishuCalendarSnapshot({
      rangeStart: "2026-06-01T00:00:00+08:00",
      rangeEnd: "2026-06-07T23:59:59+08:00",
      busy: [
        { start: "2026-06-02T09:00:00+08:00", end: "2026-06-02T10:00:00+08:00", title: "Weekly sync" },
        { start: "2026-06-03T08:00:00+08:00", end: "2026-06-03T11:00:00+08:00", title: "Flight to Shanghai" },
        { start: "2026-06-04T14:00:00+08:00", end: "2026-06-04T15:00:00+08:00", title: "Doctor appointment" },
        { start: "2026-06-05T07:00:00+08:00", end: "2026-06-05T09:00:00+08:00", title: "半马比赛" },
        { start: "2026-06-06T10:00:00+08:00", end: "2026-06-06T12:00:00+08:00", title: "出差准备" },
        { start: "2026-06-07T08:00:00+08:00", end: "2026-06-07T09:00:00+08:00", title: "年度体检" }
      ],
      free: []
    });

    expect(snapshot.importantEvents.map((event) => event.title)).toEqual([
      "Flight to Shanghai",
      "Doctor appointment",
      "半马比赛",
      "出差准备",
      "年度体检"
    ]);
  });
});
