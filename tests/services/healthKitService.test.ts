import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/src/db/client";
import { importHealthKitPayload } from "@/src/services/healthKitService";

vi.mock("@/src/db/client", () => ({ prisma: { bodyProfile: { findUnique: vi.fn(), update: vi.fn() }, sleepRecord: { upsert: vi.fn() }, recoveryRecord: { upsert: vi.fn() }, $transaction: vi.fn() } }));

describe("HealthKit import", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(prisma as never)); });
  it("updates an existing profile and stores HealthKit provenance", async () => {
    vi.mocked(prisma.bodyProfile.findUnique).mockResolvedValue({ id: "profile-1" } as never);
    const result = await importHealthKitPayload("user-1", {
      profile: { weightKg: 70, restingHeartRateBpm: 52 },
      sleep: [{ date: "2026-07-19T00:00:00.000Z", sleepStart: "2026-07-18T15:00:00.000Z", sleepEnd: "2026-07-18T23:00:00.000Z", durationMinutes: 480 }],
      recovery: [{ date: "2026-07-19T00:00:00.000Z", hrvMs: 58 }]
    });
    expect(prisma.bodyProfile.update).toHaveBeenCalledWith({ where: { userId: "user-1" }, data: { weightKg: 70, restingHeartRateBpm: 52 } });
    expect(prisma.sleepRecord.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ source: "healthkit" }) }));
    expect(prisma.recoveryRecord.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ source: "healthkit", hrvMs: 58 }) }));
    expect(result).toEqual({ profileUpdated: true, sleepImported: 1, recoveryImported: 1 });
  });

  it("does not report a profile update when no profile exists", async () => {
    vi.mocked(prisma.bodyProfile.findUnique).mockResolvedValue(null);

    const result = await importHealthKitPayload("user-1", {
      profile: { weightKg: 70 },
      sleep: [],
      recovery: [],
    });

    expect(prisma.bodyProfile.update).not.toHaveBeenCalled();
    expect(result.profileUpdated).toBe(false);
  });
});
