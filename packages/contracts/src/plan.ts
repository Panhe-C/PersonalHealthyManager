import { z } from "zod";

export const planGenerationRequestSchema = z.object({
  weekStart: z.string().datetime({ offset: true })
});

export const planSummarySchema = z.object({
  id: z.string(),
  summary: z.string(),
  nutritionTargetsJson: z.string()
});

export const trainingChecklistItemSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  label: z.string(),
  order: z.number().int(),
  required: z.boolean(),
  status: z.enum(["pending", "completed", "skipped"])
});

export const trainingTaskSchema = z.object({
  id: z.string(),
  planId: z.string(),
  userId: z.string(),
  date: z.string(),
  title: z.string(),
  trainingType: z.string(),
  durationMinutes: z.number().int(),
  intensity: z.string(),
  targetJson: z.string(),
  scheduledStart: z.string().nullable(),
  scheduledEnd: z.string().nullable(),
  goalId: z.string().nullable(),
  status: z.string(),
  checklistItems: z.array(trainingChecklistItemSchema),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const activePlanSchema = z.object({
  id: z.string(),
  userId: z.string(),
  weekStart: z.string(),
  weekEnd: z.string(),
  status: z.string(),
  summary: z.string(),
  trainingLoadGoal: z.number().nullable(),
  nutritionTargetsJson: z.string(),
  menuRecommendationsJson: z.string(),
  explanation: z.string(),
  trainingTasks: z.array(trainingTaskSchema),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const activePlanResponseSchema = activePlanSchema.nullable();

export const todayTaskSchema = trainingTaskSchema;

export const todayOverviewSchema = z.object({
  date: z.string(),
  primaryGoal: z
    .object({
      id: z.string(),
      title: z.string(),
      type: z.string(),
      priority: z.number().int(),
      status: z.string()
    })
    .passthrough()
    .nullable(),
  latestRecovery: z.object({}).passthrough().nullable(),
  latestSleep: z.object({}).passthrough().nullable(),
  todayTasks: z.array(todayTaskSchema),
  activePlanId: z.string().nullable()
});

export const trainingCompletionRequestSchema = z.object({
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

export type ActivePlan = z.infer<typeof activePlanSchema>;
export type TrainingTask = z.infer<typeof trainingTaskSchema>;
export type TrainingCompletionRequest = z.infer<typeof trainingCompletionRequestSchema>;
