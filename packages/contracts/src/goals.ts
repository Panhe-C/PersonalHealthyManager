import { z } from "zod";

export const goalSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  type: z.enum(["long_term", "primary", "short_term_event", "secondary"]),
  priority: z.number().int(),
  status: z.enum(["active", "paused", "completed"]),
  targetDate: z.string().nullable(),
  metricsJson: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const goalListResponseSchema = z.array(goalSchema);

export const createGoalRequestSchema = z.object({
  title: z.string().min(2),
  type: z.enum(["long_term", "primary", "short_term_event", "secondary"]),
  priority: z.number().int().min(1).max(10),
  status: z.enum(["active", "paused", "completed"]).default("active"),
  targetDate: z.string().optional(),
  metrics: z.record(z.unknown()).default({})
});

export const updateGoalRequestSchema = createGoalRequestSchema.partial();

export type Goal = z.infer<typeof goalSchema>;
export type CreateGoalRequest = z.infer<typeof createGoalRequestSchema>;
