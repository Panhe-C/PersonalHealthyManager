import { z } from "zod";
import { prisma } from "@/src/db/client";

const payloadSchema = z.object({
  profile: z.object({ heightCm: z.number().positive().optional(), weightKg: z.number().positive().optional(), bodyFatPercent: z.number().min(0).max(100).optional(), restingHeartRateBpm: z.number().positive().optional() }).optional(),
  sleep: z.array(z.object({ date: z.string().datetime(), sleepStart: z.string().datetime(), sleepEnd: z.string().datetime(), durationMinutes: z.number().nonnegative() })).default([]),
  recovery: z.array(z.object({ date: z.string().datetime(), hrvMs: z.number().nonnegative().optional(), restingHeartRateBpm: z.number().positive().optional() })).default([])
});

export async function importHealthKitPayload(userId: string, input: unknown) {
  const payload = payloadSchema.parse(input);
  let profileUpdated = false;
  await prisma.$transaction(async (tx) => {
    const existing = await tx.bodyProfile.findUnique({ where: { userId } });
    if (existing && payload.profile) {
      await tx.bodyProfile.update({ where: { userId }, data: payload.profile });
      profileUpdated = true;
    }
    for (const sleep of payload.sleep) {
      const date = new Date(sleep.date);
      const data = { userId, source: "healthkit", date, sleepStart: new Date(sleep.sleepStart), sleepEnd: new Date(sleep.sleepEnd), durationMinutes: Math.round(sleep.durationMinutes), qualityScore: null, metadataJson: JSON.stringify({ importedFrom: "apple-health" }) };
      await tx.sleepRecord.upsert({ where: { userId_source_date: { userId, source: "healthkit", date } }, update: data, create: data });
    }
    for (const recovery of payload.recovery) {
      const date = new Date(recovery.date);
      const data = { userId, source: "healthkit", date, recoveryPercent: null, hrvMs: recovery.hrvMs, restingHeartRateBpm: recovery.restingHeartRateBpm, stressLevel: null, trainingLoadShortTerm: null, trainingLoadLongTerm: null, metadataJson: JSON.stringify({ importedFrom: "apple-health" }) };
      await tx.recoveryRecord.upsert({ where: { userId_source_date: { userId, source: "healthkit", date } }, update: data, create: data });
    }
  });
  return { profileUpdated, sleepImported: payload.sleep.length, recoveryImported: payload.recovery.length };
}
