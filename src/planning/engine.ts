import type {
  MealMenu,
  NormalizedActivityRecord,
  NormalizedCalendarSnapshot,
  NormalizedRecoveryRecord,
  NormalizedSleepRecord,
  TrainingIntensity
} from "@/src/domain/models";
import { recommendMenuChoices } from "@/src/planning/nutrition";

type PlanningGoal = {
  title: string;
  type: string;
  priority: number;
};

type PlanningProfile = {
  trainingExperience: string;
  injuries: string[];
};

export type GeneratedTrainingTask = {
  date: string;
  title: string;
  trainingType: string;
  durationMinutes: number;
  intensity: TrainingIntensity;
  target: Record<string, unknown>;
  scheduledStart?: string;
  scheduledEnd?: string;
  checklist: string[];
};

export type GeneratedWeeklyPlan = {
  weekStart: string;
  weekEnd: string;
  summary: string;
  tasks: GeneratedTrainingTask[];
  nutritionTargets: ReturnType<typeof recommendMenuChoices>;
  explanation: string;
};

function latestByDate<T>(records: T[], getDate: (record: T) => Date): T | undefined {
  return [...records].sort((left, right) => getDate(left).getTime() - getDate(right).getTime()).at(-1);
}

function dayFromWeekStart(weekStart: Date, offset: number): string {
  return new Date(weekStart.getTime() + offset * 24 * 60 * 60 * 1000).toISOString();
}

export function generateWeeklyPlan(input: {
  weekStart: Date;
  profile: PlanningProfile;
  goals: PlanningGoal[];
  activities: NormalizedActivityRecord[];
  sleepRecords: NormalizedSleepRecord[];
  recoveryRecords: NormalizedRecoveryRecord[];
  calendar: NormalizedCalendarSnapshot;
  mealMenus: MealMenu[];
}): GeneratedWeeklyPlan {
  const latestSleep = latestByDate(input.sleepRecords, (record) => record.date);
  const latestRecovery = latestByDate(input.recoveryRecords, (record) => record.date);
  const poorSleep = (latestSleep?.durationMinutes ?? 999) < 360 || (latestSleep?.qualityScore ?? 100) < 55;
  const poorRecovery = (latestRecovery?.recoveryPercent ?? 100) < 50;
  const hasInjury = input.profile.injuries.length > 0;
  const primaryGoal = [...input.goals].sort((left, right) => right.priority - left.priority)[0]?.title ?? "General fitness";
  const primaryGoalLower = primaryGoal.toLowerCase();
  const firstWindow = input.calendar.freeWindows[0];

  const intensity: TrainingIntensity = poorSleep || poorRecovery || hasInjury ? "recovery" : "moderate";
  const durationMinutes = intensity === "recovery" ? 30 : 50;
  const title = intensity === "recovery" ? "Recovery mobility and easy walk" : "Aerobic base session";

  const task: GeneratedTrainingTask = {
    date: dayFromWeekStart(input.weekStart, 1),
    title,
    trainingType: intensity === "recovery" ? "recovery" : "run",
    durationMinutes,
    intensity,
    target:
      intensity === "recovery"
        ? { effort: "easy", heartRateZone: "Z1" }
        : { effort: "steady", heartRateZone: "Z2" },
    scheduledStart: firstWindow?.start,
    scheduledEnd: firstWindow?.end,
    checklist:
      intensity === "recovery"
        ? ["Easy warmup", "Mobility flow", "Walk or spin easy", "Stretch"]
        : ["Warmup 10 minutes", "Main aerobic work", "Cooldown 5 minutes", "Stretch", "Record perceived effort"]
  };

  const enduranceIsCycling = /cycling|cycle|ride|骑行/.test(primaryGoalLower);
  const enduranceIsMarathon = /marathon|马拉松/.test(primaryGoalLower);
  const followUpTasks: GeneratedTrainingTask[] = [
    {
      date: dayFromWeekStart(input.weekStart, 3),
      title: "Strength maintenance",
      trainingType: "strength",
      durationMinutes: 35,
      intensity: poorSleep || poorRecovery ? "easy" : "moderate",
      target: { focus: "full-body strength", effort: "controlled" },
      checklist: ["Warmup joints", "Main strength circuit", "Core work", "Stretch"]
    },
    {
      date: dayFromWeekStart(input.weekStart, 5),
      title: enduranceIsMarathon ? "Long easy run" : "Long aerobic session",
      trainingType: enduranceIsCycling ? "ride" : "run",
      durationMinutes: enduranceIsMarathon ? 75 : 60,
      intensity: "easy",
      target: { effort: "easy", heartRateZone: "Z2" },
      checklist: ["Warmup 10 minutes", "Main endurance work", "Cooldown", "Record perceived effort"]
    }
  ];

  const tasks = [task, ...followUpTasks];
  const nutritionTargets = recommendMenuChoices({
    menus: input.mealMenus,
    trainingIntensity: intensity,
    primaryGoal
  });
  const reasons = [
    poorSleep ? "sleep was below the safe threshold" : "",
    poorRecovery ? "recovery was low" : "",
    hasInjury ? "injury restrictions were present" : ""
  ].filter(Boolean);

  return {
    weekStart: input.weekStart.toISOString(),
    weekEnd: dayFromWeekStart(input.weekStart, 6),
    summary: `${primaryGoal} week with ${task.title.toLowerCase()}`,
    tasks,
    nutritionTargets,
    explanation:
      reasons.length > 0
        ? `Plan reduced intensity because ${reasons.join(", ")}.`
        : "Plan uses the best available calendar window and current goal priority."
  };
}
