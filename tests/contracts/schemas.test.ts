import { describe, expect, it } from "vitest";
import {
  loginRequestSchema,
  tokenPairSchema,
  refreshRequestSchema,
  createGoalRequestSchema,
  planGenerationRequestSchema,
  trainingCompletionRequestSchema,
  agentMessageRequestSchema,
  activityRecordSchema,
  sleepRecordSchema,
  recoveryRecordSchema
} from "@/src/contracts";

describe("contract schemas", () => {
  it("loginRequestSchema accepts a valid login", () => {
    expect(loginRequestSchema.parse({ email: "a@b.com", password: "secret" })).toMatchObject({ email: "a@b.com" });
  });

  it("loginRequestSchema rejects an invalid email", () => {
    expect(loginRequestSchema.safeParse({ email: "not-email", password: "x" }).success).toBe(false);
  });

  it("tokenPairSchema accepts the login response shape", () => {
    expect(
      tokenPairSchema.parse({
        ok: true,
        accessToken: "a",
        refreshToken: "r",
        accessExpiresAt: "2026-06-29T15:00:00.000Z",
        refreshExpiresAt: "2026-07-29T15:00:00.000Z"
      }).accessToken
    ).toBe("a");
  });

  it("refreshRequestSchema requires a refreshToken", () => {
    expect(refreshRequestSchema.safeParse({}).success).toBe(false);
  });

  it("createGoalRequestSchema applies defaults", () => {
    const parsed = createGoalRequestSchema.parse({
      title: "Run a half marathon",
      type: "long_term",
      priority: 5
    });
    expect(parsed.status).toBe("active");
    expect(parsed.metrics).toEqual({});
  });

  it("planGenerationRequestSchema requires an ISO datetime with offset", () => {
    expect(planGenerationRequestSchema.safeParse({ weekStart: "not-a-date" }).success).toBe(false);
    expect(planGenerationRequestSchema.safeParse({ weekStart: "2026-06-29T00:00:00+08:00" }).success).toBe(true);
  });

  it("trainingCompletionRequestSchema requires at least one checklist item", () => {
    expect(
      trainingCompletionRequestSchema.safeParse({
        items: [{ id: "1", label: "warmup", status: "completed" }]
      }).success
    ).toBe(true);
    expect(trainingCompletionRequestSchema.safeParse({ items: [] }).success).toBe(false);
  });

  it("agentMessageRequestSchema requires message + conversationId", () => {
    expect(agentMessageRequestSchema.safeParse({ message: "hi" }).success).toBe(false);
    expect(agentMessageRequestSchema.safeParse({ message: "hi", conversationId: "c1" }).success).toBe(true);
  });

  it("insights record schemas parse prisma-shaped rows", () => {
    const activity = {
      id: "1", userId: "u", source: "coros", sourceId: "s1", sportType: "run",
      startedAt: "2026-06-29T08:00:00+08:00", endedAt: "2026-06-29T09:00:00+08:00",
      durationMinutes: 60, distanceKm: 10, averagePaceSecPerKm: 360, averageSpeedKph: 10,
      averageHeartRateBpm: 150, calories: 600, trainingLoad: 80, intensity: "moderate",
      metadataJson: "{}", createdAt: "2026-06-29T08:00:00+08:00"
    };
    expect(activityRecordSchema.parse(activity).id).toBe("1");

    const sleep = {
      id: "2", userId: "u", source: "coros", date: "2026-06-29T00:00:00+08:00",
      sleepStart: "2026-06-28T23:00:00+08:00", sleepEnd: "2026-06-29T07:00:00+08:00",
      durationMinutes: 480, qualityScore: 85, metadataJson: "{}", createdAt: "2026-06-29T08:00:00+08:00"
    };
    expect(sleepRecordSchema.parse(sleep).id).toBe("2");

    const recovery = {
      id: "3", userId: "u", source: "coros", date: "2026-06-29T00:00:00+08:00",
      recoveryPercent: 80, hrvMs: 50, restingHeartRateBpm: 50, stressLevel: 30,
      trainingLoadShortTerm: 100, trainingLoadLongTerm: 120,
      metadataJson: "{}", createdAt: "2026-06-29T08:00:00+08:00"
    };
    expect(recoveryRecordSchema.parse(recovery).id).toBe("3");
  });
});
