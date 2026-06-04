import type {
  MealMenu,
  NormalizedActivityRecord,
  NormalizedCalendarSnapshot,
  NormalizedRecoveryRecord,
  NormalizedSleepRecord,
  TrainingIntensity
} from "@/src/domain/models";
import { recommendMenuChoices } from "@/src/planning/nutrition";

export type PlanningGoal = {
  id?: string;
  title: string;
  type: string;
  priority: number;
  targetDate?: Date;
  metrics?: Record<string, unknown>;
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
  goalId?: string;
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

const DAY_MS = 24 * 60 * 60 * 1000;

function effectiveGoalPriority(goal: PlanningGoal, weekStart: Date): number {
  if (goal.type !== "short_term_event" || !goal.targetDate) {
    return goal.priority;
  }

  const daysUntilTarget = Math.ceil((goal.targetDate.getTime() - weekStart.getTime()) / DAY_MS);
  if (daysUntilTarget < 0) return goal.priority;
  if (daysUntilTarget <= 14) return goal.priority + 4;
  if (daysUntilTarget <= 42) return goal.priority + 3;
  if (daysUntilTarget <= 84) return goal.priority + 2;
  return goal.priority;
}

export function selectPrimaryGoal(goals: PlanningGoal[], weekStart: Date): PlanningGoal | undefined {
  return [...goals].sort(
    (left, right) => effectiveGoalPriority(right, weekStart) - effectiveGoalPriority(left, weekStart)
  )[0];
}

function volumeCap(profile: PlanningProfile, activities: NormalizedActivityRecord[]): number {
  const experienceCap = {
    beginner: 120,
    intermediate: 180,
    advanced: 240
  }[profile.trainingExperience] ?? 150;
  const recentMinutes = activities.reduce((total, activity) => total + activity.durationMinutes, 0);

  if (recentMinutes === 0) {
    return experienceCap;
  }

  return Math.min(experienceCap, Math.max(Math.round(experienceCap * 0.75), Math.round(recentMinutes * 1.1)));
}

function capTaskVolume(tasks: GeneratedTrainingTask[], maxMinutes: number): GeneratedTrainingTask[] {
  const totalMinutes = tasks.reduce((total, task) => total + task.durationMinutes, 0);
  if (totalMinutes <= maxMinutes) return tasks;

  const ratio = maxMinutes / totalMinutes;
  return tasks.map((task) => {
    const minimum = task.intensity === "recovery" ? 20 : 25;
    const durationMinutes = Math.max(minimum, Math.floor((task.durationMinutes * ratio) / 5) * 5);
    return { ...task, durationMinutes };
  });
}

function scheduleTasks(
  tasks: GeneratedTrainingTask[],
  calendar: NormalizedCalendarSnapshot,
  weekStart: Date,
  weekEnd: Date
): GeneratedTrainingTask[] {
  const windows = calendar.freeWindows
    .map((window) => ({ ...window, startDate: new Date(window.start), endDate: new Date(window.end) }))
    .filter((window) => window.startDate >= weekStart && window.endDate <= weekEnd && window.endDate > window.startDate)
    .sort((left, right) => left.startDate.getTime() - right.startDate.getTime());
  const usedWindows = new Set<number>();

  return tasks.map((task) => {
    const windowIndex = windows.findIndex((window, index) => {
      if (usedWindows.has(index)) return false;
      const availableMinutes = (window.endDate.getTime() - window.startDate.getTime()) / 60000;
      return availableMinutes >= task.durationMinutes;
    });

    if (windowIndex === -1) return task;

    usedWindows.add(windowIndex);
    const window = windows[windowIndex];
    return {
      ...task,
      date: window.startDate.toISOString(),
      scheduledStart: window.startDate.toISOString(),
      scheduledEnd: new Date(window.startDate.getTime() + task.durationMinutes * 60000).toISOString()
    };
  });
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
  const safetyConstrained = poorSleep || poorRecovery || hasInjury;
  const selectedGoal = selectPrimaryGoal(input.goals, input.weekStart);
  const primaryGoal = selectedGoal?.title ?? "General fitness";
  const primaryGoalLower = primaryGoal.toLowerCase();

  const intensity: TrainingIntensity = safetyConstrained ? "recovery" : "moderate";
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
      title: safetyConstrained ? "Mobility and stability" : "Strength maintenance",
      trainingType: safetyConstrained ? "recovery" : "strength",
      durationMinutes: safetyConstrained ? 25 : 35,
      intensity: safetyConstrained ? "recovery" : "moderate",
      target: safetyConstrained
        ? { focus: "mobility and stability", effort: "easy" }
        : { focus: "full-body strength", effort: "controlled" },
      checklist: ["Warmup joints", "Main strength circuit", "Core work", "Stretch"]
    },
    {
      date: dayFromWeekStart(input.weekStart, 5),
      title: safetyConstrained ? "Easy aerobic recovery" : enduranceIsMarathon ? "Long easy run" : "Long aerobic session",
      trainingType: safetyConstrained ? "recovery" : enduranceIsCycling ? "ride" : "run",
      durationMinutes: safetyConstrained ? 40 : enduranceIsMarathon ? 75 : 60,
      intensity: "easy",
      target: { effort: "easy", heartRateZone: "Z2" },
      checklist: ["Warmup 10 minutes", "Main endurance work", "Cooldown", "Record perceived effort"]
    }
  ];

  const weekEnd = new Date(input.weekStart.getTime() + 7 * DAY_MS);
  const tasks = scheduleTasks(
    capTaskVolume([task, ...followUpTasks], volumeCap(input.profile, input.activities)),
    input.calendar,
    input.weekStart,
    weekEnd
  );
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
    weekEnd: new Date(weekEnd.getTime() - 1).toISOString(),
    goalId: selectedGoal?.id,
    summary: `${primaryGoal} week with ${task.title.toLowerCase()}`,
    tasks,
    nutritionTargets,
    explanation:
      reasons.length > 0
        ? `Plan reduced intensity because ${reasons.join(", ")}.`
        : "Plan uses the best available calendar window and current goal priority."
  };
}
