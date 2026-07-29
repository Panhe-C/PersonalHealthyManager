# Warm Card Redesign — Phase 2 Design (Plan, Insights, Coach, Settings, Auth)

**Status:** approved direction, pending implementation plan
**Date:** 2026-07-29
**Builds on:** phase 1 spec (`2026-07-29-warm-card-redesign-phase1-design.md`) and its landed tokens/primitives/FloatingTabBar/Today tab (commits `55d65a4`..`5ba90b4`).

## Context

Phase 1 established the warm design language (tokens, `cardShadow`, pill controls, floating capsule tab bar) and rebuilt only the Today tab. The remaining screens already render the warm palette (all colors flow through tokens) but keep iOS-era structures: native large-title headers, header-mounted actions, and one known bug — the coach composer still reads `BottomTabBarHeightContext`, which is meaningless under the custom floating tab bar.

Phase 2 migrates every remaining screen to the warm structure. After this phase the whole app speaks one visual language.

## Scope

- Plan tab, Insights tab, Coach tab, Settings root + its eight detail pages, auth login/register.
- Phase-1 leftover fixes (from the final review triage): coach composer clearance, FAB accessibility state, sleep-bar accessibility labels, Today submit-button margin alignment.

## Non-goals

- The FAB's real action (still navigates to Coach as a placeholder).
- New features, new endpoints, or data-shape changes — every query/mutation stays byte-identical.
- Custom fonts; gradients; blur anywhere.
- Deleting `InsetGroup`/`Row` — they remain the list primitive and are already warm (shadow + 28pt radius).

## Shared decisions

