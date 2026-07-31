import type { AgentIntent } from "@/src/services/agent";
import type { MealMenu } from "@/src/domain/models";
import { prisma } from "@/src/db/client";
import { syncCorosFromSettings } from "@/src/services/syncService";
import { getMealMenusForDate } from "@/src/services/mealMenuService";
import {
  formatMemoryLines,
  loadActiveMemoriesForContext
} from "@/src/services/agentMemory/memoryService";
import {
  loadConversationSummaryForContext,
  loadRecentConversationSummaries
} from "@/src/services/agentMemory/summaryService";

export type AgentContext = {
  intent: AgentIntent;
  freshSync: {
    attempted: boolean;
    succeeded: boolean;
    authRequired?: boolean;
    error?: string;
  };
  sections: Array<{ title: string; content: string }>;
};

export function shouldRefreshCoros(message: string) {
  const explicitFreshRequest = /最新|同步|拉取|刚刚|现在的数据|latest|sync|refresh|pull latest/i.test(message);
  const explicitCorosLookup =
    /coros|高驰|mcp/i.test(message) &&
    /查|看|读取|获取|取|数据|睡眠|恢复|运动|健康|read|get|fetch|query/i.test(message);
  const recentHealthDataLookup =
    /看|查|分析|告诉|数据|多少|情况|show|check|analy[sz]e|data/i.test(message) &&
    /昨晚|昨天|今天|今早|最近|本周|last night|yesterday|today|recent|this week/i.test(message) &&
    /睡眠|深睡|浅睡|rem|清醒|恢复|hrv|静息心率|压力|运动|训练|sleep|recovery|activity|training/i.test(message);

  return explicitFreshRequest || explicitCorosLookup || recentHealthDataLookup;
}

function corosSyncFailure(error: unknown): AgentContext["freshSync"] {
  const message = error instanceof Error ? error.message : "COROS sync failed.";
  if (/HTTP (?:401|403)\b|auth(?:entication|orization).*(?:required|expired|invalid)/i.test(message)) {
    const status = message.match(/HTTP (401|403)\b/i)?.[1] ?? "authentication error";
    return {
      attempted: true,
      succeeded: false,
      authRequired: true,
      error: `COROS authorization expired (${status === "authentication error" ? status : `HTTP ${status}`}). Reconnect COROS in Settings.`
    };
  }
  return { attempted: true, succeeded: false, error: message };
}

function formatDate(value: Date | null | undefined) {
  if (!value) return "unknown date";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(value);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return year && month && day ? `${year}-${month}-${day}` : "unknown date";
}

function section(title: string, lines: string[]) {
  const content = lines.filter(Boolean).join("\n");
  return { title, content: content || "No synced data available." };
}

function formatActivityLine(item: {
  startedAt: Date;
  sportType: string;
  durationMinutes: number;
  distanceKm: number | null;
  averageHeartRateBpm: number | null;
  intensity: string;
}) {
  const distance = item.distanceKm == null ? "" : `${Number(item.distanceKm.toFixed(2))} km, `;
  const heartRate = item.averageHeartRateBpm == null ? "HR unknown" : `HR ${item.averageHeartRateBpm}`;
  return `${formatDate(item.startedAt)}: ${item.sportType}, ${item.durationMinutes} min, ${distance}${heartRate}, intensity ${item.intensity}.`;
}

function formatSleepLine(item: {
  date: Date;
  durationMinutes: number;
  qualityScore: number | null;
  deepSleepMinutes: number | null;
  lightSleepMinutes: number | null;
  remSleepMinutes: number | null;
  awakeMinutes: number | null;
}) {
  const stages = [
    item.deepSleepMinutes == null ? "" : `deep ${item.deepSleepMinutes} min`,
    item.lightSleepMinutes == null ? "" : `light ${item.lightSleepMinutes} min`,
    item.remSleepMinutes == null ? "" : `REM ${item.remSleepMinutes} min`,
    item.awakeMinutes == null ? "" : `awake ${item.awakeMinutes} min`
  ].filter(Boolean);
  const stageSummary = stages.length > 0 ? `, ${stages.join(", ")}` : "";
  return `${formatDate(item.date)}: ${item.durationMinutes} min, score ${item.qualityScore ?? "unknown"}${stageSummary}.`;
}

async function loadCommonContext(userId: string, intent: AgentIntent) {
  const [profile, goals, memories] = await Promise.all([
    prisma.bodyProfile.findUnique({ where: { userId } }),
    prisma.goal.findMany({ where: { userId, status: "active" }, orderBy: { priority: "desc" }, take: 5 }),
    loadActiveMemoriesForContext(userId, intent)
  ]);

  return [
    section("Body profile", [
      profile
        ? `Height ${profile.heightCm} cm, weight ${profile.weightKg} kg, experience ${profile.trainingExperience}, resting HR ${profile.restingHeartRateBpm ?? "unknown"}.`
        : "No body profile saved.",
      goals.length > 0 ? `Active goals: ${goals.map((goal) => `${goal.title} priority ${goal.priority}`).join("; ")}.` : "No active goals saved."
    ]),
    section(
      "User memory",
      memories.length > 0
        ? formatMemoryLines(memories)
        : ["No long-term memories saved yet."]
    )
  ];
}

