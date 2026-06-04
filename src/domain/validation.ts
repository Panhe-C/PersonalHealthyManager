import { z } from "zod";

export const bodyProfileSchema = z.object({
  heightCm: z.number().min(80).max(250),
  weightKg: z.number().min(25).max(300),
  bodyFatPercent: z.number().min(2).max(70).optional(),
  birthday: z.string().optional(),
  sex: z.enum(["male", "female", "other"]),
  restingHeartRateBpm: z.number().min(30).max(130).optional(),
  trainingExperience: z.enum(["beginner", "intermediate", "advanced"]),
  injuries: z.array(z.string()),
  dietaryPreferences: z.array(z.string()),
  trainingPreferences: z.array(z.string())
});

export const goalSchema = z.object({
  title: z.string().min(2),
  type: z.enum(["long_term", "primary", "short_term_event", "secondary"]),
  priority: z.number().int().min(1).max(10),
  status: z.enum(["active", "paused", "completed"]).default("active"),
  targetDate: z.string().optional(),
  metrics: z.record(z.unknown()).default({})
});

export type BodyProfileInput = z.infer<typeof bodyProfileSchema>;
export type GoalInput = z.infer<typeof goalSchema>;
