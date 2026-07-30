# Insights Tab Data Visualisation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Insights tab the visualisations the approved design spec (`docs/superpowers/specs/2026-07-29-insights-visualisation-design.md`) calls for: a 本周运动 card (seven bars of daily exercise minutes, coloured by the day's dominant intensity), a 本周睡眠 card (seven bars, latest recorded night highlighted), a 运动频率 card (12-week GitHub-style heatmap on a fixed intensity scale), and two new 分析 rows (HRV, 静息心率) fed by the latest recovery record. All aggregation logic lives in a new pure, unit-tested module `src/insights/aggregates.ts`; the two charts are dumb reusable components (`WeekBars`, `ActivityHeatmap`); the page only composes.

**Architecture:** Bottom-up, TDD per layer. (1) `src/ui/format.ts` gains one exported helper, `localDateKey(value, timeZone)` (`YYYY-MM-DD` in `APP_TIME_ZONE`, built on the existing private `localDateParts`), and `src/insights/aggregates.ts` lands the five pure functions the spec lists — `minutesByDay`, `dominantIntensityByDay`, `buildWeek`, `buildHeatmapWeeks`, `intensityScale` (plus the exported `normalizeIntensity` keyword mapper they share) — proved by a full unit suite. (2) `WeekBars` (shared 7-bar chart; geometry constants mirror the Today sleep card, which keeps its inline version per the spec's non-goals) and `ActivityHeatmap` (12×7 grid + 少 → 多 legend; green steps done as `tintFill` at 25/50/75/100% opacity, future days left transparent) land with vi.mock-style component tests. (3) `insights/index.tsx` is rewritten to compose the three new cards between the unchanged 恢复趋势/恢复曲线 cards and the extended 分析 group, bumping its query limits to `useActivitiesQuery(90)` / `useSleepQuery(7)` / `useRecoveryQuery(8)`; new `warmUi.test.ts` contract assertions pin the composition. No backend changes, no interactions, no Today-tab changes.

**Tech Stack:** Expo SDK 53, Expo Router 5.1, React Native 0.79, TypeScript (strict), lucide-react-native, `@tanstack/react-query`, Vitest.

## Global Constraints

- No backend changes — everything uses the existing `/insights/*` endpoints with larger `limit`s. `useActivitiesQuery(limit)`, `useSleepQuery(limit)`, `useRecoveryQuery(limit)` keep their exact signatures in `src/api/hooks.ts`; only the call-site arguments in `insights/index.tsx` change (8 → 90 for activities, 8 → 7 for sleep).
- Keep the app Chinese-first.
- Day bucketing must use `APP_TIME_ZONE` (Asia/Shanghai), never UTC, or bars shift a day. All local-day logic goes through `localDateKey` in `src/ui/format.ts`; `src/insights/aggregates.ts` contains no date math of its own beyond 24h steps from `currentWeekStartIso` (the same convention `weekDayNumbers` already uses).
- `src/insights/aggregates.ts` stays pure: no React Native imports, no hooks, no `new Date()` except as a defaultable parameter of `buildHeatmapWeeks`.
- Chart components stay dumb: no API hooks, no aggregation imports except `intensityScale` inside `ActivityHeatmap`; all data arrives via props.
- Static charts only — no tap handlers on bars or cells.
- The Today tab's sleep card keeps its inline bar implementation (spec non-goal); `WeekBars` deliberately reuses its geometry constants (`BAR_MAX_HEIGHT = 72`, `BAR_MIN_HEIGHT = 6`, `BAR_WIDTH = 18`, `BAR_RADIUS = 6`) so both cards read identically.
- Token key names, `radius` values, `cardShadow(scheme)` are landed — do not touch `src/theme/tokens.ts`. New colours come from the existing keys only: `tintFill`, `orange`, `red`, `fill`, `controlFill`.
- The unchanged parts of `insights/index.tsx` (stat card, `TrendChart` chart card, the three existing 分析 rows, `WarmHeader` with the 最近 8 天 overline) stay byte-identical in behaviour; the existing warmUi test `hides the native header and builds Insights from warm cards` must keep passing with its current assertions (`styles.statCard`, `styles.chartCard`, `最近 8 天`, `WarmHeader`, `cardShadow`, `<InsetGroup`).
- Test style: contract tests read source strings (`readFileSync` + `toContain`); component tests mock `react-native` with `vi.mock` and call components as plain functions; aggregate tests are pure (no mocks, fixed dates, explicit `timeZone`).
- Every task ends with `npm test --workspace @hbm/mobile` green and `npx tsc -p apps/mobile/tsconfig.json --noEmit` passing, then one commit.

**Commands used throughout:**

- Focused test: `npm test --workspace @hbm/mobile -- <path>`
- Full mobile tests: `npm test --workspace @hbm/mobile`
- Typecheck: `npx tsc -p apps/mobile/tsconfig.json --noEmit`
- Lint: `npm run lint --workspace @hbm/mobile`

---

### Task 1: `localDateKey` helper and the pure aggregation module

Land the one shared date helper `format.ts` is missing, then the whole pure layer: `src/insights/aggregates.ts` with `minutesByDay`, `dominantIntensityByDay`, `buildWeek`, `buildHeatmapWeeks`, `intensityScale`, and the exported `normalizeIntensity`, covered by a full unit suite written first.

**Files:**
- Create: `apps/mobile/src/insights/aggregates.test.ts`
- Modify: `apps/mobile/src/ui/format.ts` (one added export, nothing else touched)
- Create: `apps/mobile/src/insights/aggregates.ts`

**Interfaces:**
- Consumes: `APP_TIME_ZONE`, `currentWeekStartIso`, and the private `localDateParts` from `src/ui/format.ts`.
- Produces: `localDateKey(value: string | Date, timeZone = APP_TIME_ZONE): string` from `src/ui/format.ts` — local `YYYY-MM-DD`, `""` for unparseable input.
- Produces from `src/insights/aggregates.ts`:
  - `type TimedSession = { startedAt: string; durationMinutes: number }` — structural, so `ActivityRecord` fits directly and the page maps sleep `date` into `startedAt`.
  - `type Intensity = "easy" | "moderate" | "high"`.
  - `normalizeIntensity(raw: string): Intensity` — keyword mapping; unknown strings fall back to `moderate`.
  - `minutesByDay(records: readonly TimedSession[], timeZone = APP_TIME_ZONE): Map<string, number>`.
  - `dominantIntensityByDay(activities: ReadonlyArray<TimedSession & { intensity: string }>, timeZone = APP_TIME_ZONE): Map<string, Intensity>` — intensity of the day's longest session; ties keep the earliest longest session.
  - `buildWeek(dateKeys: readonly string[], values: ReadonlyMap<string, number>): { key: string; value: number }[]`.
  - `buildHeatmapWeeks(today = new Date(), weekCount = 12, timeZone = APP_TIME_ZONE): string[][]` — 12 ISO week columns (oldest first, current week last), 7 local date keys each, Monday → Sunday.
  - `intensityScale(minutes: number): 0 | 1 | 2 | 3 | 4` — 0 for zero, then fixed thresholds at 30/60/90 minutes.

- [ ] **Step 1: Write the failing aggregation tests**

Create `apps/mobile/src/insights/aggregates.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { localDateKey } from "../ui/format";
import {
  buildHeatmapWeeks,
  buildWeek,
  dominantIntensityByDay,
  intensityScale,
  minutesByDay,
  normalizeIntensity
} from "./aggregates";

const TIME_ZONE = "Asia/Shanghai";

function session(startedAt: string, durationMinutes: number) {
  return { startedAt, durationMinutes };
}

function activity(startedAt: string, durationMinutes: number, intensity: string) {
  return { startedAt, durationMinutes, intensity };
}

describe("localDateKey", () => {
  it("renders the local calendar day, not the UTC day", () => {
    expect(localDateKey("2026-07-27T16:30:00Z", TIME_ZONE)).toBe("2026-07-28"); // 00:30 next day in Shanghai
    expect(localDateKey("2026-07-28T15:59:59Z", TIME_ZONE)).toBe("2026-07-28");
    expect(localDateKey(new Date("2026-07-29T08:00:00+08:00"), TIME_ZONE)).toBe("2026-07-29");
  });

  it("returns an empty string for unparseable input", () => {
    expect(localDateKey("not-a-date", TIME_ZONE)).toBe("");
    expect(localDateKey("", TIME_ZONE)).toBe("");
  });
});

describe("minutesByDay", () => {
  it("sums durations per local day of startedAt", () => {
    const map = minutesByDay([
      session("2026-07-27T10:00:00Z", 30),
      session("2026-07-27T16:30:00Z", 20), // already 2026-07-28 in Shanghai
      session("2026-07-28T15:00:00Z", 45) // 23:00 on 2026-07-28 in Shanghai
    ], TIME_ZONE);

    expect(map.get("2026-07-27")).toBe(30);
    expect(map.get("2026-07-28")).toBe(65);
    expect(map.size).toBe(2);
  });

  it("returns an empty map for no records and skips unparseable starts", () => {
    expect(minutesByDay([], TIME_ZONE).size).toBe(0);
    expect(minutesByDay([session("", 30)], TIME_ZONE).size).toBe(0);
  });
});

describe("dominantIntensityByDay", () => {
  it("picks the intensity of the day's longest session", () => {
    const map = dominantIntensityByDay([
      activity("2026-07-28T01:00:00Z", 20, "轻松"),
      activity("2026-07-28T09:00:00Z", 45, "高强度")
    ], TIME_ZONE);

    expect(map.get("2026-07-28")).toBe("high");
  });

  it("keeps the earliest session when durations tie", () => {
    const map = dominantIntensityByDay([
      activity("2026-07-28T01:00:00Z", 30, "easy"),
      activity("2026-07-28T09:00:00Z", 30, "high")
    ], TIME_ZONE);

    expect(map.get("2026-07-28")).toBe("easy");
  });
});

describe("normalizeIntensity", () => {
  it("maps free-form English and Chinese strings, falling back to moderate", () => {
    expect(normalizeIntensity("easy")).toBe("easy");
    expect(normalizeIntensity("轻松跑")).toBe("easy");
    expect(normalizeIntensity("Recovery")).toBe("easy");
    expect(normalizeIntensity("低强度")).toBe("easy");
    expect(normalizeIntensity("high")).toBe("high");
    expect(normalizeIntensity("高强度间歇")).toBe("high");
    expect(normalizeIntensity("HARD")).toBe("high");
    expect(normalizeIntensity("vigorous")).toBe("high");
    expect(normalizeIntensity("中等强度")).toBe("moderate");
    expect(normalizeIntensity("moderate")).toBe("moderate");
    expect(normalizeIntensity("tempo")).toBe("moderate");
    expect(normalizeIntensity("")).toBe("moderate");
  });
});

describe("buildWeek", () => {
  it("aligns values to the given date keys in order, filling gaps with zero", () => {
    const keys = ["2026-07-27", "2026-07-28", "2026-07-29"];
    const values = new Map([["2026-07-28", 45]]);

    expect(buildWeek(keys, values)).toEqual([
      { key: "2026-07-27", value: 0 },
      { key: "2026-07-28", value: 45 },
      { key: "2026-07-29", value: 0 }
    ]);
  });
});

describe("buildHeatmapWeeks", () => {
  // 2026-07-29 is a Wednesday; its ISO week runs 2026-07-27 → 2026-08-02.
  const today = new Date("2026-07-29T08:00:00+08:00");

  it("returns weekCount columns of 7 day keys, current week last", () => {
    const weeks = buildHeatmapWeeks(today, 12, TIME_ZONE);

    expect(weeks).toHaveLength(12);
    for (const week of weeks) {
      expect(week).toHaveLength(7);
    }
    expect(weeks.at(-1)).toEqual([
      "2026-07-27",
      "2026-07-28",
      "2026-07-29",
      "2026-07-30",
      "2026-07-31",
      "2026-08-01",
      "2026-08-02"
    ]);
    expect(weeks[0][0]).toBe("2026-05-11"); // Monday, 11 weeks before 2026-07-27
  });

  it("advances every column by exactly 7 days and defaults to 12 weeks", () => {
    const weeks = buildHeatmapWeeks(today, undefined, TIME_ZONE);

    expect(weeks).toHaveLength(12);
    // Anchored on 2026-05-11 / 2026-07-27 above, both known Mondays: a
    // Monday-first grid steps each column by exactly one week.
    for (let index = 1; index < weeks.length; index += 1) {
      const prev = new Date(`${weeks[index - 1][0]}T00:00:00Z`).getTime();
      const curr = new Date(`${weeks[index][0]}T00:00:00Z`).getTime();
      expect(curr - prev).toBe(7 * 24 * 60 * 60 * 1000);
    }
  });
});

describe("intensityScale", () => {
  it("uses fixed thresholds at 30/60/90 minutes", () => {
    expect(intensityScale(0)).toBe(0);
    expect(intensityScale(1)).toBe(1);
    expect(intensityScale(29)).toBe(1);
    expect(intensityScale(30)).toBe(2);
    expect(intensityScale(59)).toBe(2);
    expect(intensityScale(60)).toBe(3);
    expect(intensityScale(89)).toBe(3);
    expect(intensityScale(90)).toBe(4);
    expect(intensityScale(240)).toBe(4);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace @hbm/mobile -- src/insights/aggregates.test.ts`

Expected: FAIL — `./aggregates` does not exist yet.

- [ ] **Step 3: Add `localDateKey` to `src/ui/format.ts`**

One edit. Replace:

```ts
function zonedMidnightToUtcIso(year: number, month: number, day: number, timeZone: string) {
```

with:

```ts
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
```

Nothing else in the file changes.

- [ ] **Step 4: Create the aggregation module**

Create `apps/mobile/src/insights/aggregates.ts`:

```ts
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
```

- [ ] **Step 5: Run the focused test to verify it passes**

Run: `npm test --workspace @hbm/mobile -- src/insights/aggregates.test.ts`

Expected: PASS — all seven `describe` blocks green.

- [ ] **Step 6: Run the full suite and typecheck**

Run: `npm test --workspace @hbm/mobile`

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit`

Expected: both exit 0.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/ui/format.ts apps/mobile/src/insights
git commit -m "feat(mobile): add pure insights aggregation helpers"
```

---

### Task 2: WeekBars and ActivityHeatmap dumb components

Land the two chart components with vi.mock-style component tests written first. `WeekBars` is the shared 7-bar chart (consumed by both 本周运动 and 本周睡眠 in Task 3); `ActivityHeatmap` renders the 12×7 grid plus the 少 → 多 legend. Both take all data via props and read colours from `useTheme`.

**Files:**
- Create: `apps/mobile/src/components/WeekBars.tsx`
- Create: `apps/mobile/src/components/WeekBars.test.tsx`
- Create: `apps/mobile/src/components/ActivityHeatmap.tsx`
- Create: `apps/mobile/src/components/ActivityHeatmap.test.tsx`

**Interfaces:**
- Consumes: `useTheme`/tokens, `spacing` from `src/theme/tokens.ts`; `Text` from `src/components/Text.tsx`; `intensityScale` and `buildHeatmapWeeks` (test fixture only) from Task 1.
- Produces: `WeekBar` = `{ key: string; label: string; value: number; tone: "fill" | "controlFill" | "tintFill" | "orange" | "red"; accessibilityLabel: string }` and `WeekBars({ bars: WeekBar[] })` — bar heights scale against the week's maximum with a `BAR_MIN_HEIGHT` placeholder for empty days; each column is one accessible unit with a per-bar label.
- Produces: `ActivityHeatmap({ weeks: string[][]; minutesByDay: ReadonlyMap<string, number>; todayKey: string })` — 84 cells keyed by date, zero-minute days in `fill`, active days in `tintFill` at 25/50/75/100% opacity by `intensityScale`, days after `todayKey` rendered with no background (card surface shows through); footer legend 少 → 多 with the same five swatches.

- [ ] **Step 1: Write the failing WeekBars tests**

Create `apps/mobile/src/components/WeekBars.test.tsx`:

```tsx
/* eslint-disable import/first -- component imports must follow Vitest module mocks */
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  StyleSheet: { create: (styles: unknown) => styles },
  useColorScheme: () => "light",
  View: "View"
}));

vi.mock("./Text", () => ({ Text: "Text" }));

import { WeekBars, type WeekBar } from "./WeekBars";

type Node = {
  type?: unknown;
  props?: {
    accessible?: boolean;
    accessibilityLabel?: string;
    style?: unknown;
    children?: unknown;
  };
};

function collect(node: unknown, predicate: (element: Node) => boolean): Node[] {
  if (Array.isArray(node)) return node.flatMap((child) => collect(child, predicate));
  if (!node || typeof node !== "object") return [];
  const element = node as Node;
  const self = predicate(element) ? [element] : [];
  return [...self, ...collect(element.props?.children, predicate)];
}

function flatten(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) return Object.assign({}, ...style.map(flatten));
  return (style ?? {}) as Record<string, unknown>;
}

const dayNames = ["一", "二", "三", "四", "五", "六", "日"];

function bars(): WeekBar[] {
  const values = [45, 0, 30, 90, 0, 0, 60];
  const tones = ["fill", "tintFill", "orange", "red", "fill", "fill", "controlFill"] as const;
  return dayNames.map((name, index) => ({
    key: `2026-07-${27 + index}`,
    label: name,
    value: values[index],
    tone: tones[index],
    accessibilityLabel: `周${name}测试`
  }));
}

function columns(tree: unknown): Node[] {
  return collect(tree, (element) => element.props?.accessible === true);
}

function barStyle(column: Node): Record<string, unknown> {
  const [bar] = collect(column.props?.children, (element) => element.type === "View");
  return flatten(bar.props?.style);
}

describe("WeekBars", () => {
  it("renders one accessible column per bar with its a11y label", () => {
    const cols = columns(WeekBars({ bars: bars() }));

    expect(cols).toHaveLength(7);
    expect(cols.map((col) => col.props?.accessibilityLabel)).toEqual([
      "周一测试",
      "周二测试",
      "周三测试",
      "周四测试",
      "周五测试",
      "周六测试",
      "周日测试"
    ]);
  });

  it("maps each tone to its theme colour", () => {
    const colours = columns(WeekBars({ bars: bars() })).map((col) => barStyle(col).backgroundColor);

    expect(colours).toEqual([
      "#E3E1D9", // fill
      "#4C9A6B", // tintFill
      "#E8823A", // orange
      "#C4534A", // red
      "#E3E1D9",
      "#E3E1D9",
      "#22221F" // controlFill
    ]);
  });

  it("scales heights against the week's maximum with a minimum placeholder", () => {
    const heights = columns(WeekBars({ bars: bars() })).map((col) => barStyle(col).height);

    expect(heights[3]).toBe(72); // 90 minutes is the week's maximum
    expect(heights[1]).toBe(6); // empty day placeholder
    expect(heights[0]).toBe(36); // 45/90 of 72
  });

  it("renders the weekday labels under the bars", () => {
    const labels = collect(WeekBars({ bars: bars() }), (element) => element.type === "Text").map(
      (text) => text.props?.children
    );

    expect(labels).toEqual(dayNames);
  });
});
```

- [ ] **Step 2: Write the failing ActivityHeatmap tests**

Create `apps/mobile/src/components/ActivityHeatmap.test.tsx`:

```tsx
/* eslint-disable import/first -- component imports must follow Vitest module mocks */
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  StyleSheet: { create: (styles: unknown) => styles },
  useColorScheme: () => "light",
  View: "View"
}));

vi.mock("./Text", () => ({ Text: "Text" }));

import { buildHeatmapWeeks } from "../insights/aggregates";
import { ActivityHeatmap } from "./ActivityHeatmap";

type Node = {
  type?: unknown;
  props?: {
    testID?: string;
    style?: unknown;
    children?: unknown;
  };
};

function collect(node: unknown, predicate: (element: Node) => boolean): Node[] {
  if (Array.isArray(node)) return node.flatMap((child) => collect(child, predicate));
  if (!node || typeof node !== "object") return [];
  const element = node as Node;
  const self = predicate(element) ? [element] : [];
  return [...self, ...collect(element.props?.children, predicate)];
}

function flatten(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) return Object.assign({}, ...style.map(flatten));
  return (style ?? {}) as Record<string, unknown>;
}

// 2026-07-29 is a Wednesday; the grid's last column is 2026-07-27 → 2026-08-02.
const TODAY = new Date("2026-07-29T08:00:00+08:00");
const TODAY_KEY = "2026-07-29";

function renderHeatmap(minutesByDay: Map<string, number>) {
  return ActivityHeatmap({
    weeks: buildHeatmapWeeks(TODAY, 12, "Asia/Shanghai"),
    minutesByDay,
    todayKey: TODAY_KEY
  });
}

function cells(tree: unknown): Record<string, unknown>[] {
  return collect(tree, (element) => element.props?.testID === "heatmap-cell").map((cell) =>
    flatten(cell.props?.style)
  );
}

describe("ActivityHeatmap", () => {
  it("renders 84 cells for the 12 weeks", () => {
    expect(cells(renderHeatmap(new Map()))).toHaveLength(84);
  });

  it("colours cells by the fixed intensity scale", () => {
    const minutes = new Map([
      ["2026-07-27", 20], // scale 1 → 25%
      ["2026-07-28", 45], // scale 2 → 50%
      ["2026-07-29", 95] // scale 4 → 100% (today is not the future)
    ]);
    const styles = cells(renderHeatmap(minutes));

    const monday = styles[77]; // last column starts at index 11 * 7
    expect(monday.backgroundColor).toBe("#4C9A6B");
    expect(monday.opacity).toBe(0.25);
    expect(styles[78].opacity).toBe(0.5);
    expect(styles[79].opacity).toBe(1);
  });

  it("renders rest days in fill at full opacity", () => {
    const styles = cells(renderHeatmap(new Map()));

    expect(styles[0].backgroundColor).toBe("#E3E1D9"); // 2026-05-11, no record
    expect(styles[0].opacity).toBe(1);
  });

  it("renders future days of the current week as background, not zero", () => {
    const styles = cells(renderHeatmap(new Map()));

    for (const index of [80, 81, 82, 83]) {
      expect(styles[index].backgroundColor).toBeUndefined();
    }
  });

  it("renders the 少 → 多 legend with the five scale swatches", () => {
    const tree = renderHeatmap(new Map());

    const swatches = collect(tree, (element) => element.props?.testID === "heatmap-swatch").map((swatch) =>
      flatten(swatch.props?.style)
    );
    expect(swatches).toHaveLength(5);
    expect(swatches[0].backgroundColor).toBe("#E3E1D9");
    expect(swatches.map((swatch) => swatch.opacity)).toEqual([1, 0.25, 0.5, 0.75, 1]);

    const labels = collect(tree, (element) => element.type === "Text").map((text) => text.props?.children);
    expect(labels).toEqual(["少", "多"]);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test --workspace @hbm/mobile -- src/components/WeekBars.test.tsx src/components/ActivityHeatmap.test.tsx`

Expected: FAIL — `./WeekBars` and `./ActivityHeatmap` do not exist yet.

- [ ] **Step 4: Create `WeekBars`**

Create `apps/mobile/src/components/WeekBars.tsx`:

```tsx
import { StyleSheet, View } from "react-native";
import { spacing, useTheme } from "../theme/tokens";
import { Text } from "./Text";

// Geometry mirrors the Today sleep card (which keeps its inline version per
// the spec's non-goals) so both weekly bar cards read identically.
const BAR_MAX_HEIGHT = 72;
const BAR_MIN_HEIGHT = 6;
const BAR_WIDTH = 18;
const BAR_RADIUS = 6;

/** Colour slots the two weekly charts need: empty/placeholder days and the
 *  latest sleep night use fill/controlFill; dominant exercise intensity maps
 *  to tintFill (轻松) / orange (中等) / red (高). */
export type WeekBarTone = "fill" | "controlFill" | "tintFill" | "orange" | "red";

export type WeekBar = {
  key: string;
  label: string;
  value: number;
  tone: WeekBarTone;
  accessibilityLabel: string;
};

/** Shared 7-bar chart for the weekly exercise and sleep cards. Dumb: values,
 *  colours and a11y labels all arrive via props. Empty days render as a short
 *  placeholder bar, so every column stays visible. */
export function WeekBars({ bars }: { bars: WeekBar[] }) {
  const { tokens } = useTheme();
  const maxValue = Math.max(...bars.map((bar) => bar.value), 1);

  return (
    <View style={styles.barRow}>
      {bars.map((bar) => (
        <View key={bar.key} accessible accessibilityLabel={bar.accessibilityLabel} style={styles.barCol}>
          <View
            style={[
              styles.bar,
              {
                backgroundColor: tokens[bar.tone],
                height: Math.max(BAR_MIN_HEIGHT, Math.round((bar.value / maxValue) * BAR_MAX_HEIGHT))
              }
            ]}
          />
          <Text size="caption2" color={tokens.labelSecondary}>
            {bar.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderRadius: BAR_RADIUS, width: BAR_WIDTH },
  barCol: { alignItems: "center", gap: 6 },
  barRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xs
  }
});
```

- [ ] **Step 5: Create `ActivityHeatmap`**

Create `apps/mobile/src/components/ActivityHeatmap.tsx`:

```tsx
import { StyleSheet, View } from "react-native";
import { intensityScale } from "../insights/aggregates";
import { spacing, useTheme } from "../theme/tokens";
import { Text } from "./Text";

const CELL_GAP = 6;

// Green steps at 25/50/75/100% over the card surface; index 0 is unused
// because rest days render in `fill` at full opacity instead.
const LEVEL_OPACITY = [1, 0.25, 0.5, 0.75, 1] as const;

/** 12-week, GitHub-contribution-style activity grid. Dumb: the page hands it
 *  the week columns from `buildHeatmapWeeks` and the minutes map; colour by
 *  the day's total minutes on the fixed `intensityScale`. Future days of the
 *  current week render with no background (they are not zero-minute days). */
export function ActivityHeatmap({
  weeks,
  minutesByDay,
  todayKey
}: {
  weeks: string[][];
  minutesByDay: ReadonlyMap<string, number>;
  todayKey: string;
}) {
  const { tokens } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {weeks.map((week) => (
          <View key={week[0]} style={styles.weekColumn}>
            {week.map((dayKey) => {
              const isFuture = dayKey > todayKey;
              const level = intensityScale(minutesByDay.get(dayKey) ?? 0);
              return (
                <View
                  key={dayKey}
                  testID="heatmap-cell"
                  style={[
                    styles.cell,
                    isFuture
                      ? null
                      : { backgroundColor: level === 0 ? tokens.fill : tokens.tintFill, opacity: LEVEL_OPACITY[level] }
                  ]}
                />
              );
            })}
          </View>
        ))}
      </View>
      <View style={styles.legend}>
        <Text size="caption2" color={tokens.labelSecondary}>
          少
        </Text>
        {([0, 1, 2, 3, 4] as const).map((level) => (
          <View
            key={level}
            testID="heatmap-swatch"
            style={[
              styles.swatch,
              { backgroundColor: level === 0 ? tokens.fill : tokens.tintFill, opacity: LEVEL_OPACITY[level] }
            ]}
          />
        ))}
        <Text size="caption2" color={tokens.labelSecondary}>
          多
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cell: { aspectRatio: 1, borderRadius: 4, width: "100%" },
  container: { gap: spacing.sm },
  grid: { flexDirection: "row", gap: CELL_GAP },
  legend: { alignItems: "center", flexDirection: "row", gap: spacing.xs, justifyContent: "flex-end" },
  swatch: { borderRadius: 3, height: 12, width: 12 },
  weekColumn: { flex: 1, gap: CELL_GAP }
});
```

- [ ] **Step 6: Run the focused tests to verify they pass**

Run: `npm test --workspace @hbm/mobile -- src/components/WeekBars.test.tsx src/components/ActivityHeatmap.test.tsx`

Expected: PASS.

- [ ] **Step 7: Run the full suite and typecheck**

Run: `npm test --workspace @hbm/mobile`

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit`

Expected: both exit 0.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/components/WeekBars.tsx apps/mobile/src/components/WeekBars.test.tsx apps/mobile/src/components/ActivityHeatmap.tsx apps/mobile/src/components/ActivityHeatmap.test.tsx
git commit -m "feat(mobile): add week bars and activity heatmap components"
```

---

### Task 3: Insights page composition and contract assertions

Rewrite `insights/index.tsx` to compose the three new cards between the unchanged 恢复趋势/恢复曲线 cards and the 分析 group, extend 分析 with the HRV and 静息心率 rows, and bump the fetch limits. The existing stat/chart/分析 code is carried over byte-identical; only the query limits and the screen body around them change. New `warmUi.test.ts` contract assertions pin the composition.

**Files:**
- Modify: `apps/mobile/src/warmUi.test.ts`
- Modify: `apps/mobile/app/(app)/(tabs)/insights/index.tsx` (full replacement)

**Interfaces:**
- Consumes: `localDateKey` + the Task-1 aggregates; `WeekBars`/`WeekBar` and `ActivityHeatmap` from Task 2; unchanged `Screen`, `Text`, `EmptyState`/`Spinner`, `TrendChart`, `InsetGroup`, `Row`, `WarmHeader`, `cardShadow`/`radius`/`spacing`/tokens; `formatDateLabel`, `formatDuration`, `numberLabel`, `APP_TIME_ZONE` from `src/ui/format.ts`.
- Produces: `useRecoveryQuery(8)`, `useSleepQuery(7)`, `useActivitiesQuery(90)`; cards in spec order: 恢复趋势, 恢复曲线, 本周运动, 本周睡眠, 运动频率, 分析 (5 rows). The 恢复趋势/恢复曲线 cards and the three existing 分析 rows behave exactly as before.

- [ ] **Step 1: Add the failing contract tests**

Append to the `describe` block in `apps/mobile/src/warmUi.test.ts`:

```ts
  it("builds the Insights visualisation cards from the shared charts", () => {
    const source = read("../app/(app)/(tabs)/insights/index.tsx");

    expect(source).toContain("本周运动");
    expect(source).toContain("本周睡眠");
    expect(source).toContain("运动频率");
    expect(source).toContain("useActivitiesQuery(90)");
    expect(source).toContain("useSleepQuery(7)");
    expect(source).toContain("useRecoveryQuery(8)");
    expect(source).toContain("WeekBars");
    expect(source).toContain("ActivityHeatmap");
    expect(source).toContain("buildHeatmapWeeks");
    expect(source).toContain("buildWeek");
    expect(source).toContain("minutesByDay");
    expect(source).toContain("dominantIntensityByDay");
  });

  it("extends the Insights analysis group with HRV and resting heart rate", () => {
    const source = read("../app/(app)/(tabs)/insights/index.tsx");

    expect(source).toContain("HRV");
    expect(source).toContain("静息心率");
    expect(source).toContain("hrvMs");
    expect(source).toContain("restingHeartRateBpm");
    expect(source).toContain("HeartPulse");
  });

  it("ships the visualisation components as dumb charts", () => {
    const weekBars = read("./components/WeekBars.tsx");

    expect(weekBars).toContain("export function WeekBars");
    expect(weekBars).toContain("accessible");
    expect(weekBars).not.toContain("useActivitiesQuery");
    expect(weekBars).not.toContain("useSleepQuery");

    const heatmap = read("./components/ActivityHeatmap.tsx");

    expect(heatmap).toContain("export function ActivityHeatmap");
    expect(heatmap).toContain("intensityScale");
    expect(heatmap).toContain("少");
    expect(heatmap).toContain("多");
    expect(heatmap).not.toContain("useActivitiesQuery");
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --workspace @hbm/mobile -- src/warmUi.test.ts`

Expected: FAIL — the first two tests fail on `本周运动` and `HRV` (the page does not reference them yet). The third test (`ships the visualisation components as dumb charts`) already passes because Task 2 landed both components; it exists to pin the dumb-component contract against future edits.

- [ ] **Step 3: Rewrite the Insights screen**

Replace the whole of `apps/mobile/app/(app)/(tabs)/insights/index.tsx`:

```tsx
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Activity, Dumbbell, Footprints, Heart, HeartPulse, Moon } from "lucide-react-native";
import { Screen } from "../../../../src/components/Screen";
import { Text } from "../../../../src/components/Text";
import { EmptyState, Spinner } from "../../../../src/components/States";
import { TrendChart } from "../../../../src/components/QuietHealth";
import { InsetGroup } from "../../../../src/components/InsetGroup";
import { Row } from "../../../../src/components/Row";
import { WarmHeader } from "../../../../src/components/WarmHeader";
import { WeekBars, type WeekBar } from "../../../../src/components/WeekBars";
import { ActivityHeatmap } from "../../../../src/components/ActivityHeatmap";
import { useActivitiesQuery, useRecoveryQuery, useSleepQuery } from "../../../../src/api/hooks";
import {
  buildHeatmapWeeks,
  buildWeek,
  dominantIntensityByDay,
  minutesByDay,
  type Intensity
} from "../../../../src/insights/aggregates";
import { APP_TIME_ZONE, formatDateLabel, formatDuration, localDateKey, numberLabel } from "../../../../src/ui/format";
import { cardShadow, radius, spacing, useTheme } from "../../../../src/theme/tokens";

const HEATMAP_WEEKS = 12;

const weekDayNames = ["一", "二", "三", "四", "五", "六", "日"];

// Dominant-intensity colours for the exercise bars: 轻松 / 中等 / 高.
const intensityTone: Record<Intensity, WeekBar["tone"]> = {
  easy: "tintFill",
  moderate: "orange",
  high: "red"
};

// VoiceOver duration for sleep bars, e.g. 8 小时 35 分 (the Today card's
// sleepBarLabel uses the same wording).
function chineseDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours} 小时 ${rest} 分` : `${hours} 小时`;
}

