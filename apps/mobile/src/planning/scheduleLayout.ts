// Pure layout math for the plan schedule page: which of the day's tasks land
// on the timeline, and where. No RN imports, so it is unit-testable.

export type ScheduleTaskLike = {
  id: string;
  title: string;
  status: string;
  durationMinutes: number;
  scheduledStart: string | null;
  scheduledEnd: string | null;
};

export type PositionedTask = {
  task: ScheduleTaskLike;
  /** Offset from the timeline top, in points. */
  top: number;
  /** Card height in points; short sessions get a readable minimum. */
  height: number;
};

export type DaySchedule = {
  timed: PositionedTask[];
  untimed: ScheduleTaskLike[];
};

export const TIMELINE_START_HOUR = 6;
export const TIMELINE_END_HOUR = 23;
export const TIMELINE_HOUR_HEIGHT = 56;
const MIN_CARD_HEIGHT = 44;

export type TimelineOptions = {
  timeZone: string;
  startHour?: number;
  endHour?: number;
  hourHeight?: number;
};

/** Minutes since local midnight for an ISO timestamp in the app time zone. */
export function localMinutesInDay(iso: string, timeZone: string): number | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return (hour % 24) * 60 + minute;
}

/** Split the day's tasks into timeline-positioned cards and the untimed list. */
export function layoutDaySchedule(tasks: ScheduleTaskLike[], options: TimelineOptions): DaySchedule {
  const startHour = options.startHour ?? TIMELINE_START_HOUR;
  const endHour = options.endHour ?? TIMELINE_END_HOUR;
  const hourHeight = options.hourHeight ?? TIMELINE_HOUR_HEIGHT;
  const startMinutes = startHour * 60;
  const endMinutes = endHour * 60;

  const timed: PositionedTask[] = [];
  const untimed: ScheduleTaskLike[] = [];

  for (const task of tasks) {
    const from = task.scheduledStart ? localMinutesInDay(task.scheduledStart, options.timeZone) : null;
    const to = task.scheduledEnd ? localMinutesInDay(task.scheduledEnd, options.timeZone) : null;
    if (from == null || to == null || to <= from) {
      untimed.push(task);
      continue;
    }
    // Sessions outside the ruler stay visible: clamp into the displayed range.
    const clampedStart = Math.min(Math.max(from, startMinutes), endMinutes);
    const clampedEnd = Math.min(Math.max(to, startMinutes), endMinutes);
    if (clampedEnd <= clampedStart) {
      untimed.push(task);
      continue;
    }
    timed.push({
      task,
      top: ((clampedStart - startMinutes) / 60) * hourHeight,
      height: Math.max(MIN_CARD_HEIGHT, ((clampedEnd - clampedStart) / 60) * hourHeight)
    });
  }

  timed.sort((a, b) => a.top - b.top);
  return { timed, untimed };
}

/** Status badge copy for a schedule card. */
export function scheduleStatusLabel(status: string): string {
  if (status === "completed") return "已完成";
  if (status === "skipped") return "已跳过";
  return "待完成";
}

/** Accent-bar tone for a schedule card. */
export function scheduleStatusTone(status: string): "tint" | "controlFill" | "labelTertiary" {
  if (status === "completed") return "tint";
  if (status === "skipped") return "labelTertiary";
  return "controlFill";
}
