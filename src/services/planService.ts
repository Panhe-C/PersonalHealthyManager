import type {
  NormalizedActivityRecord,
  NormalizedRecoveryRecord,
  NormalizedSleepRecord,
  TimeWindow
} from "@/src/domain/models";
import { prisma } from "@/src/db/client";
import { createCalendarDraftsFromTasks } from "@/src/planning/calendarDrafts";
import { generateWeeklyPlan } from "@/src/planning/engine";
import { getMockMealMenu } from "@/src/providers/meal-menu";

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

export async function generatePlanForUser(userId: string, weekStart: Date) {
  const [profile, goals, activities, sleepRecords, recoveryRecords, calendar] = await Promise.all([
    prisma.bodyProfile.findUnique({ where: { userId } }),
    prisma.goal.findMany({ where: { userId, status: "active" }, orderBy: { priority: "desc" } }),
    prisma.activityRecord.findMany({ where: { userId }, orderBy: { startedAt: "desc" }, take: 30 }),
    prisma.sleepRecord.findMany({ where: { userId }, orderBy: { date: "desc" }, take: 14 }),
    prisma.recoveryRecord.findMany({ where: { userId }, orderBy: { date: "desc" }, take: 14 }),
    prisma.calendarSnapshot.findFirst({ where: { userId }, orderBy: { capturedAt: "desc" } })
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
    metadata: parseJson<Record<string, unknown>>(activity.metadataJson)
  }));
  const normalizedSleep: NormalizedSleepRecord[] = sleepRecords.map((sleep) => ({
    source: "coros",
    date: sleep.date,
    sleepStart: sleep.sleepStart ?? undefined,
    sleepEnd: sleep.sleepEnd ?? undefined,
    durationMinutes: sleep.durationMinutes,
    qualityScore: sleep.qualityScore ?? undefined,
    metadata: parseJson<Record<string, unknown>>(sleep.metadataJson)
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
    metadata: parseJson<Record<string, unknown>>(recovery.metadataJson)
  }));
  const generated = generateWeeklyPlan({
    weekStart,
    profile: {
      trainingExperience: profile.trainingExperience,
      injuries: parseJson<string[]>(profile.injuriesJson)
    },
    goals: goals.map((goal) => ({ title: goal.title, type: goal.type, priority: goal.priority })),
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
  const primaryGoalId = goals[0]?.id;

  return prisma.$transaction(async (tx) => {
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
            goalId: primaryGoalId,
            checklistItems: {
              create: task.checklist.map((label, index) => ({ label, order: index + 1 }))
            }
          }))
        }
      },
      include: { trainingTasks: true }
    });
    const drafts = createCalendarDraftsFromTasks(
      plan.trainingTasks.map((task) => ({
        id: task.id,
        title: task.title,
        scheduledStart: task.scheduledStart?.toISOString(),
        scheduledEnd: task.scheduledEnd?.toISOString(),
        trainingType: task.trainingType,
        intensity: task.intensity
      }))
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
