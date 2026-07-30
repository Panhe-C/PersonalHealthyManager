import { APP_TIME_ZONE, currentWeekStartIso, localDateKey } from "../ui/format";

/** A record carrying a start timestamp and a duration. `ActivityRecord` fits
 *  structurally; the page maps sleep `date` into `startedAt` to reuse the
 *  same bucketing. */
export type TimedSession = {
  startedAt: string;
  durationMinutes: number;
};

export type Intensity = "easy" | "moderate" | "high";

const DAY_MS = 24 * 60 * 60 * 1000;

// Intensity strings are free-form (English from HealthKit, possibly Chinese
// from other sources), so mapping is best-effort keyword matching and unknown
// strings fall back to moderate. Explicit 低/中等 checks run before 强度 so
// 低强度/中等强度 are not caught by the 强度 keyword.
const EASY_KEYWORDS = ["easy", "轻松", "recovery", "低", "low"];
const MODERATE_KEYWORDS = ["moderate", "中等", "medium"];
const HIGH_KEYWORDS = ["high", "强度", "hard", "vigorous"];

export function normalizeIntensity(raw: string): Intensity {
  const value = raw.trim().toLowerCase();
  if (EASY_KEYWORDS.some((keyword) => value.includes(keyword))) return "easy";
  if (MODERATE_KEYWORDS.some((keyword) => value.includes(keyword))) return "moderate";
  if (HIGH_KEYWORDS.some((keyword) => value.includes(keyword))) return "high";
  return "moderate";
}

/** Total minutes per local calendar day (`YYYY-MM-DD` in `timeZone`). */
export function minutesByDay(records: readonly TimedSession[], timeZone = APP_TIME_ZONE): Map<string, number> {
  const totals = new Map<string, number>();
  for (const record of records) {
    const key = localDateKey(record.startedAt, timeZone);
    if (!key) continue;
    totals.set(key, (totals.get(key) ?? 0) + record.durationMinutes);
  }
  return totals;
}

/** Dominant intensity per day: the intensity of the day's longest session.
 *  Ties keep the earliest longest session (strict `>` comparison). */
export function dominantIntensityByDay(
  activities: ReadonlyArray<TimedSession & { intensity: string }>,
  timeZone = APP_TIME_ZONE
): Map<string, Intensity> {
  const longest = new Map<string, TimedSession & { intensity: string }>();
  for (const activity of activities) {
    const key = localDateKey(activity.startedAt, timeZone);
    if (!key) continue;
    const current = longest.get(key);
    if (!current || activity.durationMinutes > current.durationMinutes) {
      longest.set(key, activity);
    }
  }
  const dominant = new Map<string, Intensity>();
  for (const [key, session] of longest) {
    dominant.set(key, normalizeIntensity(session.intensity));
  }
  return dominant;
}

/** Aligns one ISO week's date keys (Mon–Sun) to values; missing days are 0. */
export function buildWeek(
  dateKeys: readonly string[],
  values: ReadonlyMap<string, number>
): { key: string; value: number }[] {
  return dateKeys.map((key) => ({ key, value: values.get(key) ?? 0 }));
}

/** `weekCount` ISO week columns (oldest first, current week last), each with
 *  7 local date keys Monday → Sunday. Future days of the current week are
 *  included so the grid stays rectangular. Day stepping follows the same
 *  24h-from-week-start convention as `weekDayNumbers` in `ui/format.ts`. */
export function buildHeatmapWeeks(today = new Date(), weekCount = 12, timeZone = APP_TIME_ZONE): string[][] {
  const currentWeekStart = new Date(currentWeekStartIso(today, timeZone));
  const firstWeekStart = currentWeekStart.getTime() - (weekCount - 1) * 7 * DAY_MS;
  return Array.from({ length: weekCount }, (_, week) =>
    Array.from({ length: 7 }, (_, day) =>
      localDateKey(new Date(firstWeekStart + (week * 7 + day) * DAY_MS), timeZone)
    )
  );
}

/** Fixed heatmap scale: 0 for rest days, then steps at 30/60/90 minutes.
 *  Fixed thresholds (not data-driven) keep colours stable day to day. */
export function intensityScale(minutes: number): 0 | 1 | 2 | 3 | 4 {
  if (minutes <= 0) return 0;
  if (minutes < 30) return 1;
  if (minutes < 60) return 2;
  if (minutes < 90) return 3;
  return 4;
}
