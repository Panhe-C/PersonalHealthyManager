import { describe, expect, it } from "vitest";
import { buildDailyTrends, lastDayKeys } from "@/src/presentation/healthTrends";

const NOW = new Date("2026-07-17T12:00:00+08:00");
const TZ = "Asia/Shanghai";

describe("lastDayKeys", () => {
  it("returns seven keys ending today in the user's timezone", () => {
    expect(lastDayKeys(TZ, 7, NOW)).toEqual([
      "2026-07-11",
      "2026-07-12",
      "2026-07-13",
      "2026-07-14",
      "2026-07-15",
      "2026-07-16",
      "2026-07-17"
    ]);
  });
});

describe("buildDailyTrends", () => {
  it("buckets records by timezone day and fills gaps with nulls", () => {
    const days = buildDailyTrends({
      timezone: TZ,
      now: NOW,
      activities: [
        { id: "a1", startedAt: new Date("2026-07-16T07:30:00+08:00"), durationMinutes: 40, trainingLoad: 50, averageHeartRateBpm: 140 },
        { id: "a2", startedAt: new Date("2026-07-16T18:30:00+08:00"), durationMinutes: 20, trainingLoad: 30, averageHeartRateBpm: 150 }
      ],
      sleepRecords: [{ id: "s1", date: new Date("2026-07-16T00:00:00+08:00"), durationMinutes: 450, qualityScore: 80 }],
      recoveryRecords: [{ id: "r1", date: new Date("2026-07-17T00:00:00+08:00"), recoveryPercent: 82, hrvMs: 61, restingHeartRateBpm: 51 }]
    });

    expect(days).toHaveLength(7);
    expect(days[6].isToday).toBe(true);
    expect(days[6].label).toBe("Fri");

    const thursday = days[5];
    expect(thursday.trainingMinutes).toBe(60);
    expect(thursday.trainingLoad).toBe(80);
    expect(thursday.averageHeartRateBpm).toBe(145);
    expect(thursday.sleepMinutes).toBe(450);
    expect(thursday.sleepQualityScore).toBe(80);

    const sunday = days[0];
    expect(sunday.trainingMinutes).toBe(0);
    expect(sunday.sleepMinutes).toBeNull();
    expect(sunday.recoveryPercent).toBeNull();

    expect(days[6].recoveryPercent).toBe(82);
    expect(days[6].hrvMs).toBe(61);
    expect(days[6].restingHeartRateBpm).toBe(51);
  });

  it("assigns UTC timestamps to the correct local day", () => {
    const days = buildDailyTrends({
      timezone: TZ,
      now: NOW,
      // 2026-07-16 23:30 UTC == 2026-07-17 07:30 in Shanghai
      activities: [{ id: "a1", startedAt: new Date("2026-07-16T23:30:00Z"), durationMinutes: 45 }],
      sleepRecords: [],
      recoveryRecords: []
    });

    expect(days[6].trainingMinutes).toBe(45);
    expect(days[5].trainingMinutes).toBe(0);
  });

  it("anchors the sleep window at 15:00 so overnight sleep stays in one row", () => {
    const days = buildDailyTrends({
      timezone: TZ,
      now: NOW,
      activities: [],
      sleepRecords: [
        {
          id: "s1",
          date: new Date("2026-07-17T00:00:00+08:00"),
          durationMinutes: 460,
          sleepStart: new Date("2026-07-16T23:10:00+08:00"),
          sleepEnd: new Date("2026-07-17T06:50:00+08:00")
        }
      ],
      recoveryRecords: []
    });

    const today = days[6];
    // 23:10 is 490 minutes after the 15:00 anchor; 23:10 → 06:50 is 460 minutes
    expect(today.sleepWindowStart).toBe(490);
    expect(today.sleepWindowDuration).toBe(460);
  });

  it("returns null sleep window when start/end are missing", () => {
    const days = buildDailyTrends({
      timezone: TZ,
      now: NOW,
      activities: [],
      sleepRecords: [{ id: "s1", date: new Date("2026-07-17T00:00:00+08:00"), durationMinutes: 420 }],
      recoveryRecords: []
    });

    expect(days[6].sleepWindowStart).toBeNull();
    expect(days[6].sleepWindowDuration).toBeNull();
    expect(days[6].sleepMinutes).toBe(420);
  });
});
