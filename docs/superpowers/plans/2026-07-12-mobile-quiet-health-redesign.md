# Mobile Quiet Health Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle all five Expo mobile tabs to match the approved Quiet Health OS demos while preserving their existing data and actions.

**Architecture:** Put the palette, type scale, spacing, and reusable editorial primitives in the mobile design-system layer. Keep query/mutation ownership inside each route, but replace card grids with screen-specific compositions built from hairline lists, metric strips, restrained actions, and purpose-built chart/ring primitives.

**Tech Stack:** Expo Router, React Native 0.76, TypeScript, lucide-react-native, react-native-svg, Vitest.

## Global Constraints

- Preserve all existing API queries, mutations, conversation management, and authentication actions.
- Keep the app Chinese-first even though the approved visual demos use English labels.
- Use the approved palette: warm ivory `#F6F4EE`, forest ink `#17231D`, muted sage `#718579`, terracotta `#C87958`.
- Use no gradients, glassmorphism, dashboard card mosaics, or decorative shadows.
- Keep exactly five tabs in this order: 今日、计划、教练、数据、我的.
- Do not add a new runtime dependency; `react-native-svg` and `lucide-react-native` already exist.

---

### Task 1: Lock the visual contract

**Files:**
- Create: `apps/mobile/src/quietHealthUi.test.ts`
- Modify: `apps/mobile/src/theme/tokens.ts`

**Interfaces:**
- Produces: Quiet Health token values and stable page-level style markers used by the contract test.

- [ ] **Step 1: Write the failing test**

Add a source-level test that asserts the four palette values, headerless tab configuration, tab order, and one distinctive layout marker per page (`readinessRing`, `weekStrip`, `composerBar`, `trendChart`, `settingsList`).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --workspace @hbm/mobile -- src/quietHealthUi.test.ts`

Expected: FAIL because the current tokens and layout markers still represent the card-heavy design.

- [ ] **Step 3: Update the tokens**

Set the light palette to the approved values, expand the type scale with `hero` and `metric`, reduce radii, and retain dark-token compatibility for system dark mode.

- [ ] **Step 4: Run the focused test**

Run the same test. Expected: token assertions pass while page markers continue to fail until Tasks 2–4.

### Task 2: Shared navigation and editorial primitives

**Files:**
- Modify: `apps/mobile/app/(app)/(tabs)/_layout.tsx`
- Modify: `apps/mobile/src/components/Screen.tsx`
- Modify: `apps/mobile/src/components/Text.tsx`
- Modify: `apps/mobile/src/components/Button.tsx`
- Create: `apps/mobile/src/components/QuietHealth.tsx`

**Interfaces:**
- Produces: `PageHeader`, `HairlineRow`, `MetricStrip`, `ReadinessRing`, and `TrendChart`.

- [ ] **Step 1: Implement headerless native tabs**

Configure `headerShown: false`, a warm background, 1px top rule, 64px tab bar, and the approved order: today, plan, coach, insights, settings.

- [ ] **Step 2: Implement shared primitives**

Use React Native views and `react-native-svg` for the ring/chart. Each primitive owns one visual responsibility and accepts text/data through explicit props.

- [ ] **Step 3: Run TypeScript**

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit`

Expected: PASS.

### Task 3: Restyle Today, Plan, and Insights

**Files:**
- Modify: `apps/mobile/app/(app)/(tabs)/today.tsx`
- Modify: `apps/mobile/app/(app)/(tabs)/plan.tsx`
- Modify: `apps/mobile/app/(app)/(tabs)/insights.tsx`

**Interfaces:**
- Consumes: shared Quiet Health primitives from Task 2.

- [ ] **Step 1: Restyle Today**

Lead with a computed readiness ring, display recovery/sleep/activity in a hairline metric strip, render the first training task as the focus, and retain checklist completion controls.

- [ ] **Step 2: Restyle Plan**

Use a seven-day strip, a typography-led primary session, a three-stage training timeline, and hairline training/nutrition rows. Keep generation/refresh intact as a restrained action.

- [ ] **Step 3: Restyle Insights**

Compute trend copy from recovery records, render a thin SVG recovery line, and show sleep/load as analytical rows instead of tiles/cards.

- [ ] **Step 4: Run focused visual test and TypeScript**

Run both commands from Tasks 1 and 2. Expected: Today, Plan, and Insights markers pass.

### Task 4: Restyle Coach and Settings, then verify

**Files:**
- Modify: `apps/mobile/app/(app)/(tabs)/coach.tsx`
- Modify: `apps/mobile/app/(app)/(tabs)/settings.tsx`
- Modify: `apps/mobile/src/coachLayout.test.ts`

**Interfaces:**
- Consumes: Quiet Health tokens and hairline primitives.
- Preserves: conversation drawer, message send/undo, memory tools, profile/goals queries, and sign out.

- [ ] **Step 1: Restyle Coach**

Flatten the chat shell, reduce bubble chrome, keep the composer dock visually distinct above the tab bar, and retain tools/history in secondary controls.

- [ ] **Step 2: Restyle Settings**

Replace metrics and goal cards with an identity row plus Data & Connections, Preferences, Goals, Privacy, and Sign Out hairline groups.

- [ ] **Step 3: Update the coach layout contract**

Keep assertions for independent message scrolling and the hidden history drawer, but update style-marker expectations from the previous card shell to `composerBar` and the flattened message stage.

- [ ] **Step 4: Run full verification**

Run: `npm test --workspace @hbm/mobile`

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit`

Expected: both exit 0 with no failed tests or TypeScript errors.
