import type {
  NormalizedActivityRecord,
  NormalizedRecoveryRecord,
  NormalizedSleepRecord,
  TrainingIntensity
} from "@/src/domain/models";

export type CorosActivityPayload = {
  labelId?: string;
  sportType: number;
  startTime: string;
  endTime: string;
  distanceKm?: number;
  averagePaceSecPerKm?: number;
  avgPaceSecPerKm?: number;
  averageSpeedKph?: number;
  avgSpeedKph?: number;
  avgHeartRate?: number;
  averageHeartRateBpm?: number;
  calories?: number;
  trainingLoad?: number;
};

export type CorosSleepPayload = {
  date: string;
  sleepStart?: string;
  sleepEnd?: string;
  durationMinutes: number;
  score?: number;
  qualityScore?: number;
};

export type CorosRecoveryPayload = {
  date: string;
  recoveryPercent?: number;
  hrvMs?: number;
  restingHeartRateBpm?: number;
  stressLevel?: number;
  trainingLoadShortTerm?: number;
  trainingLoadLongTerm?: number;
};

function normalizeSportType(sportType: number): NormalizedActivityRecord["sportType"] {
  if ([100, 101, 102, 103].includes(sportType)) return "run";
  if ([200, 201, 202, 203, 204, 205, 299].includes(sportType)) return "ride";
  if (sportType === 402) return "strength";
  return "other";
}

function classifyIntensity(trainingLoad?: number): TrainingIntensity {
  if (trainingLoad === undefined || trainingLoad < 40) return "easy";
  if (trainingLoad < 100) return "moderate";
  return "hard";
}

function normalizeDateOnly(date: string): Date {
  return date.includes("T") ? new Date(date) : new Date(`${date}T00:00:00+08:00`);
}

function getSourceId(payload: CorosActivityPayload, startedAt: Date, endedAt: Date): string {
  const labelId = payload.labelId?.trim();

  if (labelId) {
    return labelId;
  }

  const distanceKey = payload.distanceKm === undefined ? "no-distance" : String(payload.distanceKm);
  return `fallback:${payload.sportType}:${startedAt.toISOString()}:${endedAt.toISOString()}:${distanceKey}`;
}

export function normalizeCorosActivity(payload: CorosActivityPayload): NormalizedActivityRecord {
  const startedAt = new Date(payload.startTime);
  const endedAt = new Date(payload.endTime);
  const durationMinutes = Math.round((endedAt.getTime() - startedAt.getTime()) / 60000);

  return {
    source: "coros",
    sourceId: getSourceId(payload, startedAt, endedAt),
    sportType: normalizeSportType(payload.sportType),
    startedAt,
    endedAt,
    durationMinutes,
    distanceKm: payload.distanceKm,
    averagePaceSecPerKm: payload.averagePaceSecPerKm ?? payload.avgPaceSecPerKm,
    averageSpeedKph: payload.averageSpeedKph ?? payload.avgSpeedKph,
    averageHeartRateBpm: payload.averageHeartRateBpm ?? payload.avgHeartRate,
    calories: payload.calories,
    trainingLoad: payload.trainingLoad,
    intensity: classifyIntensity(payload.trainingLoad),
    metadata: { ...payload }
  };
}

export function normalizeCorosSleep(payload: CorosSleepPayload): NormalizedSleepRecord {
  return {
    source: "coros",
    date: normalizeDateOnly(payload.date),
    sleepStart: payload.sleepStart ? new Date(payload.sleepStart) : undefined,
    sleepEnd: payload.sleepEnd ? new Date(payload.sleepEnd) : undefined,
    durationMinutes: payload.durationMinutes,
    qualityScore: payload.qualityScore ?? payload.score,
    metadata: { ...payload }
  };
}

export function normalizeCorosRecovery(payload: CorosRecoveryPayload): NormalizedRecoveryRecord {
  return {
    source: "coros",
    date: normalizeDateOnly(payload.date),
    recoveryPercent: payload.recoveryPercent,
    hrvMs: payload.hrvMs,
    restingHeartRateBpm: payload.restingHeartRateBpm,
    stressLevel: payload.stressLevel,
    trainingLoadShortTerm: payload.trainingLoadShortTerm,
    trainingLoadLongTerm: payload.trainingLoadLongTerm,
    metadata: { ...payload }
  };
}