1. **Tab-root headers go in-page.** Plan, Insights, and Settings roots hide their native large-title headers (`headerShown: false` in each tab's `_layout.tsx`, same as Today) and render the phase-1 in-page header pattern: overline (small, `labelSecondary`) + 30pt `weight="strong"` title + optional trailing circular `surface` icon button(s). Coach keeps its native **inline** header (chat screens need a nav bar; its three icon actions stay there, restyled to `tint`).
2. **Settings detail pages keep native inline headers** (push pages need the back button); titles stay as configured in `settings/_layout.tsx`. Their content is already warm via `InsetGroup`/`Row`; only page-level spacing is aligned (cards' 20pt margin where full-width cards appear, `InsetGroup` keeps its 16pt inset).
3. **Margins:** full-width warm cards use 20pt horizontal margin; `InsetGroup` lists keep 16pt; buttons inside card-flow screens align to 20pt (fix the phase-1 16-vs-20 mismatch on Today's submit button by wrapping, not by changing `Button`'s global margin).
4. **Composer clearance:** coach composer and message list stop reading `BottomTabBarHeightContext`; they clear the capsule via `insets.bottom + FLOATING_TAB_BAR_CLEARANCE` from `src/navigation/tabBarMetrics.ts`, matching `Screen`'s fixed formula.
5. **FAB a11y:** the coach tab's spacer slot and the FAB expose selected state — when coach is focused the FAB gets `accessibilityState={{ selected: true }}` and `tint` tint; order in the a11y tree stays as-is (documented, acceptable).
6. **Sleep bars a11y (Today):** each bar column becomes an `accessible` unit with `accessibilityLabel` like `周二睡眠 8 小时 35 分`.

## Per-screen design

### Plan tab (`plan/index.tsx`)

- In-page header: overline `第 N 周` + title `计划`, trailing circular button (Sparkles icon) carrying the existing 生成/调整/生成中 action — the native `headerRight` is removed with the header. Generating state disables the button and shows the spinner treatment already used in the page.
- **Week strip** stays a distinct warm card (7 day dots), restyled to `surface` + `cardShadow` + 28pt radius.
- **Primary card** keeps its content (weekday footnote, icon, title2 headline, subtitle, `TrainingTimeline` with 热身/主体/放松 tracks) but moves to the phase-1 card recipe: `surface`, `radius.card`, `cardShadow`, 20pt margin.
- `训练安排` / `饮食` / `日历草稿` stay `InsetGroup` lists (already warm); the 409 "还差一步" guidance banner keeps the `Feedback` component.
- Empty state (no active plan) keeps `EmptyState` + pill `Button` 生成本周计划.

### Insights tab (`insights/index.tsx`)

- In-page header: overline `最近 8 天` + title `数据`.
- **Recovery stat card** → warm card: `恢复趋势` footnote, `size="metric"` value with ±Δ%, status sentence.
- **Chart card** → warm card wrapping the existing `TrendChart` (colors already token-driven; verify `tint`/`separator` read well on `surface` in both schemes) with first/last date labels.
- `分析` stays an `InsetGroup` (三条 icon Row: 平均睡眠 / 训练负荷 / 最近活动).

### Coach tab (`coach/index.tsx`)

- Native inline header stays; the three actions (History / Brain / SquarePen) keep their positions and 44pt targets, icon color `tint`.
- **Bubbles:** user bubble keeps `controlFill`/`controlLabel` (now near-black — already correct for warm); assistant bubble `surface` + `radius.bubble` + `cardShadow`; the Leaf avatar ring uses `tint`.
- **Composer:** TextInput pill (`radius.pill` when single-line-height, `radius.bubble` multiline) on a `surface` dock; send button 32pt circle `controlFill`. Dock bottom padding = `spacing.sm + insets.bottom + FLOATING_TAB_BAR_CLEARANCE`; message list gets the same bottom clearance. `BottomTabBarHeightContext` import is deleted.
- Memory sheet / history drawer keep their self-drawn Modals (`surface`, `radius.sheet`, `cardShadow` added); `MemoryRow`/`MemoryEditor` keep `InsetGroup`/`Row`.

### Settings root (`settings/index.tsx`)

- In-page header: overline `账户与偏好` + title `我的`.
- The profile block becomes a warm card (avatar circle, name, email) instead of a headerless `InsetGroup`.
- The five groups (账户 / 数据与连接 / 偏好 / 目标 / 隐私) stay `InsetGroup` + `Row` with `insetSeparators`; 退出登录 stays a destructive `Row` in its own group.
- All `router.push` absolute paths unchanged.

### Eight settings detail pages

- Native inline headers with existing Chinese titles; content already `InsetGroup`-based. Only alignment tweaks: page top padding consistent with the in-page-header tabs, any full-width cards (e.g. goal editor card, danger zone) get the 20pt margin + `cardShadow` treatment. `ChoiceGroup` (性别/经验/模型提供方) keeps the segmented style (already warm: `fill` track, `surface` selected).

### Auth (login/register)

- Structure unchanged (no native header, in-page `largeTitle` block, `InsetGroup` form, filled/plain buttons). Restyle: page bg `bg`, title block adopts the warm header metrics (title 30pt `weight="strong"` + subheadline, matching tab roots), buttons are already pills via phase-1 `Button`.

## Tests

- `warmUi.test.ts` gains contract assertions per screen: `headerShown: false` in plan/insights/settings layouts, Sparkles button in plan's in-page header (no `headerRight` remains), coach composer uses `FLOATING_TAB_BAR_CLEARANCE` and no `BottomTabBarHeightContext`, settings profile card, auth header metrics.
- Component tests: `FloatingTabBar.test.tsx` gains the FAB selected-state assertion; Today sleep-bar a11y labels; coach composer clearance (mock `useSafeAreaInsets`).
- Existing behavior tests (`trainingFlows.test.ts`, component suites) must stay green untouched.
- Acceptance per task: `npm test --workspace @hbm/mobile`, `npx tsc -p apps/mobile/tsconfig.json --noEmit`, `npm run lint --workspace @hbm/mobile`, repo-root `npm test` all green.

## Risks

- **Hiding native headers on three more tabs** removes the collapse-on-scroll behavior there — intended (warm headers are static), flagged so it isn't "fixed" later.
- **Composer clearance** interacts with `KeyboardAvoidingView`; the plan must verify keyboard-open state in the simulator manually (acceptance item).
- **Coach is the largest file in the app** (~700 lines); the plan should keep edits surgical — bubbles, composer, sheet shadows — not a rewrite.
- **TrendChart contrast** on warm `surface` in dark mode needs one simulator pass (dark-mode QA item).
