import { cache } from "react";
import { prisma } from "@/src/db/client";

export const getBodyProfile = cache(async (userId: string) =>
  prisma.bodyProfile.findUnique({ where: { userId } })
);

export const getCalendarSnapshot = cache(async (userId: string, weekStart: Date, weekEnd: Date) =>
  prisma.calendarSnapshot.findFirst({
    where: {
      userId,
      rangeStart: { lte: weekStart },
      rangeEnd: { gte: weekEnd }
    },
    orderBy: { capturedAt: "desc" }
  })
);

export const getActivePlan = cache(async (userId: string) =>
  prisma.plan.findFirst({
    where: { userId, status: { not: "superseded" } },
    orderBy: { createdAt: "desc" },
    include: {
      trainingTasks: {
        orderBy: { date: "asc" },
        include: { checklistItems: { orderBy: { order: "asc" } } }
      }
    }
  })
);

export const getActivePlanSummary = cache(async (userId: string) =>
  prisma.plan.findFirst({
    where: { userId, status: { not: "superseded" } },
    orderBy: { createdAt: "desc" },
    select: { id: true, summary: true, nutritionTargetsJson: true }
  })
);

export const getPrimaryGoal = cache(async (userId: string) =>
  prisma.goal.findFirst({
    where: { userId, status: "active" },
    orderBy: { priority: "desc" }
  })
);

export const getLatestRecovery = cache(async (userId: string) =>
  prisma.recoveryRecord.findFirst({ where: { userId }, orderBy: { date: "desc" } })
);

export const getLatestSleep = cache(async (userId: string) =>
  prisma.sleepRecord.findFirst({ where: { userId }, orderBy: { date: "desc" } })
);

export const getRecentActivities = cache(async (userId: string) =>
  prisma.activityRecord.findMany({
    where: { userId },
    orderBy: { startedAt: "desc" },
    take: 10
  })
);

export const getDraftsForPlan = cache(async (userId: string, planId: string | null) => {
  if (!planId) return [];
  return prisma.calendarEventDraft.findMany({
    where: { userId, planId },
    orderBy: { startsAt: "asc" }
  });
});

export type ActivePlan = Awaited<ReturnType<typeof getActivePlan>>;
