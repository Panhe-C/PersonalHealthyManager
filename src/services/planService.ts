import type {
  NormalizedActivityRecord,
  NormalizedRecoveryRecord,
  NormalizedSleepRecord,
  TimeWindow
} from "@/src/domain/models";
import { prisma } from "@/src/db/client";
import { createCalendarDraftsFromTasks, reconcileCalendarDrafts } from "@/src/planning/calendarDrafts";
import { generateWeeklyPlan } from "@/src/planning/engine";
import { getMockMealMenu } from "@/src/providers/meal-menu";

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

export async function generatePlanForUser(userId: string, weekStart: Date) {
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
  const [profile, goals, activities, sleepRecords, recoveryRecords, calendar] = await Promise.all([
    prisma.bodyProfile.findUnique({ where: { userId } }),
    prisma.goal.findMany({ where: { userId, status: "active" }, orderBy: { priority: "desc" } }),
    prisma.activityRecord.findMany({ where: { userId }, orderBy: { startedAt: "desc" }, take: 30 }),
    prisma.sleepRecord.findMany({ where: { userId }, orderBy: { date: "desc" }, take: 14 }),
    prisma.recoveryRecord.findMany({ where: { userId }, orderBy: { date: "desc" }, take: 14 }),
    prisma.calendarSnapshot.findFirst({
      where: {
        userId,
        rangeStart: { lte: weekStart },
        rangeEnd: { gte: weekEnd }
      },
      orderBy: { capturedAt: "desc" }
    })
  ]);

  if (!profile) {
    throw new Error("Body profile is required before generating a plan.");
  }

  if (!calendar) {
    throw new Error("Calendar snapshot is required before generating a plan.");
  }

  const normalizedActivities: NormalizedActivityRecord[] = activities.map((activity) => ({
    source: "coros",
    sourceId: activity.sourceId,
    sportType: activity.sportType as NormalizedActivityRecord["sportType"],
    startedAt: activity.startedAt,
    endedAt: activity.endedAt,
    durationMinutes: activity.durationMinutes,
    distanceKm: activity.distanceKm ?? undefined,
    averagePaceSecPerKm: activity.averagePaceSecPerKm ?? undefined,
    averageSpeedKph: activity.averageSpeedKph ?? undefined,
    averageHeartRateBpm: activity.averageHeartRateBpm ?? undefined,
    calories: activity.calories ?? undefined,
    trainingLoad: activity.trainingLoad ?? undefined,
    intensity: activity.intensity as NormalizedActivityRecord["intensity"],
    metadata: {}
  }));
  const normalizedSleep: NormalizedSleepRecord[] = sleepRecords.map((sleep) => ({
    source: "coros",
    date: sleep.date,
    sleepStart: sleep.sleepStart ?? undefined,
    sleepEnd: sleep.sleepEnd ?? undefined,
    durationMinutes: sleep.durationMinutes,
    qualityScore: sleep.qualityScore ?? undefined,
    metadata: {}
  }));
  const normalizedRecovery: NormalizedRecoveryRecord[] = recoveryRecords.map((recovery) => ({
    source: "coros",
    date: recovery.date,
    recoveryPercent: recovery.recoveryPercent ?? undefined,
    hrvMs: recovery.hrvMs ?? undefined,
    restingHeartRateBpm: recovery.restingHeartRateBpm ?? undefined,
    stressLevel: recovery.stressLevel ?? undefined,
    trainingLoadShortTerm: recovery.trainingLoadShortTerm ?? undefined,
    trainingLoadLongTerm: recovery.trainingLoadLongTerm ?? undefined,
    metadata: {}
  }));
  const generated = generateWeeklyPlan({
    weekStart,
    profile: {
      trainingExperience: profile.trainingExperience,
      injuries: parseJson<string[]>(profile.injuriesJson)
    },
    goals: goals.map((goal) => ({
      id: goal.id,
      title: goal.title,
      type: goal.type,
      priority: goal.priority,
      targetDate: goal.targetDate ?? undefined,
      metrics: parseJson<Record<string, unknown>>(goal.metricsJson)
    })),
    activities: normalizedActivities,
    sleepRecords: normalizedSleep,
    recoveryRecords: normalizedRecovery,
    calendar: {
      source: "feishu",
      rangeStart: calendar.rangeStart,
      rangeEnd: calendar.rangeEnd,
      busyWindows: parseJson<TimeWindow[]>(calendar.busyWindowsJson),
      freeWindows: parseJson<TimeWindow[]>(calendar.freeWindowsJson),
      importantEvents: parseJson<TimeWindow[]>(calendar.importantEventsJson)
    },
    mealMenus: getMockMealMenu(weekStart)
  });
  return prisma.$transaction(async (tx) => {
    const previousPlans = await tx.plan.findMany({
      where: { userId, weekStart, status: { not: "superseded" } },
      select: { id: true }
    });
    const previousPlanIds = previousPlans.map((plan) => plan.id);
    const previousExternalEvents =
      previousPlanIds.length > 0
        ? await tx.calendarEventDraft.findMany({
            where: {
              userId,
              planId: { in: previousPlanIds },
              externalEventId: { not: null },
              NOT: { operation: "cancel", status: "confirmed" }
            },
            orderBy: { startsAt: "asc" },
            select: {
              externalEventId: true,
              title: true,
              startsAt: true,
              endsAt: true,
              notes: true
            }
          })
        : [];

    if (previousPlanIds.length > 0) {
      await tx.calendarEventDraft.updateMany({
        where: { userId, planId: { in: previousPlanIds }, status: { not: "superseded" } },
        data: { status: "superseded" }
      });
      await tx.plan.updateMany({
        where: { id: { in: previousPlanIds }, userId },
        data: { status: "superseded" }
      });
    }

    const plan = await tx.plan.create({
      data: {
        userId,
        weekStart,
        weekEnd: new Date(generated.weekEnd),
        summary: generated.summary,
        nutritionTargetsJson: JSON.stringify(generated.nutritionTargets),
        menuRecommendationsJson: JSON.stringify(generated.nutritionTargets),
        explanation: generated.explanation,
        trainingTasks: {
          create: generated.tasks.map((task) => ({
            date: new Date(task.date),
            title: task.title,
            trainingType: task.trainingType,
            durationMinutes: task.durationMinutes,
            intensity: task.intensity,
            targetJson: JSON.stringify(task.target),
            scheduledStart: task.scheduledStart ? new Date(task.scheduledStart) : undefined,
            scheduledEnd: task.scheduledEnd ? new Date(task.scheduledEnd) : undefined,
            goalId: generated.goalId,
            checklistItems: {
              create: task.checklist.map((label, index) => ({ label, order: index + 1 }))
            }
          }))
        }
      },
      include: { trainingTasks: true }
    });
    const drafts = reconcileCalendarDrafts(
      createCalendarDraftsFromTasks(
        plan.trainingTasks.map((task) => ({
          id: task.id,
          title: task.title,
          scheduledStart: task.scheduledStart?.toISOString(),
          scheduledEnd: task.scheduledEnd?.toISOString(),
          trainingType: task.trainingType,
          intensity: task.intensity
        }))
      ),
      previousExternalEvents.flatMap((draft) =>
        draft.externalEventId
          ? [
              {
                externalEventId: draft.externalEventId,
                title: draft.title,
                startsAt: draft.startsAt,
                endsAt: draft.endsAt,
                notes: draft.notes
              }
            ]
          : []
      )
    );

    if (drafts.length > 0) {
      await tx.calendarEventDraft.createMany({
        data: drafts.map((draft) => ({ userId, planId: plan.id, ...draft }))
      });
    }

    return tx.plan.findUnique({
      where: { id: plan.id },
      include: {
        trainingTasks: { include: { checklistItems: true } },
        calendarDrafts: true
      }
    });
  });
}
