import type { MealMenu } from "@/src/domain/models";
import { prisma } from "@/src/db/client";
import { loadMealMenusForDate, type MealMenuResult } from "@/src/services/mealMenuService";

// Read-side queries extracted from app/(dashboard)/plan/_data.ts so the v1 API
// endpoints and the RSC pages can share one implementation. The RSC _data.ts
// re-exports these with cache() wrappers to preserve existing Web behavior.

export async function getBodyProfile(userId: string) {
  return prisma.bodyProfile.findUnique({ where: { userId } });
}

export async function getActivePlan(userId: string) {
  return prisma.plan.findFirst({
    where: { userId, status: { not: "superseded" } },
    orderBy: { createdAt: "desc" },
    include: {
      trainingTasks: {
        orderBy: { date: "asc" },
        include: { checklistItems: { orderBy: { order: "asc" } } }
      }
    }
  });
}

export async function getActivePlanSummary(userId: string) {
  return prisma.plan.findFirst({
    where: { userId, status: { not: "superseded" } },
    orderBy: { createdAt: "desc" },
    select: { id: true, summary: true, nutritionTargetsJson: true }
  });
}

export async function getPrimaryGoal(userId: string) {
  return prisma.goal.findFirst({
    where: { userId, status: "active" },
    orderBy: { priority: "desc" }
  });
}

export async function getLatestRecovery(userId: string) {
  return prisma.recoveryRecord.findFirst({ where: { userId }, orderBy: { date: "desc" } });
}

export async function getLatestSleep(userId: string) {
  return prisma.sleepRecord.findFirst({ where: { userId }, orderBy: { date: "desc" } });
}

export async function getRecentActivities(userId: string, take = 10) {
  return prisma.activityRecord.findMany({
    where: { userId },
    orderBy: { startedAt: "desc" },
    take
  });
}

/**
 * The snapshot only has to overlap the target week, not contain it. The Feishu
 * sync captures from 06:00 on the day it runs, so a snapshot never starts
 * before the week's Monday midnight and a containment check would reject every
 * real snapshot from Monday morning onwards.
 */
export async function findCalendarSnapshotForWeek(userId: string, weekStart: Date, weekEnd: Date) {
  return prisma.calendarSnapshot.findFirst({
    where: {
      userId,
      rangeStart: { lte: weekEnd },
      rangeEnd: { gte: weekStart }
    },
    orderBy: { capturedAt: "desc" }
  });
}

export async function getPlanForWeek(userId: string, weekStart: Date) {
  return prisma.plan.findFirst({
    where: { userId, weekStart },
    orderBy: { createdAt: "desc" },
    include: {
      trainingTasks: {
        orderBy: { date: "asc" },
        include: { checklistItems: { orderBy: { order: "asc" } } }
      }
    }
  });
}

export interface TodayOverview {
  date: string;
  primaryGoal: Awaited<ReturnType<typeof getPrimaryGoal>>;
  latestRecovery: Awaited<ReturnType<typeof getLatestRecovery>>;
  latestSleep: Awaited<ReturnType<typeof getLatestSleep>>;
  todayTasks: NonNullable<Awaited<ReturnType<typeof getActivePlan>>>["trainingTasks"];
  /**
   * Today's meal menus, empty unless a meal menu connection is configured and
   * reachable. Clients hide the menu section on an empty list rather than
   * substituting anything.
   */
  mealMenus: MealMenu[];
  /** Lets a client tell "no connection" apart from "the connection is broken". */
  mealMenuStatus: MealMenuResult["status"];
  activePlanId: string | null;
}

/**
 * Aggregated "today" view for the mobile Today tab. `todayTasks` are filtered
 * to the user's current calendar day in their timezone.
 */
export async function getTodayOverview(userId: string, timezone: string): Promise<TodayOverview> {
  const [plan, primaryGoal, latestRecovery, latestSleep] = await Promise.all([
    getActivePlan(userId),
    getPrimaryGoal(userId),
    getLatestRecovery(userId),
    getLatestSleep(userId)
  ]);

  const now = new Date();
  const today = startOfDayInTimezone(now, timezone);

  const todayTasks = plan
    ? plan.trainingTasks.filter((task) => sameDayInTimezone(task.date, today, timezone))
    : [];
  const mealMenu = await loadMealMenusForDate(userId, today);

  return {
    date: today.toISOString(),
    primaryGoal,
    latestRecovery,
    latestSleep,
    todayTasks,
    mealMenus: mealMenu.menus,
    mealMenuStatus: mealMenu.status,
    activePlanId: plan?.id ?? null
  };
}

function startOfDayInTimezone(date: Date, timezone: string): Date {
  // Format the date in the target timezone, take the YYYY-MM-DD, and parse it
  // back as a UTC midnight. This gives a stable "calendar day" anchor that
  // sameDayInTimezone can compare against.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return new Date(`${y}-${m}-${d}T00:00:00Z`);
}

function sameDayInTimezone(a: Date, anchor: Date, timezone: string): boolean {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return fmt.format(a) === fmt.format(anchor);
}
