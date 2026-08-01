import { z } from "zod";

export const checklistItemSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  label: z.string(),
  order: z.number().int(),
  required: z.boolean(),
  status: z.enum(["pending", "completed", "skipped"])
}).passthrough();

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
  checklistItems: z.array(checklistItemSchema),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const mealMenuItemSchema = z.object({
  name: z.string(),
  calories: z.number(),
  proteinGrams: z.number(),
  carbohydrateGrams: z.number(),
  fatGrams: z.number(),
  tags: z.array(z.string())
});

export const mealMenuSchema = z.object({
  source: z.string(),
  date: z.string(),
  meal: z.string(),
  items: z.array(mealMenuItemSchema)
});

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
  todayTasks: z.array(trainingTaskSchema),
  mealMenus: z.array(mealMenuSchema),
  /** Optional so an older server response still parses. */
  mealMenuStatus: z.enum(["ok", "not_configured", "failed"]).optional(),
  activePlanId: z.string().nullable()
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

export const completedTrainingTaskSchema = trainingTaskSchema
  .extend({
    completion: z.object({}).passthrough().nullable().optional(),
    plan: z.object({}).passthrough().optional()
  })
  .passthrough();

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
  deepSleepMinutes: z.number().int().nullable().optional(),
  lightSleepMinutes: z.number().int().nullable().optional(),
  remSleepMinutes: z.number().int().nullable().optional(),
  awakeMinutes: z.number().int().nullable().optional(),
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

export const conversationSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string().nullable().optional(),
  updatedAt: z.string()
}).passthrough();

export const conversationListResponseSchema = z.array(conversationSchema);

export const agentAdjustmentSchema = z.object({
  id: z.string(),
  label: z.string(),
  undoneAt: z.string().nullable()
}).passthrough();

export const agentMessageSchema = z.object({
  id: z.string(),
  role: z.string(),
  content: z.string(),
  adjustments: z.array(agentAdjustmentSchema).optional()
}).passthrough();

export const conversationDetailSchema = conversationSchema.extend({
  messages: z.array(agentMessageSchema)
});

export const agentResponseSchema = z
  .object({
    message: z.string(),
    conversation: conversationSchema.optional(),
    adjustments: z.array(agentAdjustmentSchema).optional(),
    appliedMemories: z.array(z.object({}).passthrough()).optional()
  })
  .passthrough();

export const memorySchema = z.object({
  id: z.string(),
  kind: z.string(),
  category: z.string(),
  content: z.string(),
  source: z.string(),
  confidence: z.number(),
  status: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
}).passthrough();

export const memoryListResponseSchema = z.array(memorySchema);
export const memoryWriteResponseSchema = z.object({ memory: memorySchema });
export const deleteConversationResponseSchema = z.object({ deleted: z.boolean() });
export const deleteMemoryResponseSchema = z.object({ id: z.string(), status: z.literal("deleted") });
export const undoAdjustmentResponseSchema = z.object({ id: z.string(), undoneAt: z.string() });

export type ActivePlan = z.infer<typeof activePlanSchema>;
export type AgentAdjustment = z.infer<typeof agentAdjustmentSchema>;
export type AgentMessage = z.infer<typeof agentMessageSchema>;
export type AgentResponse = z.infer<typeof agentResponseSchema>;
export type ActivityRecord = z.infer<typeof activityRecordSchema>;
export type CompletedTrainingTask = z.infer<typeof completedTrainingTaskSchema>;
export type Conversation = z.infer<typeof conversationSchema>;
export type ConversationDetail = z.infer<typeof conversationDetailSchema>;
export type Goal = z.infer<typeof goalSchema>;
export type MealMenu = z.infer<typeof mealMenuSchema>;
export type Memory = z.infer<typeof memorySchema>;
export type RecoveryRecord = z.infer<typeof recoveryRecordSchema>;
export type SleepRecord = z.infer<typeof sleepRecordSchema>;
export type TodayOverview = z.infer<typeof todayOverviewSchema>;
export type TrainingCompletionRequest = z.infer<typeof trainingCompletionRequestSchema>;
