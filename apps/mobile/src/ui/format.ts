export const APP_TIME_ZONE = "Asia/Shanghai";

export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "无记录";
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`;
}

export function formatDateLabel(value: string | null | undefined): string {
  if (!value) return "未知日期";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未知日期";

  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: APP_TIME_ZONE,
    month: "numeric",
    day: "numeric"
  }).formatToParts(date);
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return month && day ? `${month}月${day}日` : "未知日期";
}

export function formatTaskWindow(start: string | null | undefined, end: string | null | undefined): string {
  if (!start || !end) return "未排期";
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return "未排期";

  const formatter = new Intl.DateTimeFormat("zh-CN", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  return `${formatter.format(startDate)}-${formatter.format(endDate)}`;
}

export function parseJsonObject<T extends Record<string, unknown>>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

export function percentLabel(value: number | null | undefined): string {
  return typeof value === "number" ? `${value}%` : "无记录";
}

export function numberLabel(value: number | null | undefined, suffix = ""): string {
  return typeof value === "number" ? `${value}${suffix}` : "无记录";
}

const SPORT_TYPE_LABELS: Record<string, string> = {
  run: "跑步",
  ride: "骑行",
  strength: "力量",
  walk: "步行",
  jump_rope: "跳绳",
  elliptical: "椭圆机",
  boxing: "拳击",
  other: "其他运动"
};

/** Maps normalized sport codes (and common English names) to short Chinese labels. */
export function sportTypeLabel(sportType: string): string {
  const key = sportType.trim().toLowerCase();
  if (SPORT_TYPE_LABELS[key]) return SPORT_TYPE_LABELS[key];
  if (/run|跑步/.test(key)) return "跑步";
  if (/ride|cycl|骑/.test(key)) return "骑行";
  if (/walk|步行|走/.test(key)) return "步行";
  if (/strength|力量|力量训练/.test(key)) return "力量";
  return sportType.trim() || "运动";
}

/** Compact intensity label for activity rows. */
export function intensityLabel(intensity: string): string {
  const value = intensity.trim().toLowerCase();
  if (/easy|轻松|recovery|低|low/.test(value)) return "轻松";
  if (/high|hard|vigorous|强度/.test(value) && !/中等|moderate|medium/.test(value)) return "高强度";
  if (/moderate|中等|medium/.test(value)) return "中等";
  return intensity.trim() || "—";
}

/** Subtitle bits for an activity row: date · duration · optional distance/HR. */
export function formatActivitySubtitle(activity: {
  startedAt: string;
  durationMinutes: number;
  distanceKm?: number | null;
  averageHeartRateBpm?: number | null;
}): string {
  const parts = [formatDateLabel(activity.startedAt), formatDuration(activity.durationMinutes)];
  if (typeof activity.distanceKm === "number") {
    const km = activity.distanceKm >= 10 ? activity.distanceKm.toFixed(1) : activity.distanceKm.toFixed(2);
    parts.push(`${Number(km)} km`);
  }
  if (typeof activity.averageHeartRateBpm === "number") {
    parts.push(`${activity.averageHeartRateBpm} bpm`);
  }
  return parts.join(" · ");
}

function localDateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  return {
    year: Number(parts.find((part) => part.type === "year")?.value ?? "1970"),
    month: Number(parts.find((part) => part.type === "month")?.value ?? "1"),
    day: Number(parts.find((part) => part.type === "day")?.value ?? "1")
  };
}

/** Local calendar day (`YYYY-MM-DD`) of a timestamp in `timeZone`; "" for
 *  unparseable input. This is the single day-bucketing primitive — insights
 *  aggregations must bucket by it, never by UTC date. */
export function localDateKey(value: string | Date, timeZone = APP_TIME_ZONE): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = localDateParts(date, timeZone);
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${parts.year}-${month}-${day}`;
}

function zonedMidnightToUtcIso(year: number, month: number, day: number, timeZone: string) {
  const utcGuess = new Date(Date.UTC(year, month - 1, day));
  const guessedLocal = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(utcGuess);
  const value = Object.fromEntries(guessedLocal.map((part) => [part.type, part.value]));
  const representedLocalUtc = Date.UTC(
    Number(value.year),
    Number(value.month) - 1,
    Number(value.day),
    Number(value.hour),
    Number(value.minute),
    Number(value.second)
  );
  const offsetMs = representedLocalUtc - utcGuess.getTime();
  return new Date(Date.UTC(year, month - 1, day) - offsetMs).toISOString();
}

export function currentWeekStartIso(date = new Date(), timeZone = APP_TIME_ZONE): string {
  const local = localDateParts(date, timeZone);
  const localDay = new Date(Date.UTC(local.year, local.month - 1, local.day));
  const daysSinceMonday = (localDay.getUTCDay() + 6) % 7;
  const monday = new Date(localDay.getTime() - daysSinceMonday * 24 * 60 * 60 * 1000);
  return zonedMidnightToUtcIso(monday.getUTCFullYear(), monday.getUTCMonth() + 1, monday.getUTCDate(), timeZone);
}

export function weekDayNumbers(value: string | null | undefined, timeZone = APP_TIME_ZONE): number[] {
  const parsed = value ? new Date(value) : new Date(Number.NaN);
  const weekStart = Number.isNaN(parsed.getTime()) ? new Date(currentWeekStartIso(new Date(), timeZone)) : parsed;

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart.getTime() + index * 24 * 60 * 60 * 1000);
    return localDateParts(date, timeZone).day;
  });
}
