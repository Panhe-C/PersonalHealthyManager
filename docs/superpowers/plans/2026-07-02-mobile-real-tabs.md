# Mobile Real Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace placeholder iOS tab screens with real-data mobile views backed by the existing v1 APIs.

**Architecture:** Keep the Expo app scaffold intact. Add typed React Query hooks over the existing `@hbm/contracts` schemas, add a small mobile formatting/display helper layer, and update each tab screen to render real cards with empty/loading/error states.

**Tech Stack:** Expo Router, React Native, React Query, Zod contracts from `packages/contracts`, Vitest for helper and API client tests.

---

### Task 1: Typed Mobile API Hooks

**Files:**
- Modify: `apps/mobile/src/api/hooks.ts`
- Test: `apps/mobile/src/api/client.test.ts`

- [ ] Add hooks for `/today`, `/plan/active`, `/goals`, `/insights/activities`, `/insights/sleep`, `/insights/recovery`, and `/agent/conversations`.
- [ ] Use existing schemas from `@hbm/contracts` so the mobile UI does not consume unknown payloads.
- [ ] Keep query keys stable and include limits for insight endpoints.
- [ ] Run `npm test --workspace apps/mobile`.

### Task 2: Mobile Display Helpers

**Files:**
- Create: `apps/mobile/src/ui/format.ts`
- Test: `apps/mobile/src/ui/format.test.ts`

- [ ] Add pure helpers for minutes-to-hours, date labels, task time labels, JSON parsing fallbacks, and metric display.
- [ ] Write Vitest coverage for sleep duration and JSON fallback behavior.
- [ ] Run `npm test --workspace apps/mobile`.

### Task 3: Shared Mobile UI Primitives

**Files:**
- Create: `apps/mobile/src/components/MetricTile.tsx`
- Create: `apps/mobile/src/components/Section.tsx`
- Modify: `apps/mobile/src/components/Card.tsx`
- Modify: `apps/mobile/src/components/Screen.tsx`

- [ ] Make `Screen` scrollable by default so tab content is not clipped on iPhone.
- [ ] Add compact section and metric tile primitives using the current token system.
- [ ] Preserve the existing `Card` API.

### Task 4: Real Tab Screens

**Files:**
- Modify: `apps/mobile/app/(app)/(tabs)/today.tsx`
- Modify: `apps/mobile/app/(app)/(tabs)/plan.tsx`
- Modify: `apps/mobile/app/(app)/(tabs)/insights.tsx`
- Modify: `apps/mobile/app/(app)/(tabs)/coach.tsx`
- Modify: `apps/mobile/app/(app)/(tabs)/settings.tsx`

- [ ] Today: show recovery, sleep, primary goal, today's tasks, and active plan status.
- [ ] Plan: show week summary, training task cards, checklist preview, and nutrition guidance parsed from `nutritionTargetsJson`.
- [ ] Insights: show latest recovery/sleep/activity cards and source labels.
- [ ] Coach: show recent conversations plus suggested prompts when there are none.
- [ ] Settings: show signed-in demo context, active goals, data source status, and logout.

### Task 5: Verification

**Files:**
- No production files.

- [ ] Run `npm test --workspace apps/mobile`.
- [ ] Run root `npm test -- --run tests/api/authLogin.test.ts tests/api/v1TodayPlan.test.ts tests/api/insights.test.ts`.
- [ ] Ensure backend and Metro are still running.
- [ ] Refresh the iOS app and capture screenshots of at least the Today and Plan tabs.