export default function InsightsTab() {
  const recovery = useRecoveryQuery(8);
  const sleep = useSleepQuery(7);
  const activities = useActivitiesQuery(90);
  const { tokens, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const shadow = cardShadow(isDark ? "dark" : "light");
  const recoveryValues = [...(recovery.data ?? [])].reverse().map((item) => item.recoveryPercent ?? 0);
  const latestRecovery = recoveryValues.at(-1) ?? 0;
  const earliestRecovery = recoveryValues[0] ?? latestRecovery;
  const recoveryDelta = latestRecovery - earliestRecovery;
  const averageSleep = sleep.data?.length ? Math.round(sleep.data.reduce((sum, item) => sum + item.durationMinutes, 0) / sleep.data.length) : null;
  const averageLoad = activities.data?.length ? Math.round(activities.data.reduce((sum, item) => sum + (item.trainingLoad ?? 0), 0) / activities.data.length) : null;
  const latestRecoveryRecord = recovery.data?.[0];
  const isLoading = recovery.isLoading || sleep.isLoading || activities.isLoading;
  const hasError = recovery.error || sleep.error || activities.error;

  // Week-aligned aggregations for the visualisation cards. The heatmap grid's
  // last column doubles as the current week's date keys (Mon–Sun).
  const activityList = activities.data ?? [];
  const weeks = buildHeatmapWeeks(new Date(), HEATMAP_WEEKS, APP_TIME_ZONE);
  const weekKeys = weeks.at(-1) ?? [];
  const weekKeySet = new Set(weekKeys);
  const heatmapKeySet = new Set(weeks.flat());
  const todayKey = localDateKey(new Date(), APP_TIME_ZONE);
  const activityMinutes = minutesByDay(activityList, APP_TIME_ZONE);
  const intensityByDay = dominantIntensityByDay(activityList, APP_TIME_ZONE);

  const exerciseWeek = buildWeek(weekKeys, activityMinutes);
  const exerciseSessions = activityList.filter((item) => weekKeySet.has(localDateKey(item.startedAt, APP_TIME_ZONE))).length;
  const heatmapSessions = activityList.filter((item) => heatmapKeySet.has(localDateKey(item.startedAt, APP_TIME_ZONE))).length;
  const exerciseTotal = exerciseWeek.reduce((sum, day) => sum + day.value, 0);
  const exerciseBars: WeekBar[] = exerciseWeek.map((day, index) => {
    const intensity = intensityByDay.get(day.key);
    return {
      key: day.key,
      label: weekDayNames[index],
      value: day.value,
      tone: day.value > 0 && intensity ? intensityTone[intensity] : "fill",
      accessibilityLabel: day.value > 0
        ? `周${weekDayNames[index]}运动 ${day.value} 分钟`
        : `周${weekDayNames[index]}无运动`
    };
  });

  // Sleep records carry a `date` instead of `startedAt`; mapping it into the
  // TimedSession shape reuses the same local-day bucketing.
  const sleepMinutes = minutesByDay(
    (sleep.data ?? []).map((record) => ({ startedAt: record.date, durationMinutes: record.durationMinutes })),
    APP_TIME_ZONE
  );
  const sleepWeek = buildWeek(weekKeys, sleepMinutes);
  const recordedNights = sleepWeek.filter((day) => day.value > 0);
  const weekAverageSleep = recordedNights.length
    ? Math.round(recordedNights.reduce((sum, day) => sum + day.value, 0) / recordedNights.length)
    : null;
  const qualityScores = (sleep.data ?? []).flatMap((record) =>
    record.qualityScore !== null && weekKeySet.has(localDateKey(record.date, APP_TIME_ZONE)) ? [record.qualityScore] : []
  );
  const averageQuality = qualityScores.length
    ? Math.round(qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length)
    : null;
  const latestSleepKey = recordedNights.at(-1)?.key;
  const sleepBars: WeekBar[] = sleepWeek.map((day, index) => ({
    key: day.key,
    label: weekDayNames[index],
    value: day.value,
    tone: day.key === latestSleepKey ? "controlFill" : "fill",
    accessibilityLabel: day.value > 0
      ? `周${weekDayNames[index]}睡眠 ${chineseDuration(day.value)}`
      : `周${weekDayNames[index]}无睡眠记录`
  }));

  return (
    <Screen contentContainerStyle={{ paddingTop: insets.top + spacing.lg }}>
      {/* In-page header: the native header is hidden for this tab, so the
          safe-area top inset is applied manually via contentContainerStyle. */}
      <WarmHeader overline="最近 8 天" title="数据" />

      {isLoading ? <Spinner /> : hasError ? (
        <EmptyState title="数据加载失败" description="请确认登录状态和后端服务。" />
      ) : (
        <>
          <View style={[styles.statCard, { backgroundColor: tokens.surface }, shadow]}>
            <Text size="footnote" color={tokens.labelSecondary}>恢复趋势 · 最近 4 周</Text>
            <Text size="metric" color={tokens.label} tabularNums>
              {recoveryDelta >= 0 ? "+" : ""}{recoveryDelta}%
            </Text>
            <Text size="subheadline" color={recoveryDelta >= 0 ? tokens.tint : tokens.red}>
              {recoveryDelta >= 0 ? "恢复状态正在上升" : "恢复状态需要关注"}
            </Text>
          </View>

          <View style={[styles.chartCard, { backgroundColor: tokens.surface }, shadow]}>
            {recoveryValues.length ? <TrendChart values={recoveryValues} /> : (
              <EmptyState title="暂无恢复趋势" description="同步 COROS 后会显示趋势。" />
            )}
            {recovery.data?.length ? (
              <View style={styles.chartLabels}>
                <Text size="caption" color={tokens.labelSecondary}>{formatDateLabel(recovery.data.at(-1)?.date ?? "")}</Text>
                <Text size="caption" color={tokens.labelSecondary}>现在 · {latestRecovery}%</Text>
              </View>
            ) : null}
          </View>

          {/* 本周运动: bar height = total minutes, colour = dominant intensity. */}
          <View style={[styles.card, { backgroundColor: tokens.surface }, shadow]}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <View style={[styles.iconTile, { backgroundColor: tokens.fill }]}>
                  <Footprints color={tokens.orange} size={16} strokeWidth={1.8} />
                </View>
                <Text size="callout" weight="semibold">
                  本周运动
                </Text>
              </View>
              <Text size="footnote" color={tokens.labelSecondary}>
                {`本周 ${exerciseSessions} 次 · 共 ${formatDuration(exerciseTotal)}`}
              </Text>
            </View>
            <WeekBars bars={exerciseBars} />
          </View>

          {/* 本周睡眠: latest recorded night highlighted in controlFill. */}
          <View style={[styles.card, { backgroundColor: tokens.surface }, shadow]}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <View style={[styles.iconTile, { backgroundColor: tokens.fill }]}>
                  <Moon color={tokens.label} size={16} strokeWidth={1.8} />
                </View>
                <Text size="callout" weight="semibold">
                  本周睡眠
                </Text>
              </View>
              <Text size="footnote" color={tokens.labelSecondary}>
                {weekAverageSleep === null
                  ? "暂无记录"
                  : `平均 ${formatDuration(weekAverageSleep)}${averageQuality === null ? "" : ` · 质量均分 ${averageQuality}`}`}
              </Text>
            </View>
            <WeekBars bars={sleepBars} />
          </View>

          {/* 运动频率: 12-week GitHub-style heatmap on the fixed scale. */}
          <View style={[styles.card, { backgroundColor: tokens.surface }, shadow]}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <View style={[styles.iconTile, { backgroundColor: tokens.fill }]}>
                  <Activity color={tokens.tint} size={16} strokeWidth={1.8} />
                </View>
                <Text size="callout" weight="semibold">
                  运动频率
                </Text>
              </View>
              <Text size="footnote" color={tokens.labelSecondary}>
                {`近 ${HEATMAP_WEEKS} 周 · ${heatmapSessions} 次`}
              </Text>
            </View>
            <ActivityHeatmap weeks={weeks} minutesByDay={activityMinutes} todayKey={todayKey} />
          </View>

          <InsetGroup header="分析" insetSeparators>
            <Row
              icon={<Moon color={tokens.tint} size={20} strokeWidth={1.8} />}
              title="平均睡眠"
              subtitle={sleep.data?.[0]?.qualityScore ? `最近质量评分 ${sleep.data[0].qualityScore}` : "持续同步可获得更准趋势"}
              value={formatDuration(averageSleep)}
            />
            <Row
              icon={<Dumbbell color={tokens.tint} size={20} strokeWidth={1.8} />}
              title="训练负荷"
              subtitle={`${activities.data?.length ?? 0} 次最近活动`}
              value={averageLoad === null ? "—" : averageLoad < 40 ? "偏轻" : averageLoad > 90 ? "偏高" : "平衡"}
            />
            <Row
              icon={<Activity color={tokens.tint} size={20} strokeWidth={1.8} />}
              title="最近活动"
              subtitle={activities.data?.[0] ? `${formatDateLabel(activities.data[0].startedAt)} · ${formatDuration(activities.data[0].durationMinutes)}` : "暂无记录"}
              value={activities.data?.[0] ? numberLabel(activities.data[0].averageHeartRateBpm, " bpm") : "—"}
            />
            <Row
              icon={<HeartPulse color={tokens.tint} size={20} strokeWidth={1.8} />}
              title="HRV"
              subtitle={latestRecoveryRecord ? formatDateLabel(latestRecoveryRecord.date) : "暂无记录"}
              value={latestRecoveryRecord?.hrvMs == null ? "—" : `${Math.round(latestRecoveryRecord.hrvMs)} ms`}
            />
            <Row
              icon={<Heart color={tokens.tint} size={20} strokeWidth={1.8} />}
              title="静息心率"
              subtitle={latestRecoveryRecord ? formatDateLabel(latestRecoveryRecord.date) : "暂无记录"}
              value={latestRecoveryRecord?.restingHeartRateBpm == null ? "—" : `${latestRecoveryRecord.restingHeartRateBpm} bpm`}
            />
          </InsetGroup>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, gap: 14, marginHorizontal: 20, padding: 18 },
  cardHeaderLeft: { alignItems: "center", flexDirection: "row", gap: 10 },
  cardHeaderRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  chartCard: {
    borderRadius: radius.card,
    gap: spacing.sm,
    marginHorizontal: 20,
    padding: 18
  },
  chartLabels: { flexDirection: "row", justifyContent: "space-between" },
  iconTile: {
    alignItems: "center",
    borderRadius: 10,
    height: 32,
    justifyContent: "center",
    width: 32
  },
  statCard: {
    borderRadius: radius.card,
    gap: spacing.xs,
    marginHorizontal: 20,
    padding: 18
  }
});
```

The card header pattern (icon tile + `callout`/`semibold` title + footnote meta) and the `card`/`iconTile` style metrics are copied from the Today sleep card so the new cards are visually indistinguishable from it; `Screen` already provides `gap: spacing.xl` between cards, so no extra vertical margins are added. The 最近活动 row keeps using `Activity`; the heatmap card reuses the same glyph — consistent with the spec staying silent on icons.

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `npm test --workspace @hbm/mobile -- src/warmUi.test.ts src/insights/aggregates.test.ts src/components/WeekBars.test.tsx src/components/ActivityHeatmap.test.tsx`

Expected: PASS — including the pre-existing `hides the native header and builds Insights from warm cards` test, whose assertions (`最近 8 天`, `styles.statCard`, `styles.chartCard`, `WarmHeader`, `cardShadow`, `<InsetGroup`) all survive the rewrite.

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npm test --workspace @hbm/mobile`

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit`

Expected: both exit 0.

- [ ] **Step 6: Lint**

Run: `npm run lint --workspace @hbm/mobile`

Expected: exit 0 — in particular no unused imports in the rewritten screen (`Heart`, `HeartPulse`, `Footprints`, `localDateKey`, `APP_TIME_ZONE` are all consumed) and no import-order complaints in the new test files (the `/* eslint-disable import/first */` header matches the existing component-test convention).

- [ ] **Step 7: Repo-root suite**

Run: `npm test`

Expected: exit 0 — the backend and web suites are untouched by this plan.

- [ ] **Step 8: Verify on the simulator**

Run: `npm run ios --workspace @hbm/mobile`

Check: the 数据 tab shows, top to bottom, 恢复趋势 → 恢复曲线 → 本周运动 → 本周睡眠 → 运动频率 → 分析 (5 rows). 本周运动 bars colour-code by intensity (轻松 green / 中等 orange / 高 red) with short `fill` placeholders on rest days; the meta reads 本周 N 次 · 共 Xh Ym. 本周睡眠 highlights the latest recorded night in `controlFill`; the meta reads 平均 Xh Ym · 质量均分 NN (quality clause hidden when no scores). The heatmap shows 12 columns × 7 rows with the current week rightmost, future days this week blending into the card background (not `fill`), and the 少 → 多 legend bottom-right. VoiceOver reads each sleep bar as 周X睡眠 N 小时 M 分 and each exercise bar as 周X运动 N 分钟 / 周X无运动. Toggle dark mode: heatmap greens and the legend stay legible on the dark `surface`. Set the largest Dynamic Type: card metas wrap or truncate gracefully, bars do not overflow the card.

- [ ] **Step 9: Commit**

```bash
git add "apps/mobile/app/(app)/(tabs)/insights/index.tsx" apps/mobile/src/warmUi.test.ts
git commit -m "feat(mobile): compose the insights visualisation cards"
```

---

## Self-Review

**Spec coverage.** Every spec bullet maps to a task. Layout items 1–2 (恢复趋势卡 / 恢复曲线卡 unchanged) → Task 3 carries them over byte-identical, pinned by the pre-existing warmUi test staying green. Layout item 3 (本周运动卡: header + meta `本周 N 次 · 共 Xh Ym`, seven bars Mon–Sun, minutes as height, dominant-intensity colours 轻松 `tintFill` / 中等 `orange` / 高 `red`, empty days as short `fill` placeholders) → Task 2 (`WeekBars` with tone map + min-height placeholder) and Task 3 (`intensityTone`, `exerciseBars`, `exerciseSessions`/`exerciseTotal` meta). Layout item 4 (本周睡眠卡: meta `平均 Xh Ym · 质量均分 NN`, latest day `controlFill`, others `fill`, per-bar a11y label `周二睡眠 8 小时 35 分`) → Task 3 (`sleepBars`, `latestSleepKey`, `chineseDuration`, `averageQuality`). Layout item 5 (运动频率热力图卡: meta `近 12 周 · N 次`, 7 rows Mon→Sun × 12 columns oldest→current, four green steps on `tintFill` at 25/50/75/100% alpha, zero = `fill`, legend 少 → 多 with five swatches, future days as background not zero) → Task 1 (`buildHeatmapWeeks`, `intensityScale`) and Task 2 (`ActivityHeatmap` with `LEVEL_OPACITY`, future-day transparency, legend) and Task 3 (`heatmapSessions` meta). Layout item 6 (分析 extended with HRV and 静息心率 rows, `—` when null) → Task 3 (two new `Row`s with `HeartPulse`/`Heart`). Aggregation logic (all five functions with the spec's exact semantics) → Task 1. Components section (`WeekBars` shared by both weekly cards; `ActivityHeatmap` props = weeks + minutes map; charts dumb, page composes) → Tasks 2–3; the Today inline version is untouched per the spec note. Tests section (real unit tests for bucketing / tie-breaking / grid shape / scale thresholds / Chinese mapping; vi.mock component tests asserting 7 bars with colours and a11y labels, 84 cells + legend with scale colours; warmUi additions for the three cards, the two rows, and `useActivitiesQuery(90)`; existing suites green) → Tasks 1–3 plus Task 3 Steps 5–7. Non-goals (no backend changes, no interactions, no Today changes) → Global Constraints.

**Placeholder scan.** Every code step carries complete pasteable content: full files for `aggregates.test.ts`, `aggregates.ts`, `WeekBars.tsx`, `WeekBars.test.tsx`, `ActivityHeatmap.tsx`, `ActivityHeatmap.test.tsx`, the rewritten `insights/index.tsx`, and the three appended warmUi tests; the single `format.ts` change is an exact before/after block anchored on `function zonedMidnightToUtcIso(`. No TBDs, no "similar to above".

**Type consistency.** `localDateKey` is defined in Task 1 before Task 2's test fixture imports `buildHeatmapWeeks` (which internally calls it) and before Task 3's page imports it. `TimedSession` is structural: `ActivityRecord` (`startedAt: string`, `durationMinutes: number`) satisfies `ReadonlyArray<TimedSession & { intensity: string }>` directly; the page maps sleep records into `{ startedAt: record.date, durationMinutes }` so `minutesByDay` never special-cases sleep. `normalizeIntensity` is exported beyond the spec's list — it is the unit under test for the string mapping and is what `dominantIntensityByDay` calls; no second mapper exists. `WeekBar["tone"]` is a strict subset of `keyof ThemeTokens`, so `tokens[bar.tone]` typechecks; `intensityTone: Record<Intensity, WeekBar["tone"]>` covers all three intensity values. `LEVEL_OPACITY` is a 5-tuple indexed by `intensityScale`'s `0 | 1 | 2 | 3 | 4`; index 0 is defined (1) so rest-day cells and the first legend swatch share the same code path as active cells. `weekDayNames[index]` over 7-element `buildWeek` output is safe under `strict` (no `noUncheckedIndexedAccess` in this tsconfig) and matches the existing `weekNames.map(...)` pattern in the Plan screen. The quality-score filter uses `flatMap` with a `!== null` guard so no `as number` cast is needed. `latestRecoveryRecord?.hrvMs == null` uses loose equality deliberately to catch both `null` and `undefined`. One documented refinement over the spec letter: the spec's keyword list maps any string containing 强度 to high, which would mislabel 低强度 and 中等强度; `normalizeIntensity` checks 低/中等 keywords first (both still fall within the spec's "best-effort, unknown → moderate" rule), and the unit tests pin 低强度 → easy, 中等强度 → moderate, 高强度 → high. One documented derivation: 质量均分 NN is omitted entirely (not rendered as `—`) when the week has no quality scores, matching the 平均-only fallback wording 暂无记录.

## Risks

- **Intensity strings are free-form** (English from HealthKit, possibly Chinese from other sources) — the keyword mapping is best-effort; unknown strings fall back to moderate and the 低/中等-first ordering is pinned by tests but cannot cover every vendor string. Worst case a bar shows the "wrong" colour; minutes (the bar height) are always correct.
- **90-record activity fetch** — the payload is small; if the backend caps `limit` below 90, the heatmap degrades gracefully (fewer coloured cells, lower 次 counts) and no code path divides by the fetched count.
- **Time zones** — all bucketing goes through `localDateKey` with `APP_TIME_ZONE`; the unit suite proves Shanghai bucketing on fixed UTC timestamps so a UTC regression fails CI. Date-only sleep `date` values parse as UTC midnight, which lands on the same Shanghai calendar day (Asia/Shanghai is UTC+8, no DST) — noted in the page comment.
- **`new Date()` at render time** — the heatmap and week cards compute "today" during render; a screen left open across midnight shows stale alignment until re-render. Acceptable for a tab screen (every tab switch re-renders); no timer is added.
- **Heatmap opacity steps over `surface`** — the 25% step can be subtle in dark mode (`tintFill` dark `#5FA97E` at 0.25 over `#252421`); the Task 3 dark-mode simulator check is its acceptance gate.
- **`formatDuration` in metas** — 本周运动 shows `共 0m` for an exercise-free week rather than hiding the card; consistent with the placeholder-bar design (empty weeks still render the grid), flagged here so it is not "fixed" later without a design decision.
