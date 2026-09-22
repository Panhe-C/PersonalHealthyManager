# Insights Tab Data Visualisation Design

**Status:** approved direction, pending implementation plan
**Date:** 2026-07-29
**Builds on:** warm card redesign phase 1+2 (tokens, `cardShadow`, `WarmHeader`, warm Insights root).

## Context

The Insights tab currently shows only a recovery stat card, one trend chart, and three analysis rows — too little for a health app. The user asked for last-week exercise and sleep visualisations, a GitHub-style activity-frequency heatmap, and more charts. Approved decisions: **12-week heatmap** (7 rows × 12 columns, GitHub contribution style) and **weekly exercise bars measured in minutes, coloured by the day's dominant intensity**.

## Non-goals

- Backend changes — everything uses the existing `/insights/*` endpoints with larger `limit`s.
- Interactions (tap a bar/cell for details) — static charts only in this iteration.
- Changing the Today tab's sleep card (it stays as-is).

## Data

Existing hooks with bigger limits: `useActivitiesQuery(90)`, `useSleepQuery(7)`, `useRecoveryQuery(8)`. Record shapes (`src/api/schemas.ts`): activities have `startedAt`, `durationMinutes`, `intensity`, `trainingLoad`, `averageHeartRateBpm`; sleep has `date`, `durationMinutes`, `qualityScore`; recovery has `date`, `recoveryPercent`, `hrvMs`, `restingHeartRateBpm`.

## Layout (top → bottom, all warm cards, 20pt margin, `cardShadow`)

1. **恢复趋势卡** (unchanged) — metric value ±Δ% + status sentence.
2. **恢复曲线卡** (unchanged) — existing `TrendChart`.
3. **本周运动卡** (new) — header `本周运动` + meta `本周 N 次 · 共 Xh Ym`. Seven bars (周一~周日): height = total minutes that day (empty day = short `fill` placeholder bar), colour by dominant intensity: 轻松 `tintFill`, 中等 `orange`, 高 `red`. Dominant = intensity of the day's longest session.
4. **本周睡眠卡** (new) — header `本周睡眠` + meta `平均 Xh Ym · 质量均分 NN`. Seven bars by `durationMinutes`, latest day `controlFill`, others `fill`; per-bar `accessibilityLabel` (`周二睡眠 8 小时 35 分`).
5. **运动频率热力图卡** (new) — header `运动频率` + meta `近 12 周 · N 次`. Grid: 7 rows (周一 top → 周日 bottom) × 12 columns (oldest week left → current week right). Cell colour by that day's total exercise minutes, four green steps on `tintFill` at 25/50/75/100% alpha; zero minutes = `fill`. Footer legend `少 → 多` with the five swatches. Current week may be partial (future days render as background, not zero).
6. **分析** (InsetGroup, extended) — existing 平均睡眠 / 训练负荷 / 最近活动 rows, plus **HRV** and **静息心率** rows from the latest recovery record (value `—` when null).

## Aggregation logic (`apps/mobile/src/insights/aggregates.ts`, new, pure)

Unit-tested pure functions, no RN imports:

- `minutesByDay(activities, timeZone): Map<isoDate, number>` — bucket by local day of `startedAt`.
- `dominantIntensityByDay(activities, timeZone): Map<isoDate, "easy" | "moderate" | "high">` — intensity of the day's longest session. Map the free-form `intensity` strings: easy/轻松/recovery → easy, high/强度/hard/vigorous → high, else moderate.
- `buildWeek(dateKeys, values)` — aligns the current ISO week (Mon–Sun) to values.
- `buildHeatmapWeeks(today, weekCount = 12)` — returns the 12 ISO week columns with 7 date keys each, so the page only maps values.
- `intensityScale(minutes): 0 | 1 | 2 | 3 | 4` — 0 for zero, else quartiles at 30/60/90 minutes (fixed thresholds, not data-driven, so colours are stable day to day).
- Reuse the app's `APP_TIME_ZONE` / date helpers where they already exist (`src/ui/format.ts` or wherever `weekdayLabel` lives — follow the existing convention).

## Components

- `apps/mobile/src/components/WeekBars.tsx` — shared 7-bar chart (values, colours, labels, per-bar a11y label). Used by both 本周运动 and 本周睡眠. (Today's sleep card keeps its inline version; no cross-tab refactor.)
- `apps/mobile/src/components/ActivityHeatmap.tsx` — the 12-week grid + legend, props: `weeks` (from `buildHeatmapWeeks`) + `minutesByDay` map.
- Insights page composes the cards; chart components stay dumb.

## Tests

- `aggregates.test.ts`: real unit tests — day bucketing across DST-free fixed dates, dominant intensity tie-breaking, 12-week grid shape (12×7, current week last, Monday-first), intensity scale thresholds, Chinese intensity string mapping.
- Component tests (vi.mock style): `WeekBars` renders 7 bars with the dominant-intensity colours and a11y labels; `ActivityHeatmap` renders 84 cells + legend and colours cells by scale.
- `warmUi.test.ts` contract additions: insights page contains 本周运动/本周睡眠/运动频率 cards and the two new analysis rows; `useActivitiesQuery(90)`.
- Existing suites stay green; `npm test --workspace @hbm/mobile`, `tsc`, lint, repo-root `npm test` all exit 0 per task.

## Risks

- **Intensity strings are free-form** (English from HealthKit, possibly Chinese from other sources) — the mapping above is a best-effort; unknown strings fall back to moderate, noted in code.
- **90-record activity fetch** — payload is small (no messages), fine; if the backend caps `limit`, the heatmap degrades gracefully (fewer coloured cells).
- **Time zones** — day bucketing must use the app's `APP_TIME_ZONE`, not UTC, or bars shift a day.
