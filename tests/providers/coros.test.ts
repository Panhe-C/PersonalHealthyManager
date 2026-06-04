import { describe, expect, it } from "vitest";
import { normalizeCorosActivity, normalizeCorosRecovery, normalizeCorosSleep } from "@/src/providers/coros";

describe("COROS provider normalization", () => {
  it("normalizes a running workout into an ActivityRecord input", () => {
    const result = normalizeCorosActivity({
      labelId: "run-1",
      sportType: 100,
      startTime: "2026-06-01T10:00:00+08:00",
      endTime: "2026-06-01T10:45:00+08:00",
      distanceKm: 8.2,
      avgHeartRate: 142,
      calories: 510,
      trainingLoad: 88
    });

    expect(result).toMatchObject({
      source: "coros",
      sourceId: "run-1",
      sportType: "run",
      durationMinutes: 45,
      distanceKm: 8.2,
      averageHeartRateBpm: 142,
      calories: 510,
      trainingLoad: 88,
      intensity: "moderate"
    });
    expect(result.startedAt.toISOString()).toBe("2026-06-01T02:00:00.000Z");
    expect(result.endedAt.toISOString()).toBe("2026-06-01T02:45:00.000Z");
    expect(result.metadata).toMatchObject({ labelId: "run-1", sportType: 100 });
  });

  it.each([
    { sportType: 100, expected: "run" },
    { sportType: 103, expected: "run" },
    { sportType: 200, expected: "ride" },
    { sportType: 204, expected: "ride" },
    { sportType: 402, expected: "strength" },
    { sportType: 900, expected: "other" }
  ] as const)("maps sport type $sportType to $expected", ({ sportType, expected }) => {
    const result = normalizeCorosActivity({
      labelId: `activity-${sportType}`,
      sportType,
      startTime: "2026-06-01T10:00:00+08:00",
      endTime: "2026-06-01T10:30:00+08:00"
    });

    expect(result.sportType).toBe(expected);
  });

  it.each([
    { trainingLoad: undefined, expected: "easy" },
    { trainingLoad: 39, expected: "easy" },
    { trainingLoad: 40, expected: "moderate" },
    { trainingLoad: 99, expected: "moderate" },
    { trainingLoad: 100, expected: "hard" }
  ] as const)("classifies training load $trainingLoad as $expected", ({ trainingLoad, expected }) => {
    const result = normalizeCorosActivity({
      labelId: `load-${trainingLoad ?? "missing"}`,
      sportType: 100,
      startTime: "2026-06-01T10:00:00+08:00",
      endTime: "2026-06-01T10:30:00+08:00",
      trainingLoad
    });

    expect(result.intensity).toBe(expected);
  });

  it("uses a deterministic fallback sourceId when labelId is missing", () => {
    const payload = {
      sportType: 100,
      startTime: "2026-06-01T10:00:00+08:00",
      endTime: "2026-06-01T10:45:00+08:00",
      distanceKm: 8.2
    };

    const first = normalizeCorosActivity(payload);
    const second = normalizeCorosActivity({ ...payload });

    expect(first.sourceId).toBeTruthy();
    expect(first.sourceId).toBe(second.sourceId);
    expect(first.sourceId).toContain("fallback");
  });

  it("normalizes sleep payloads", () => {
    const result = normalizeCorosSleep({
      date: "2026-06-02",
      sleepStart: "2026-06-01T23:10:00+08:00",
      sleepEnd: "2026-06-02T06:00:00+08:00",
      durationMinutes: 410,
      score: 78
    });

    expect(result).toMatchObject({
      source: "coros",
      durationMinutes: 410,
      qualityScore: 78
    });
    expect(result.date.toISOString()).toBe("2026-06-01T16:00:00.000Z");
    expect(result.sleepStart?.toISOString()).toBe("2026-06-01T15:10:00.000Z");
    expect(result.sleepEnd?.toISOString()).toBe("2026-06-01T22:00:00.000Z");
    expect(result.metadata).toMatchObject({ date: "2026-06-02", score: 78 });
  });

  it("normalizes recovery payloads", () => {
    const result = normalizeCorosRecovery({
      date: "2026-06-02",
      recoveryPercent: 42,
      hrvMs: 48,
      restingHeartRateBpm: 56,
      stressLevel: 31,
      trainingLoadShortTerm: 240,
      trainingLoadLongTerm: 310
    });

    expect(result).toMatchObject({
      source: "coros",
      recoveryPercent: 42,
      hrvMs: 48,
      restingHeartRateBpm: 56,
      stressLevel: 31,
      trainingLoadShortTerm: 240,
      trainingLoadLongTerm: 310
    });
    expect(result.date.toISOString()).toBe("2026-06-01T16:00:00.000Z");
    expect(result.metadata).toMatchObject({ date: "2026-06-02", recoveryPercent: 42 });
  });
});
