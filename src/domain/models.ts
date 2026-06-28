export type TrainingIntensity = "recovery" | "easy" | "moderate" | "hard";
export type TrainingStatus = "planned" | "completed" | "partial" | "skipped" | "over_completed";
export type GoalType = "long_term" | "primary" | "short_term_event" | "secondary";

export type TimeWindow = {
  start: string;
  end: string;
  title?: string;
};

export type NormalizedActivityRecord = {
  source: "coros";
  sourceId: string;
  sportType: "run" | "ride" | "strength" | "boxing" | "elliptical" | "jump_rope" | "walk" | "other";
  startedAt: Date;
  endedAt: Date;
  durationMinutes: number;
  distanceKm?: number;
  averagePaceSecPerKm?: number;
  averageSpeedKph?: number;
  averageHeartRateBpm?: number;
  calories?: number;
  trainingLoad?: number;
  intensity: TrainingIntensity;
  metadata: Record<string, unknown>;
};

export type NormalizedSleepRecord = {
  source: "coros";
  date: Date;
  sleepStart?: Date;
  sleepEnd?: Date;
  durationMinutes: number;
  qualityScore?: number;
  metadata: Record<string, unknown>;
};

export type NormalizedRecoveryRecord = {
  source: "coros";
  date: Date;
  recoveryPercent?: number;
  hrvMs?: number;
  restingHeartRateBpm?: number;
  stressLevel?: number;
  trainingLoadShortTerm?: number;
  trainingLoadLongTerm?: number;
  metadata: Record<string, unknown>;
};

export type NormalizedCalendarSnapshot = {
  source: "feishu";
  rangeStart: Date;
  rangeEnd: Date;
  busyWindows: TimeWindow[];
  freeWindows: TimeWindow[];
  importantEvents: TimeWindow[];
};

export type MealMenuItem = {
  name: string;
  calories: number;
  proteinGrams: number;
  carbohydrateGrams: number;
  fatGrams: number;
  tags: string[];
};

export type MealMenu = {
  source: "mock" | "bytecanteen";
  date: Date;
  meal: "breakfast" | "lunch" | "dinner";
  items: MealMenuItem[];
};
