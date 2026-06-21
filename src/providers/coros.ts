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
  dateOnly?: boolean;
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
  if (sportType === 900) return "walk";
  if (sportType === 901) return "jump_rope";
  if (sportType === 903) return "elliptical";
  if (sportType === 906) return "boxing";
  return "other";
}

function classifyIntensity(trainingLoad?: number): TrainingIntensity {
  if (trainingLoad === undefined || trainingLoad < 40) return "easy";
  if (trainingLoad < 100) return "moderate";
  return "hard";
}

/**
 * COROS payloads have used several timestamp shapes (ISO strings, epoch seconds/millis, and
 * compact `yyyyMMdd`). Parse all of them into a valid Date, or return null when unparseable.
 */
function toValidDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  if (typeof value === "number" && Number.isFinite(value)) {
    // Heuristic: values below ~1e12 are epoch seconds, otherwise milliseconds.
    const ms = Math.abs(value) < 1e12 ? value * 1000 : value;
    const fromNumber = new Date(ms);
    return Number.isNaN(fromNumber.getTime()) ? null : fromNumber;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (/^\d+$/.test(trimmed)) {
      // Compact calendar date, e.g. "20260602".
      if (trimmed.length === 8) {
        const compact = new Date(`${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}T00:00:00+08:00`);
        return Number.isNaN(compact.getTime()) ? null : compact;
      }
      return toValidDate(Number(trimmed));
    }

    // Date-only strings are anchored to COROS's China timezone; full timestamps are parsed as-is.
    const candidate = /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? `${trimmed}T00:00:00+08:00` : trimmed;
    const parsed = new Date(candidate);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function parseRequiredDate(value: unknown, field: string): Date {
  const parsed = toValidDate(value);
  if (!parsed) {
    throw new Error(`COROS ${field} is missing or not a valid date (received ${JSON.stringify(value)}).`);
  }
  return parsed;
}

function normalizeDateOnly(date: string): Date {
  return parseRequiredDate(date, "date");
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
  const startedAt = parseRequiredDate(payload.startTime, "activity startTime");
  // `endTime` is optional: fall back to the start so a missing/invalid value doesn't drop the record.
  const endedAt = toValidDate(payload.endTime) ?? startedAt;
  const durationMinutes = Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000));

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
    sleepStart: toValidDate(payload.sleepStart) ?? undefined,
    sleepEnd: toValidDate(payload.sleepEnd) ?? undefined,
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
