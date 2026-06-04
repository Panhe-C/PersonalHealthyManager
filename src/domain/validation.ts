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

export const trainingCompletionSchema = z.object({
  actualLoad: z.number().finite().int().nonnegative().optional(),
  perceivedEffort: z.enum(["easy", "moderate", "hard"]).optional(),
  notes: z.string().max(2000).optional(),
  linkedActivityId: z.string().min(1).optional(),
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string(),
        status: z.enum(["pending", "completed", "skipped"])
      })
    )
    .min(1)
});

export const planGenerationSchema = z.object({
  weekStart: z.string().datetime({ offset: true })
});

export function isWeekStartInTimezone(date: Date, timezone: string): boolean {
  if (Number.isNaN(date.getTime())) return false;

  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    }).formatToParts(date);
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));

    return value.weekday === "Mon" && value.hour === "00" && value.minute === "00" && value.second === "00";
  } catch {
    return false;
  }
}

export type BodyProfileInput = z.infer<typeof bodyProfileSchema>;
export type GoalInput = z.infer<typeof goalSchema>;
export type TrainingCompletionInput = z.infer<typeof trainingCompletionSchema>;
