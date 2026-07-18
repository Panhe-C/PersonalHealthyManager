export type TrendActivity = {
  id: string;
  startedAt: Date;
  durationMinutes: number;
  trainingLoad?: number | null;
  averageHeartRateBpm?: number | null;
};

export type TrendSleep = {
  id: string;
  date: Date;
  durationMinutes: number;
  qualityScore?: number | null;
  sleepStart?: Date | null;
  sleepEnd?: Date | null;
};

export type TrendRecovery = {
  id: string;
  date: Date;
  recoveryPercent?: number | null;
  hrvMs?: number | null;
  restingHeartRateBpm?: number | null;
};

export type TrendDay = {
  /** yyyy-mm-dd in the user's timezone */
  key: string;
  /** short weekday label, e.g. "Mon" */
  label: string;
  isToday: boolean;
  trainingMinutes: number;
  trainingLoad: number | null;
  averageHeartRateBpm: number | null;
  sleepMinutes: number | null;
  sleepQualityScore: number | null;
  /** minutes since 15:00 (3pm anchor) — positions the sleep bar on a 24h evening→morning axis */
  sleepWindowStart: number | null;
  sleepWindowDuration: number | null;
  recoveryPercent: number | null;
  hrvMs: number | null;
  restingHeartRateBpm: number | null;
};

const dayKeyFormatterCache = new Map<string, Intl.DateTimeFormat>();
const timeFormatterCache = new Map<string, Intl.DateTimeFormat>();
const weekdayFormatter = new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" });

function dayKey(date: Date, timezone: string) {
  let formatter = dayKeyFormatterCache.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    dayKeyFormatterCache.set(timezone, formatter);
  }
  return formatter.format(date);
}

function minutesOfDay(date: Date, timezone: string) {
  let formatter = timeFormatterCache.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    });
    timeFormatterCache.set(timezone, formatter);
  }
  const [hours, minutes] = formatter.format(date).split(":").map(Number);
  return hours * 60 + minutes;
}

/** Last `count` calendar days ending today in `timezone`, as yyyy-mm-dd keys. */
export function lastDayKeys(timezone: string, count = 7, now = new Date()): string[] {
  const todayKey = dayKey(now, timezone);
  const todayUtc = Date.parse(`${todayKey}T00:00:00Z`);
  return Array.from({ length: count }, (_, index) => {
    const offset = index - (count - 1);
    return new Date(todayUtc + offset * 86_400_000).toISOString().slice(0, 10);
  });
}

function weekdayLabel(key: string) {
  return weekdayFormatter.format(new Date(`${key}T00:00:00Z`));
}

/** Sleep window is anchored at 15:00 so an evening bedtime and its morning wake-up stay in one row. */
const SLEEP_ANCHOR_MINUTES = 15 * 60;

function sleepWindow(sleepStart: Date | null | undefined, sleepEnd: Date | null | undefined, fallbackMinutes: number, timezone: string) {
  if (!sleepStart || !sleepEnd) return { start: null, duration: null };
  const startMinutes = minutesOfDay(sleepStart, timezone);
  let duration = Math.round((sleepEnd.getTime() - sleepStart.getTime()) / 60_000);
  if (duration <= 0) duration = fallbackMinutes;
  if (duration <= 0) return { start: null, duration: null };
  return { start: (startMinutes - SLEEP_ANCHOR_MINUTES + 1440) % 1440, duration };
}

export function buildDailyTrends(input: {
  timezone: string;
  now?: Date;
  activities: TrendActivity[];
  sleepRecords: TrendSleep[];
  recoveryRecords: TrendRecovery[];
}): TrendDay[] {
  const timezone = input.timezone || "Asia/Shanghai";
  const now = input.now ?? new Date();
  const keys = lastDayKeys(timezone, 7, now);
  const todayKey = dayKey(now, timezone);

  const activityByDay = new Map<string, TrendActivity[]>();
  for (const activity of input.activities) {
    const key = dayKey(activity.startedAt, timezone);
    activityByDay.set(key, [...(activityByDay.get(key) ?? []), activity]);
  }

  const sleepByDay = new Map<string, TrendSleep>();
  for (const record of input.sleepRecords) {
    sleepByDay.set(dayKey(record.date, timezone), record);
  }

  const recoveryByDay = new Map<string, TrendRecovery>();
  for (const record of input.recoveryRecords) {
    recoveryByDay.set(dayKey(record.date, timezone), record);
  }

  return keys.map((key) => {
    const dayActivities = activityByDay.get(key) ?? [];
    const heartRates = dayActivities.flatMap((activity) =>
      activity.averageHeartRateBpm != null ? [activity.averageHeartRateBpm] : []
    );
    const loads = dayActivities.flatMap((activity) => (activity.trainingLoad != null ? [activity.trainingLoad] : []));
    const sleep = sleepByDay.get(key);
    const recovery = recoveryByDay.get(key);
    const window = sleep
      ? sleepWindow(sleep.sleepStart, sleep.sleepEnd, sleep.durationMinutes, timezone)
      : { start: null, duration: null };

    return {
      key,
      label: weekdayLabel(key),
      isToday: key === todayKey,
      trainingMinutes: dayActivities.reduce((total, activity) => total + activity.durationMinutes, 0),
      trainingLoad: loads.length > 0 ? loads.reduce((total, load) => total + load, 0) : null,
      averageHeartRateBpm:
        heartRates.length > 0 ? Math.round(heartRates.reduce((total, hr) => total + hr, 0) / heartRates.length) : null,
      sleepMinutes: sleep?.durationMinutes ?? null,
      sleepQualityScore: sleep?.qualityScore ?? null,
      sleepWindowStart: window.start,
      sleepWindowDuration: window.duration,
      recoveryPercent: recovery?.recoveryPercent ?? null,
      hrvMs: recovery?.hrvMs ?? null,
      restingHeartRateBpm: recovery?.restingHeartRateBpm ?? null
    };
  });
}
