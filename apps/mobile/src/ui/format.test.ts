import { describe, expect, it } from "vitest";
import { currentWeekStartIso, formatDateLabel, formatDuration, formatTaskWindow, parseJsonObject, weekDayNumbers } from "./format";

describe("mobile display format helpers", () => {
  it("formats short and long durations for compact cards", () => {
    expect(formatDuration(50)).toBe("50m");
    expect(formatDuration(109)).toBe("1h 49m");
    expect(formatDuration(null)).toBe("无记录");
  });

  it("returns a fallback object when JSON payloads are empty or invalid", () => {
    expect(parseJsonObject("{\"proteinTargetGrams\":120}", { proteinTargetGrams: 0 })).toEqual({ proteinTargetGrams: 120 });
    expect(parseJsonObject("", { proteinTargetGrams: 0 })).toEqual({ proteinTargetGrams: 0 });
    expect(parseJsonObject("{broken", { proteinTargetGrams: 0 })).toEqual({ proteinTargetGrams: 0 });
  });

  it("formats task time windows without exposing raw ISO strings", () => {
    expect(formatDateLabel("2026-06-26T16:00:00.000Z")).toBe("6月27日");
    expect(formatTaskWindow("2026-06-16T10:00:00.000Z", "2026-06-16T10:50:00.000Z")).toBe("18:00-18:50");
    expect(formatTaskWindow(null, null)).toBe("未排期");
  });

  it("returns the current Monday midnight for the app timezone", () => {
    expect(currentWeekStartIso(new Date("2026-07-09T03:00:00.000Z"))).toBe("2026-07-05T16:00:00.000Z");
  });

  it("builds a stable seven-day strip from full ISO timestamps", () => {
    expect(weekDayNumbers("2026-07-05T16:00:00.000Z")).toEqual([6, 7, 8, 9, 10, 11, 12]);
    expect(weekDayNumbers("invalid")).toHaveLength(7);
    expect(weekDayNumbers("invalid").every(Number.isFinite)).toBe(true);
  });
});
