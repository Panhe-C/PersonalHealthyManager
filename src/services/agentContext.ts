import type { AgentIntent } from "@/src/services/agent";
import { prisma } from "@/src/db/client";
import { syncCorosFromSettings } from "@/src/services/syncService";

export type AgentContext = {
  intent: AgentIntent;
  freshSync: {
    attempted: boolean;
    succeeded: boolean;
    error?: string;
  };
  sections: Array<{ title: string; content: string }>;
};

export function shouldRefreshCoros(message: string) {
  return /最新|同步|拉取|刚刚|现在的数据|latest|sync|refresh|pull latest/i.test(message);
}

function formatDate(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : "unknown date";
}

function section(title: string, lines: string[]) {
  const content = lines.filter(Boolean).join("\n");
  return { title, content: content || "No synced data available." };
}

async function loadCommonContext(userId: string) {
  const [profile, goals] = await Promise.all([
    prisma.bodyProfile.findUnique({ where: { userId } }),
    prisma.goal.findMany({ where: { userId, status: "active" }, orderBy: { priority: "desc" }, take: 5 })
  ]);

  return [
    section("Body profile", [
      profile
        ? `Height ${profile.heightCm} cm, weight ${profile.weightKg} kg, experience ${profile.trainingExperience}, resting HR ${profile.restingHeartRateBpm ?? "unknown"}.`
        : "No body profile saved.",
      goals.length > 0 ? `Active goals: ${goals.map((goal) => `${goal.title} priority ${goal.priority}`).join("; ")}.` : "No active goals saved."
    ])
  ];
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
      sleep.map((item) => `${formatDate(item.date)}: ${item.durationMinutes} min, score ${item.qualityScore ?? "unknown"}.`)
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
  const plan = await prisma.plan.findFirst({
    where: { userId, status: { not: "superseded" } },
    orderBy: { weekStart: "desc" },
    select: { nutritionTargetsJson: true, menuRecommendationsJson: true, summary: true }
  });

  return [
    section("Nutrition plan", [
      plan
        ? `Plan summary: ${plan.summary}\nNutrition targets: ${plan.nutritionTargetsJson}\nMenu recommendations: ${plan.menuRecommendationsJson}`
        : "No nutrition plan generated."
    ])
  ];
}

export async function buildAgentContext(userId: string, intent: AgentIntent, message: string): Promise<AgentContext> {
  const freshSync = shouldRefreshCoros(message)
    ? await syncCorosFromSettings(userId)
        .then(() => ({ attempted: true, succeeded: true }))
        .catch((error) => ({
          attempted: true,
          succeeded: false,
          error: error instanceof Error ? error.message : "COROS sync failed."
        }))
    : { attempted: false, succeeded: false };

  const common = await loadCommonContext(userId);
  const specific =
    intent === "recovery_check"
      ? await loadRecoveryContext(userId)
      : intent === "calendar_confirmation" || intent === "replan"
        ? await loadPlanContext(userId)
        : intent === "menu_advice"
          ? await loadMenuContext(userId)
          : [];

  return { intent, freshSync, sections: [...common, ...specific] };
}
