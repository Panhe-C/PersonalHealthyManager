import { cache } from "react";
import { prisma } from "@/src/db/client";
import * as planQuery from "@/src/services/planQueryService";

// RSC read helpers delegate to the shared planQueryService (single source of
// truth for plan reads, also used by /api/v1 endpoints) and wrap with cache()
// to preserve the existing Web request-dedup behavior.

export const getBodyProfile = cache(planQuery.getBodyProfile);

export const getCalendarSnapshot = cache(planQuery.findCalendarSnapshotForWeek);

export const getActivePlan = cache(planQuery.getActivePlan);
export const getActivePlanSummary = cache(planQuery.getActivePlanSummary);
export const getPrimaryGoal = cache(planQuery.getPrimaryGoal);
export const getLatestRecovery = cache(planQuery.getLatestRecovery);
export const getLatestSleep = cache(planQuery.getLatestSleep);
export const getRecentActivities = cache(planQuery.getRecentActivities);

export const getDraftsForPlan = cache(async (userId: string, planId: string | null) => {
  if (!planId) return [];
  return prisma.calendarEventDraft.findMany({
    where: { userId, planId },
    orderBy: { startsAt: "asc" }
  });
});

export type ActivePlan = Awaited<ReturnType<typeof getActivePlan>>;
