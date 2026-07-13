import { z } from "zod";

export const sinceQuerySchema = z.object({
  since: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional()
});

export const activityRecordSchema = z.object({
  id: z.string(),
  userId: z.string(),
  source: z.string(),
  sourceId: z.string(),
  sportType: z.string(),
  startedAt: z.string(),
  endedAt: z.string(),
  durationMinutes: z.number().int(),
  distanceKm: z.number().nullable(),
  averagePaceSecPerKm: z.number().int().nullable(),
  averageSpeedKph: z.number().nullable(),
  averageHeartRateBpm: z.number().int().nullable(),
  calories: z.number().int().nullable(),
  trainingLoad: z.number().nullable(),
  intensity: z.string(),
  metadataJson: z.string(),
  createdAt: z.string()
});

export const sleepRecordSchema = z.object({
  id: z.string(),
  userId: z.string(),
  source: z.string(),
  date: z.string(),
  sleepStart: z.string().nullable(),
  sleepEnd: z.string().nullable(),
  durationMinutes: z.number().int(),
  qualityScore: z.number().int().nullable(),
  metadataJson: z.string(),
  createdAt: z.string()
});

export const recoveryRecordSchema = z.object({
  id: z.string(),
  userId: z.string(),
  source: z.string(),
  date: z.string(),
  recoveryPercent: z.number().int().nullable(),
  hrvMs: z.number().nullable(),
  restingHeartRateBpm: z.number().int().nullable(),
  stressLevel: z.number().int().nullable(),
  trainingLoadShortTerm: z.number().nullable(),
  trainingLoadLongTerm: z.number().nullable(),
  metadataJson: z.string(),
  createdAt: z.string()
});

export const activitiesResponseSchema = z.array(activityRecordSchema);
export const sleepResponseSchema = z.array(sleepRecordSchema);
export const recoveryResponseSchema = z.array(recoveryRecordSchema);

export type ActivityRecord = z.infer<typeof activityRecordSchema>;
export type SleepRecord = z.infer<typeof sleepRecordSchema>;
export type RecoveryRecord = z.infer<typeof recoveryRecordSchema>;
