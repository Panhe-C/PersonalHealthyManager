import type { NormalizedCalendarSnapshot, TimeWindow } from "@/src/domain/models";

export type FeishuWindow = {
  start: string;
  end: string;
  title?: string;
};

export type FeishuCalendarPayload = {
  rangeStart: string;
  rangeEnd: string;
  busy: FeishuWindow[];
  free: FeishuWindow[];
};

const IMPORTANT_EVENT_PATTERN = /travel|flight|doctor|race|比赛|出差|体检/i;

function normalizeWindow(window: FeishuWindow): TimeWindow {
  return {
    start: new Date(window.start).toISOString(),
    end: new Date(window.end).toISOString(),
    ...(window.title ? { title: window.title } : {})
  };
}

export function normalizeFeishuCalendarSnapshot(payload: FeishuCalendarPayload): NormalizedCalendarSnapshot {
  const busyWindows = payload.busy.map(normalizeWindow);

  return {
    source: "feishu",
    rangeStart: new Date(payload.rangeStart),
    rangeEnd: new Date(payload.rangeEnd),
    busyWindows,
    freeWindows: payload.free.map(normalizeWindow),
    importantEvents: busyWindows.filter((window) => IMPORTANT_EVENT_PATTERN.test(window.title ?? ""))
  };
}
