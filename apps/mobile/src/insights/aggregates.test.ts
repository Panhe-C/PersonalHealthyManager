import { describe, expect, it } from "vitest";
import { localDateKey } from "../ui/format";
import {
  buildHeatmapWeeks,
  buildWeek,
  dominantIntensityByDay,
  intensityScale,
  minutesByDay,
  normalizeIntensity
} from "./aggregates";

const TIME_ZONE = "Asia/Shanghai";

function session(startedAt: string, durationMinutes: number) {
  return { startedAt, durationMinutes };
}

function activity(startedAt: string, durationMinutes: number, intensity: string) {
  return { startedAt, durationMinutes, intensity };
}

describe("localDateKey", () => {
  it("renders the local calendar day, not the UTC day", () => {
    expect(localDateKey("2026-07-27T16:30:00Z", TIME_ZONE)).toBe("2026-07-28"); // 00:30 next day in Shanghai
    expect(localDateKey("2026-07-28T15:59:59Z", TIME_ZONE)).toBe("2026-07-28");
    expect(localDateKey(new Date("2026-07-29T08:00:00+08:00"), TIME_ZONE)).toBe("2026-07-29");
  });

  it("returns an empty string for unparseable input", () => {
    expect(localDateKey("not-a-date", TIME_ZONE)).toBe("");
    expect(localDateKey("", TIME_ZONE)).toBe("");
  });
});

describe("minutesByDay", () => {
  it("sums durations per local day of startedAt", () => {
    const map = minutesByDay([
      session("2026-07-27T10:00:00Z", 30),
      session("2026-07-27T16:30:00Z", 20), // already 2026-07-28 in Shanghai
      session("2026-07-28T15:00:00Z", 45) // 23:00 on 2026-07-28 in Shanghai
    ], TIME_ZONE);

    expect(map.get("2026-07-27")).toBe(30);
    expect(map.get("2026-07-28")).toBe(65);
    expect(map.size).toBe(2);
  });

  it("returns an empty map for no records and skips unparseable starts", () => {
    expect(minutesByDay([], TIME_ZONE).size).toBe(0);
    expect(minutesByDay([session("", 30)], TIME_ZONE).size).toBe(0);
  });
});

describe("dominantIntensityByDay", () => {
  it("picks the intensity of the day's longest session", () => {
    const map = dominantIntensityByDay([
      activity("2026-07-28T01:00:00Z", 20, "轻松"),
      activity("2026-07-28T09:00:00Z", 45, "高强度")
    ], TIME_ZONE);

    expect(map.get("2026-07-28")).toBe("high");
  });

  it("keeps the earliest session when durations tie", () => {
    const map = dominantIntensityByDay([
      activity("2026-07-28T01:00:00Z", 30, "easy"),
      activity("2026-07-28T09:00:00Z", 30, "high")
    ], TIME_ZONE);

    expect(map.get("2026-07-28")).toBe("easy");
  });
});

describe("normalizeIntensity", () => {
  it("maps free-form English and Chinese strings, falling back to moderate", () => {
    expect(normalizeIntensity("easy")).toBe("easy");
    expect(normalizeIntensity("轻松跑")).toBe("easy");
    expect(normalizeIntensity("Recovery")).toBe("easy");
    expect(normalizeIntensity("低强度")).toBe("easy");
    expect(normalizeIntensity("high")).toBe("high");
    expect(normalizeIntensity("高强度间歇")).toBe("high");
    expect(normalizeIntensity("HARD")).toBe("high");
    expect(normalizeIntensity("vigorous")).toBe("high");
    expect(normalizeIntensity("中等强度")).toBe("moderate");
    expect(normalizeIntensity("moderate")).toBe("moderate");
    expect(normalizeIntensity("tempo")).toBe("moderate");
    expect(normalizeIntensity("")).toBe("moderate");
  });
});

describe("buildWeek", () => {
  it("aligns values to the given date keys in order, filling gaps with zero", () => {
    const keys = ["2026-07-27", "2026-07-28", "2026-07-29"];
    const values = new Map([["2026-07-28", 45]]);

    expect(buildWeek(keys, values)).toEqual([
      { key: "2026-07-27", value: 0 },
      { key: "2026-07-28", value: 45 },
      { key: "2026-07-29", value: 0 }
    ]);
  });
});

describe("buildHeatmapWeeks", () => {
  // 2026-07-29 is a Wednesday; its ISO week runs 2026-07-27 → 2026-08-02.
  const today = new Date("2026-07-29T08:00:00+08:00");

  it("returns weekCount columns of 7 day keys, current week last", () => {
    const weeks = buildHeatmapWeeks(today, 12, TIME_ZONE);

    expect(weeks).toHaveLength(12);
    for (const week of weeks) {
      expect(week).toHaveLength(7);
    }
    expect(weeks.at(-1)).toEqual([
      "2026-07-27",
      "2026-07-28",
      "2026-07-29",
      "2026-07-30",
      "2026-07-31",
      "2026-08-01",
      "2026-08-02"
    ]);
    expect(weeks[0][0]).toBe("2026-05-11"); // Monday, 11 weeks before 2026-07-27
  });

  it("advances every column by exactly 7 days and defaults to 12 weeks", () => {
    const weeks = buildHeatmapWeeks(today, undefined, TIME_ZONE);

    expect(weeks).toHaveLength(12);
    // Anchored on 2026-05-11 / 2026-07-27 above, both known Mondays: a
    // Monday-first grid steps each column by exactly one week.
    for (let index = 1; index < weeks.length; index += 1) {
      const prev = new Date(`${weeks[index - 1][0]}T00:00:00Z`).getTime();
      const curr = new Date(`${weeks[index][0]}T00:00:00Z`).getTime();
      expect(curr - prev).toBe(7 * 24 * 60 * 60 * 1000);
    }
  });
});

describe("intensityScale", () => {
  it("uses fixed thresholds at 30/60/90 minutes", () => {
    expect(intensityScale(0)).toBe(0);
    expect(intensityScale(1)).toBe(1);
    expect(intensityScale(29)).toBe(1);
    expect(intensityScale(30)).toBe(2);
    expect(intensityScale(59)).toBe(2);
    expect(intensityScale(60)).toBe(3);
    expect(intensityScale(89)).toBe(3);
    expect(intensityScale(90)).toBe(4);
    expect(intensityScale(240)).toBe(4);
  });
});
