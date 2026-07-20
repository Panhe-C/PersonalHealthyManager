import type { FeishuCalendarPayload, FeishuWindow } from "@/src/providers/calendar";
import { runLarkCalendarCommand, type CalendarCommandRunner } from "@/src/providers/calendar-writeback";

type AgendaEvent = {
  summary?: string;
  free_busy_status?: string;
  start_time?: { datetime?: string };
  end_time?: { datetime?: string };
};

function dayText(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function dailyFreeWindows(start: Date, days: number, busy: FeishuWindow[]) {
  const free: FeishuWindow[] = [];
  for (let day = 0; day < days; day += 1) {
    const date = new Date(start.getTime() + day * 24 * 60 * 60 * 1000);
    const label = dayText(date);
    const windowStart = new Date(`${label}T06:00:00+08:00`);
    const windowEnd = new Date(`${label}T22:00:00+08:00`);
    let cursor = windowStart.getTime();
    const occupied = busy.map((item) => ({ start: new Date(item.start).getTime(), end: new Date(item.end).getTime() }))
      .filter((item) => item.end > windowStart.getTime() && item.start < windowEnd.getTime())
      .sort((a, b) => a.start - b.start);
    for (const item of occupied) {
      const boundedStart = Math.max(item.start, windowStart.getTime());
      if (boundedStart - cursor >= 30 * 60 * 1000) free.push({ start: new Date(cursor).toISOString(), end: new Date(boundedStart).toISOString() });
      cursor = Math.max(cursor, Math.min(item.end, windowEnd.getTime()));
    }
    if (windowEnd.getTime() - cursor >= 30 * 60 * 1000) free.push({ start: new Date(cursor).toISOString(), end: windowEnd.toISOString() });
  }
  return free;
}

export async function fetchLarkCalendarPayload(now = new Date(), days = 8, runner: CalendarCommandRunner = runLarkCalendarCommand): Promise<FeishuCalendarPayload> {
  const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const stdout = await runner(["calendar", "+agenda", "--start", dayText(now), "--end", dayText(end), "--as", "user", "--format", "json"]);
  let envelope: { ok?: boolean; data?: AgendaEvent[] };
  try {
    envelope = JSON.parse(stdout) as { ok?: boolean; data?: AgendaEvent[] };
  } catch {
    throw new Error("Feishu agenda response was not valid JSON.");
  }
  if (envelope.ok !== true || !Array.isArray(envelope.data)) throw new Error("Feishu agenda response was invalid.");
  const busy = envelope.data.flatMap((event) => event.free_busy_status !== "free" && event.start_time?.datetime && event.end_time?.datetime
    ? [{ start: event.start_time.datetime, end: event.end_time.datetime, title: event.summary || "Busy" }]
    : []);
  return {
    rangeStart: `${dayText(now)}T06:00:00+08:00`,
    rangeEnd: `${dayText(end)}T22:00:00+08:00`,
    busy,
    free: dailyFreeWindows(now, days, busy)
  };
}