async function loadMemorySummaryContext(userId: string, conversationId: string | undefined) {
  if (!conversationId) return [];
  const [currentSummary, recentSummaries] = await Promise.all([
    loadConversationSummaryForContext(userId, conversationId),
    loadRecentConversationSummaries(userId, conversationId)
  ]);

  const sections: Array<{ title: string; content: string }> = [];
  if (currentSummary) {
    sections.push(section("Earlier in this conversation", [currentSummary]));
  }
  if (recentSummaries.length > 0) {
    sections.push(
      section(
        "Recent past conversations",
        recentSummaries.map((item) => `${item.title}: ${item.summary}`)
      )
    );
  }
  return sections;
}

async function loadRecoveryContext(userId: string) {
  const [sleep, recovery, activities] = await Promise.all([
    prisma.sleepRecord.findMany({ where: { userId }, orderBy: { date: "desc" }, take: 5 }),
    prisma.recoveryRecord.findMany({ where: { userId }, orderBy: { date: "desc" }, take: 5 }),
    prisma.activityRecord.findMany({ where: { userId }, orderBy: { startedAt: "desc" }, take: 5 })
  ]);

  return [
    section(
      "Recent sleep",
      sleep.map(formatSleepLine)
    ),
    section(
      "Recent recovery",
      recovery.map(
        (item) =>
          `${formatDate(item.date)}: recovery ${item.recoveryPercent ?? "unknown"}%, HRV ${item.hrvMs ?? "unknown"}, resting HR ${item.restingHeartRateBpm ?? "unknown"}.`
      )
    ),
    section(
      "Recent activities",
      activities.map((item) => `${formatDate(item.startedAt)}: ${item.sportType}, ${item.durationMinutes} min, intensity ${item.intensity}.`)
    )
  ];
}

async function loadTrainingAnalysisContext(userId: string) {
  const activities = await prisma.activityRecord.findMany({
    where: { userId },
    orderBy: { startedAt: "desc" },
    take: 14,
    select: {
      startedAt: true,
      sportType: true,
      durationMinutes: true,
      distanceKm: true,
      averageHeartRateBpm: true,
      intensity: true
    }
  });

  return [section("Recent activities", activities.map(formatActivityLine))];
}

async function loadPlanContext(userId: string) {
  const [plan, calendarSnapshot, drafts] = await Promise.all([
    prisma.plan.findFirst({
      where: { userId, status: { not: "superseded" } },
      orderBy: { weekStart: "desc" },
      include: { trainingTasks: { orderBy: { date: "asc" }, take: 14 } }
    }),
    prisma.calendarSnapshot.findFirst({ where: { userId }, orderBy: { capturedAt: "desc" } }),
    prisma.calendarEventDraft.findMany({ where: { userId, status: "draft" }, orderBy: { startsAt: "asc" }, take: 10 })
  ]);

  return [
    section("Latest plan", [
      plan ? `${plan.summary}\nTasks: ${plan.trainingTasks.map((task) => `${formatDate(task.date)} ${task.title} ${task.intensity}`).join("; ")}` : "No active plan found."
    ]),
    section("Calendar snapshot", [
      calendarSnapshot ? `Calendar snapshot covers ${formatDate(calendarSnapshot.rangeStart)} to ${formatDate(calendarSnapshot.rangeEnd)}.` : "No calendar snapshot synced."
    ]),
    section("Calendar drafts", drafts.map((draft) => `${formatDate(draft.startsAt)} ${draft.title} ${draft.status}.`))
  ];
}

async function loadMenuContext(userId: string) {
  const [plan, todaysMenus] = await Promise.all([
    prisma.plan.findFirst({
      where: { userId, status: { not: "superseded" } },
      orderBy: { weekStart: "desc" },
      select: { nutritionTargetsJson: true, menuRecommendationsJson: true, summary: true }
    }),
    getMealMenusForDate(userId, new Date()).catch(() => [] as MealMenu[])
  ]);

  const menuLines = todaysMenus.flatMap((menu) =>
    menu.items.map((item) => `${menu.meal}: ${item.name} (${item.calories} kcal, protein ${item.proteinGrams}g, tags ${item.tags.join("/") || "none"})`)
  );

  return [
    section("Nutrition plan", [
      plan
        ? `Plan summary: ${plan.summary}\nNutrition targets: ${plan.nutritionTargetsJson}\nMenu recommendations: ${plan.menuRecommendationsJson}`
        : "No nutrition plan generated."
    ]),
    section(
      "Today's menu",
      todaysMenus.length > 0 ? menuLines : ["No live menu available for today; falling back to cached recommendations."]
    )
  ];
}

export async function buildAgentContext(
  userId: string,
  intent: AgentIntent,
  message: string,
  conversationId?: string
): Promise<AgentContext> {
  const freshSync = shouldRefreshCoros(message)
    ? await syncCorosFromSettings(userId)
        .then(() => ({ attempted: true, succeeded: true }))
        .catch(corosSyncFailure)
    : { attempted: false, succeeded: false };

  const [common, summarySections, specific] = await Promise.all([
    loadCommonContext(userId, intent),
    loadMemorySummaryContext(userId, conversationId),
    intent === "recovery_check"
      ? loadRecoveryContext(userId)
      : intent === "calendar_confirmation" || intent === "replan"
        ? loadPlanContext(userId)
        : intent === "menu_advice"
          ? loadMenuContext(userId)
          : intent === "training_analysis"
            ? loadTrainingAnalysisContext(userId)
            : Promise.resolve([])
  ]);

  return { intent, freshSync, sections: [...common, ...summarySections, ...specific] };
}
