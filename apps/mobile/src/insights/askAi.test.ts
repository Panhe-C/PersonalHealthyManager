import { describe, expect, it } from "vitest";
import { buildActivityAnalysisPrompt, buildSleepAnalysisPrompt } from "./askAi";

describe("askAi prompts", () => {
  it("includes the key activity metrics in the coach prompt", () => {
    const prompt = buildActivityAnalysisPrompt({
      id: "a1",
      userId: "u1",
      source: "coros",
      sourceId: "s1",
      sportType: "run",
      startedAt: "2026-06-26T16:00:00.000Z",
      endedAt: "2026-06-26T16:45:00.000Z",
      durationMinutes: 45,
      distanceKm: 8.24,
      averagePaceSecPerKm: 327,
      averageSpeedKph: 11,
      averageHeartRateBpm: 142,
      calories: 520,
      trainingLoad: 68,
      intensity: "moderate",
      metadataJson: "{}",
      createdAt: "2026-06-26T16:45:00.000Z"
    });

    expect(prompt).toContain("跑步");
    expect(prompt).toContain("8.24 km");
    expect(prompt).toContain("142 bpm");
    expect(prompt).toContain("训练负荷：68");
    expect(prompt).toContain("下次训练建议");
  });

  it("includes sleep stages when present", () => {
    const prompt = buildSleepAnalysisPrompt({
      id: "s1",
      userId: "u1",
      source: "coros",
      date: "2026-06-26T16:00:00.000Z",
      sleepStart: "2026-06-25T15:30:00.000Z",
      sleepEnd: "2026-06-26T00:00:00.000Z",
      durationMinutes: 480,
      qualityScore: 82,
      deepSleepMinutes: 90,
      lightSleepMinutes: 240,
      remSleepMinutes: 100,
      awakeMinutes: 20,
      metadataJson: "{}",
      createdAt: "2026-06-26T00:00:00.000Z"
    });

    expect(prompt).toContain("质量评分：82");
    expect(prompt).toContain("深睡");
    expect(prompt).toContain("今天训练强度建议");
  });
});
