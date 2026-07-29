# Warm Card Redesign Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate every remaining screen of the Expo app to the warm card structure landed in phase 1: the Plan, Insights, and Settings tab roots hide their native large-title headers and adopt the phase-1 in-page warm header (extracted from Today into a shared `WarmHeader` component); Plan's week strip and primary training card, Insights' stat and chart cards, and the Settings profile block become shadowed warm cards; the Coach tab keeps its native inline header and gets the warm finishing touches (bubble/sheet/drawer shadows, pill send button); the eight settings detail pages keep their native inline headers with spacing alignment only; auth login/register adopt the warm header metrics; and the phase-1 leftover fixes land (FAB selected state, Today sleep-bar accessibility labels, Today submit-button 20pt alignment). The coach composer `BottomTabBarHeightContext` bug is already fixed in commit `672b091` — this plan only adds the contract assertion, it does not re-fix it.

**Architecture:** Same contract-test-driven, bottom-up order as phase 1. (1) The in-page header pattern Today established in phase 1 (overline + 30pt `weight="strong"` title + trailing circular `surface` icon button with `cardShadow`, safe-area top inset padded manually through `Screen`'s `contentContainerStyle`) is extracted verbatim into `src/components/WarmHeader.tsx` (`WarmHeader` + `WarmHeaderButton`), and Today switches to it with zero visual change. (2) Plan, Insights, and Settings roots hide their native headers (`headerShown: false` in each tab's `_layout.tsx`, exactly like Today) and compose `WarmHeader` plus warm cards from their existing data hooks — Plan's 生成/调整/生成中 action moves from the native `headerRight` to a `WarmHeaderButton` carrying a Sparkles icon (spinner while pending). (3) Coach is edited surgically — five small before/after edits, no rewrite — to add `cardShadow` to the assistant bubble, memory sheet, and history drawer, and to make the send button a true circle. (4) The leftover fixes are equally surgical: the FAB exposes `accessibilityState={{ selected }}` and a `tint` background while Coach is focused, Today's sleep bars become accessible units, and Today's submit button reaches the 20pt card margin by wrapping (`Button`'s global 16pt margin is untouched). (5) The eight settings detail pages get a one-line `paddingTop: spacing.lg` alignment each; auth screens swap `size="largeTitle"` for the warm 30pt `weight="strong"` metrics. Every query, mutation, and conversation action stays byte-identical; the rewritten `warmUi.test.ts` contract suite and the untouched behavior suites (`trainingFlows.test.ts`, `coachLayout.test.ts`, `coachLifecycle.test.ts`) prove nothing was missed.

**Tech Stack:** Expo SDK 53, Expo Router 5.1, React Native 0.79, TypeScript, `@react-navigation/bottom-tabs` 7.18, `@react-navigation/native-stack` 7.17, react-native-safe-area-context, lucide-react-native, react-native-svg, Vitest.

## Global Constraints

- Preserve every existing API query, mutation, conversation action, and auth action. `generateActivePlan(currentWeekStartIso())`, `confirmCalendarDraft`, `completeTrainingTask`, and all coach mutations keep their exact call shapes. This is a visual and navigational refactor only.
- Keep the app Chinese-first.
- Keep exactly five tabs in this order: 今日、计划、教练、数据、我的. The `FloatingTabBar` centre-spacer convention (route index 2 is the FAB slot) is unchanged.
- Token key names, `radius` values, `cardShadow(scheme)`, and `FLOATING_TAB_BAR_CLEARANCE = 110` are phase-1 land — do not touch `src/theme/tokens.ts` or `src/navigation/tabBarMetrics.ts`.
- Coach keeps its native **inline** header (`headerLargeTitleEnabled: false` in `coach/_layout.tsx`); its three icon actions (History / Brain / SquarePen) stay in the native header with 44pt targets and `tint` icons. The settings detail pages keep their native inline headers and existing Chinese titles.
- Margins: full-width warm cards use 20pt horizontal margin; `InsetGroup` lists keep their 16pt inset; the 16-vs-20 button mismatch is fixed by wrapping, never by changing `Button`'s global `marginHorizontal: spacing.lg`.
- The coach composer clearance fix from commit `672b091` (`paddingBottom: spacing.sm + insets.bottom + FLOATING_TAB_BAR_CLEARANCE`) stays exactly as landed; this plan adds the contract assertion only.
- No custom fonts, no gradients, no blur anywhere. `src/navigation/headerOptions.ts` keeps `headerBlurEffect` for the native headers that remain (coach inline header, eight settings detail pages).
- Test style: contract tests read source strings (`readFileSync` + `toContain`); component tests mock `react-native` with `vi.mock` and call components as plain functions.
- Existing behavior tests (`trainingFlows.test.ts`, `coachLayout.test.ts`, `coachLifecycle.test.ts`, component suites) must stay green untouched. The only test files this plan edits are `src/warmUi.test.ts` and `src/navigation/FloatingTabBar.test.tsx`.
- Every task ends with `npm test --workspace @hbm/mobile` green and `npx tsc -p apps/mobile/tsconfig.json --noEmit` passing, then one commit.

**Commands used throughout:**

- Focused test: `npm test --workspace @hbm/mobile -- <path>`
- Full mobile tests: `npm test --workspace @hbm/mobile`
- Typecheck: `npx tsc -p apps/mobile/tsconfig.json --noEmit`
- Lint: `npm run lint --workspace @hbm/mobile`

---

### Task 1: Extract WarmHeader; migrate Insights and Settings roots

Pull Today's phase-1 in-page header into a shared `WarmHeader`/`WarmHeaderButton` component, switch Today to it with zero visual change, then migrate the Insights and Settings tab roots: hide their native headers, render the warm header, and restyle the stat/chart cards and the profile block as shadowed warm cards with 20pt margins.

**Files:**
- Create: `apps/mobile/src/components/WarmHeader.tsx`
- Modify: `apps/mobile/app/(app)/(tabs)/today/index.tsx`, `apps/mobile/app/(app)/(tabs)/today/_layout.tsx` (comment sweep only)
- Modify: `apps/mobile/app/(app)/(tabs)/insights/_layout.tsx`, `apps/mobile/app/(app)/(tabs)/insights/index.tsx`
- Modify: `apps/mobile/app/(app)/(tabs)/settings/_layout.tsx`, `apps/mobile/app/(app)/(tabs)/settings/index.tsx`
- Modify: `apps/mobile/src/warmUi.test.ts`

**Interfaces:**
- Consumes: `cardShadow`, `radius.pill`, `radius.card`, `spacing`, tokens from phase 1; `Screen`, `InsetGroup`, `Row`, `TrendChart`, `EmptyState`, `Spinner` unchanged.
- Produces: `WarmHeader({ overline: string; title: string; actions?: ReactNode })` and `WarmHeaderButton({ accessibilityLabel: string; disabled?: boolean; onPress: () => void; children: ReactNode })` from `src/components/WarmHeader.tsx`, consumed by today/insights/settings in this task and by plan in Task 2.
- Produces: unchanged data behaviour — `useRecoveryQuery(8)`, `useSleepQuery(8)`, `useActivitiesQuery(8)`, and every settings query keep their exact call shapes.

- [ ] **Step 1: Write the failing contract tests**

In `apps/mobile/src/warmUi.test.ts`, replace the whole `builds Insights from a stat card, a chart card, and a grouped list` test with:

```ts
  it("hides the native header and builds Insights from warm cards", () => {
    expect(read("../app/(app)/(tabs)/insights/_layout.tsx")).toContain("headerShown: false");

    const source = read("../app/(app)/(tabs)/insights/index.tsx");

    expect(source).toContain("WarmHeader");
    expect(source).toContain("最近 8 天");
    expect(source).toContain("styles.statCard");
    expect(source).toContain("styles.chartCard");
    expect(source).toContain("cardShadow");
    expect(source).toContain("<InsetGroup");
  });
```

Replace the whole `hides the native header and builds Today from warm cards` test with (adds the `WarmHeader` assertion, keeps every other assertion):

```ts
  it("hides the native header and builds Today from warm cards", () => {
    expect(read("../app/(app)/(tabs)/today/_layout.tsx")).toContain("headerShown: false");

    const source = read("../app/(app)/(tabs)/today/index.tsx");

    expect(source).toContain("WarmHeader");
    expect(source).toContain("ReadinessRing");
    expect(source).toContain("本周睡眠");
    expect(source).toContain("useSleepQuery");
    expect(source).toContain("训练清单");
    expect(source).toContain("CheckRow");
    expect(source).toContain("cardShadow");
    expect(source).toContain("查看本周计划");
  });
```

Append to the `describe` block:

```ts
  it("shares one in-page warm header across the migrated tab roots", () => {
    const source = read("./components/WarmHeader.tsx");

    expect(source).toContain("export function WarmHeader");
    expect(source).toContain("export function WarmHeaderButton");
    expect(source).toContain('weight="strong"');
    expect(source).toContain("fontSize: 30");
    expect(source).toContain("cardShadow");
    expect(source).toContain("borderRadius: radius.pill");

    for (const tab of ["today", "insights", "settings"]) {
      expect(read(`../app/(app)/(tabs)/${tab}/index.tsx`)).toContain("WarmHeader");
    }
  });

  it("hides the native header and gives 我的 a warm profile card", () => {
    expect(read("../app/(app)/(tabs)/settings/_layout.tsx")).toContain("headerShown: false");

    const source = read("../app/(app)/(tabs)/settings/index.tsx");

    expect(source).toContain("WarmHeader");
    expect(source).toContain("账户与偏好");
    expect(source).toContain("styles.profileCard");
    expect(source).toContain("cardShadow");
    expect(source).toContain("<InsetGroup");
  });
```

The `shares one in-page warm header` test loops `["today", "insights", "settings"]` only — Task 2 extends the loop to include `plan`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace @hbm/mobile -- src/warmUi.test.ts`

Expected: FAIL. The `shares one in-page warm header` test throws on `readFileSync` for the missing `src/components/WarmHeader.tsx`; the Insights and 我的 tests fail on `headerShown: false`.

- [ ] **Step 3: Create the shared WarmHeader component**

Create `apps/mobile/src/components/WarmHeader.tsx`. The markup and metrics are lifted verbatim from Today's phase-1 header row (overline + 30pt strong title + 42pt circular surface button with the card shadow); the only generalisation is the `actions` slot:

```tsx
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { cardShadow, radius, spacing, useTheme } from "../theme/tokens";
import { Text } from "./Text";

/**
 * Shared in-page header for the tab roots that hide their native header
 * (今日/计划/数据/我的): a small overline above a 30pt strong title, with
 * optional trailing circular surface icon buttons. Screens render it as the
 * first child of Screen and pad the safe-area top inset themselves through
 * Screen's contentContainerStyle, the pattern Today established in phase 1.
 */
export function WarmHeader({
  overline,
  title,
  actions
}: {
  overline: string;
  title: string;
  actions?: ReactNode;
}) {
  const { tokens } = useTheme();

  return (
    <View style={styles.headerRow}>
      <View style={styles.headerCopy}>
        <Text size="footnote" color={tokens.labelSecondary}>
          {overline}
        </Text>
        <Text size="title1" weight="strong" style={styles.pageTitle}>
          {title}
        </Text>
      </View>
      {actions ? <View style={styles.headerActions}>{actions}</View> : null}
    </View>
  );
}

/**
 * The trailing circular button of a WarmHeader: a 42pt pill on a surface
 * background with the card shadow. The icon comes in as children so each
 * screen picks its own glyph and tint.
 */
export function WarmHeaderButton({
  accessibilityLabel,
  disabled,
  onPress,
  children
}: {
  accessibilityLabel: string;
  disabled?: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  const { tokens, isDark } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.circleButton, { backgroundColor: tokens.surface }, cardShadow(isDark ? "dark" : "light")]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circleButton: {
    alignItems: "center",
    borderRadius: radius.pill,
    height: 42,
    justifyContent: "center",
    width: 42
  },
  headerActions: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  headerCopy: { flex: 1 },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 20
  },
  pageTitle: { fontSize: 30, letterSpacing: -0.5, lineHeight: 36, marginTop: 2 }
});
```

- [ ] **Step 4: Switch Today to WarmHeader**

Replace the whole of `apps/mobile/app/(app)/(tabs)/today/index.tsx`. The only changes versus the phase-1 file are: the `Pressable` import is gone, `WarmHeader`/`WarmHeaderButton` are imported, the hand-rolled `headerRow` block becomes a `WarmHeader`, and the `circleButton`/`headerRow`/`pageTitle` styles are deleted (they now live in the component). Everything else — data hooks, hero card, sleep bars, checklist, submit mutation — is byte-identical:

```tsx
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Footprints, Moon } from "lucide-react-native";
import { Screen } from "../../../../src/components/Screen";
import { Text } from "../../../../src/components/Text";
import { Button } from "../../../../src/components/Button";
import { CheckRow } from "../../../../src/components/CheckRow";
import { useFeedback } from "../../../../src/components/Feedback";
import { EmptyState, Spinner } from "../../../../src/components/States";
import { TextField } from "../../../../src/components/TextField";
import { ReadinessRing } from "../../../../src/components/QuietHealth";
import { WarmHeader, WarmHeaderButton } from "../../../../src/components/WarmHeader";
import { useSleepQuery, useTodayOverviewQuery } from "../../../../src/api/hooks";
import { completeTrainingTask } from "../../../../src/api/training";
import {
  APP_TIME_ZONE,
  formatDateLabel,
  formatDuration,
  percentLabel
} from "../../../../src/ui/format";
import { cardShadow, radius, spacing, useTheme } from "../../../../src/theme/tokens";
import type { TodayOverview } from "../../../../src/api/schemas";

type TodayTask = TodayOverview["todayTasks"][number];
type ChecklistStatus = TodayTask["checklistItems"][number]["status"];

// Sleep bar geometry: bars scale against the longest night shown instead of
// the prototype's `hours * 7` multiplier.
const BAR_MAX_HEIGHT = 72;
const BAR_MIN_HEIGHT = 6;
const BAR_WIDTH = 18;
const BAR_RADIUS = 6;

const weekdayFormat = new Intl.DateTimeFormat("zh-CN", {
  timeZone: APP_TIME_ZONE,
  weekday: "short"
});

function weekdayLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : weekdayFormat.format(date);
}

export default function TodayTab() {
  const { data, isLoading, error } = useTodayOverviewQuery();
  const sleep = useSleepQuery(7);
  const { tokens, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const shadow = cardShadow(isDark ? "dark" : "light");
  const recovery = typeof data?.latestRecovery?.recoveryPercent === "number" ? data.latestRecovery.recoveryPercent : 0;
  const sleepMinutes = typeof data?.latestSleep?.durationMinutes === "number" ? data.latestSleep.durationMinutes : null;
  const activityMinutes = data?.todayTasks.reduce((sum, task) => sum + task.durationMinutes, 0) ?? 0;
  const focusTask = data?.todayTasks[0];
  // The API returns the newest night first; the card renders oldest to newest.
  const weekSleep = [...(sleep.data ?? [])].slice(0, 7).reverse();
  const maxSleep = Math.max(...weekSleep.map((record) => record.durationMinutes), 1);
  const averageSleep = weekSleep.length
    ? Math.round(weekSleep.reduce((sum, record) => sum + record.durationMinutes, 0) / weekSleep.length)
    : null;

  return (
    <Screen contentContainerStyle={{ gap: spacing.lg, paddingTop: insets.top + spacing.lg }}>
      {isLoading ? <Spinner /> : error ? (
        <EmptyState title="今日数据加载失败" description="请确认后端和登录状态仍然可用。" />
      ) : data ? (
        <>
          {/* In-page header: the native header is hidden for this tab, so the
              safe-area top inset is applied manually via contentContainerStyle. */}
          <WarmHeader
            overline={`${formatDateLabel(data.date)} · ${weekdayLabel(data.date)}`}
            title="今日"
            actions={
              <WarmHeaderButton
                accessibilityLabel="查看本周计划"
                onPress={() => router.push("/(app)/(tabs)/plan")}
              >
                <CalendarDays color={tokens.label} size={18} strokeWidth={1.8} />
              </WarmHeaderButton>
            }
          />

          {/* Hero: readiness ring left, three metrics right, hairline between. */}
          <View style={[styles.heroCard, { backgroundColor: tokens.surface }, shadow]}>
            <ReadinessRing
              value={recovery}
              label={recovery >= 75 ? "准备就绪" : recovery >= 50 ? "适度训练" : "优先恢复"}
            />
            <View style={[styles.heroDivider, { backgroundColor: tokens.separator }]} />
            <View style={styles.heroMetrics}>
              {[
                { label: "睡眠", value: formatDuration(sleepMinutes) },
                { label: "恢复", value: percentLabel(recovery) },
                { label: "活动", value: activityMinutes ? `${activityMinutes} 分` : "—" }
              ].map((metric, index) => (
                <View
                  key={metric.label}
                  style={[
                    styles.heroMetricRow,
                    index > 0
                      ? { borderTopColor: tokens.separator, borderTopWidth: StyleSheet.hairlineWidth }
                      : null
                  ]}
                >
                  <Text size="footnote" color={tokens.labelSecondary}>
                    {metric.label}
                  </Text>
                  <Text size="body" weight="strong">
                    {metric.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Weekly sleep bars, newest night on the right in controlFill. */}
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
                {averageSleep === null ? "暂无记录" : `平均 ${formatDuration(averageSleep)}`}
              </Text>
            </View>
            {weekSleep.length ? (
              <View style={styles.barRow}>
                {weekSleep.map((record, index) => (
                  <View key={record.id} style={styles.barCol}>
                    <View
                      style={[
                        styles.bar,
                        {
                          backgroundColor:
                            index === weekSleep.length - 1 ? tokens.controlFill : tokens.fill,
                          height: Math.max(
                            BAR_MIN_HEIGHT,
                            Math.round((record.durationMinutes / maxSleep) * BAR_MAX_HEIGHT)
                          )
                        }
                      ]}
                    />
                    <Text size="caption2" color={tokens.labelSecondary}>
                      {weekdayLabel(record.date).replace("周", "")}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text size="footnote" color={tokens.labelSecondary}>
                同步 Apple 健康后展示最近几晚的睡眠。
              </Text>
            )}
          </View>

          {focusTask ? <TodayChecklist task={focusTask} shadow={shadow} /> : (
            <View style={[styles.card, { backgroundColor: tokens.surface }, shadow]}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeaderLeft}>
                  <View style={[styles.iconTile, { backgroundColor: tokens.fill }]}>
                    <Footprints color={tokens.orange} size={16} strokeWidth={1.8} />
                  </View>
                  <Text size="callout" weight="semibold">
                    训练清单
                  </Text>
                </View>
              </View>
              <Text size="footnote" color={tokens.labelSecondary}>
                {data.activePlanId ? "今天没有安排训练任务。" : "生成计划后，今日训练会显示在这里。"}
              </Text>
            </View>
          )}
        </>
      ) : null}
    </Screen>
  );
}

function nextChecklistStatus(status: ChecklistStatus): ChecklistStatus {
  if (status === "pending") return "completed";
  if (status === "completed") return "skipped";
  return "pending";
}

function TodayChecklist({
  task,
  shadow
}: {
  task: TodayTask;
  shadow: ReturnType<typeof cardShadow>;
}) {
  const { tokens } = useTheme();
  const queryClient = useQueryClient();
  const { notify } = useFeedback();
  const [actualLoad, setActualLoad] = useState("");
  const [statuses, setStatuses] = useState<Record<string, ChecklistStatus>>(
    () => Object.fromEntries(task.checklistItems.map((item) => [item.id, item.status])) as Record<string, ChecklistStatus>
  );
  const alreadyRecorded = task.status !== "planned" && task.status !== "pending";
  const completedCount = task.checklistItems.filter(
    (item) => (statuses[item.id] ?? item.status) === "completed"
  ).length;
  const completionMutation = useMutation({
    mutationFn: () => completeTrainingTask(task.id, {
      actualLoad: actualLoad.trim() ? Number(actualLoad) : undefined,
      items: task.checklistItems.map((item) => ({ id: item.id, label: item.label, status: statuses[item.id] ?? item.status }))
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["today"] });
      void queryClient.invalidateQueries({ queryKey: ["plan", "active"] });
      notify({ title: "已记录", description: "训练完成情况已同步到计划。" });
    },
    onError: (err) => notify({ tone: "danger", title: "提交失败", description: err instanceof Error ? err.message : "请稍后重试。" })
  });

  return (
    <>
      <View style={[styles.listCard, { backgroundColor: tokens.surface }, shadow]}>
        <View style={styles.listCardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={[styles.iconTile, { backgroundColor: tokens.fill }]}>
              <Footprints color={tokens.orange} size={16} strokeWidth={1.8} />
            </View>
            <Text size="callout" weight="semibold">
              训练清单
            </Text>
          </View>
          <Text size="footnote" color={tokens.labelSecondary}>
            {completedCount}/{task.checklistItems.length}
          </Text>
        </View>
        {task.checklistItems.map((item, index) => (
          <View key={item.id}>
            {index > 0 ? <View style={[styles.rowDivider, { backgroundColor: tokens.separator }]} /> : null}
            <CheckRow
              label={item.label}
              status={statuses[item.id] ?? item.status}
              disabled={alreadyRecorded || completionMutation.isPending}
              onPress={() =>
                setStatuses((items) => ({
                  ...items,
                  [item.id]: nextChecklistStatus(statuses[item.id] ?? item.status)
                }))
              }
            />
          </View>
        ))}
        <View style={[styles.rowDivider, { backgroundColor: tokens.separator }]} />
        <TextField
          label="实际负荷"
          value={actualLoad}
          onChange={setActualLoad}
          placeholder="可选"
          keyboardType="number-pad"
          editable={!alreadyRecorded && !completionMutation.isPending}
        />
        <Text size="footnote" color={tokens.labelSecondary} style={styles.listCardFooter}>
          {alreadyRecorded ? "本次训练已记录。" : "点按可在完成、跳过、待办之间切换。"}
        </Text>
      </View>

      <Button
        title={alreadyRecorded ? "已记录" : completionMutation.isPending ? "提交中" : "提交完成"}
        disabled={alreadyRecorded || completionMutation.isPending}
        onPress={() => completionMutation.mutate()}
      />
    </>
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
  },
  card: { borderRadius: radius.card, gap: 14, marginHorizontal: 20, padding: 18 },
  cardHeaderLeft: { alignItems: "center", flexDirection: "row", gap: 10 },
  cardHeaderRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  heroCard: {
    alignItems: "center",
    borderRadius: radius.sheet, // the hero card uses the larger 32pt radius
    flexDirection: "row",
    gap: 20,
    marginHorizontal: 20,
    padding: 18
  },
  heroDivider: { alignSelf: "stretch", width: StyleSheet.hairlineWidth },
  heroMetricRow: {
    alignItems: "baseline",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10
  },
  heroMetrics: { flex: 1 },
  iconTile: {
    alignItems: "center",
    borderRadius: 10,
    height: 32,
    justifyContent: "center",
    width: 32
  },
  listCard: { borderRadius: radius.card, marginHorizontal: 20, paddingVertical: spacing.lg },
  listCardFooter: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  listCardHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg
  },
  rowDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: spacing.lg }
});
```

Also sweep the now-stale comment in `apps/mobile/app/(app)/(tabs)/today/_layout.tsx` (phase 2 hides three more headers, so "only here" is no longer true). Replace the whole file:

```tsx
import { Stack } from "expo-router";
import { useNativeHeaderOptions } from "../../../../src/navigation/headerOptions";

export default function TodayLayout() {
  const screenOptions = useNativeHeaderOptions();

  return (
    <Stack screenOptions={screenOptions}>
      {/* Today draws the shared warm in-page header (WarmHeader), so the
          native large title is hidden, same as Plan, Insights, and 我的.
          Coach and the settings detail pages keep their native headers. */}
      <Stack.Screen name="index" options={{ title: "今日", headerShown: false }} />
    </Stack>
  );
}
```

- [ ] **Step 5: Hide the Insights native header**

Replace the whole of `apps/mobile/app/(app)/(tabs)/insights/_layout.tsx`:

```tsx
import { Stack } from "expo-router";
import { useNativeHeaderOptions } from "../../../../src/navigation/headerOptions";

export default function InsightsLayout() {
  const screenOptions = useNativeHeaderOptions();

  return (
    <Stack screenOptions={screenOptions}>
      {/* Insights draws the shared warm in-page header, so the native large
          title is hidden. Warm headers are static by design — the loss of
          collapse-on-scroll here is intended, not a bug to fix later. */}
      <Stack.Screen name="index" options={{ title: "数据", headerShown: false }} />
    </Stack>
  );
}
```

- [ ] **Step 6: Rebuild the Insights screen with warm cards**

Replace the whole of `apps/mobile/app/(app)/(tabs)/insights/index.tsx`. Data hooks, derived values, `TrendChart`, date labels, and the 分析 `InsetGroup` are unchanged; the two cards move to the phase-1 card recipe (`surface`, `radius.card`, `cardShadow`, 20pt margin, 18pt padding):

```tsx
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Activity, Dumbbell, Moon } from "lucide-react-native";
import { Screen } from "../../../../src/components/Screen";
import { Text } from "../../../../src/components/Text";
import { EmptyState, Spinner } from "../../../../src/components/States";
import { TrendChart } from "../../../../src/components/QuietHealth";
import { InsetGroup } from "../../../../src/components/InsetGroup";
import { Row } from "../../../../src/components/Row";
import { WarmHeader } from "../../../../src/components/WarmHeader";
import { useActivitiesQuery, useRecoveryQuery, useSleepQuery } from "../../../../src/api/hooks";
import { formatDateLabel, formatDuration, numberLabel } from "../../../../src/ui/format";
import { cardShadow, radius, spacing, useTheme } from "../../../../src/theme/tokens";

export default function InsightsTab() {
  const recovery = useRecoveryQuery(8);
  const sleep = useSleepQuery(8);
  const activities = useActivitiesQuery(8);
  const { tokens, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const shadow = cardShadow(isDark ? "dark" : "light");
  const recoveryValues = [...(recovery.data ?? [])].reverse().map((item) => item.recoveryPercent ?? 0);
  const latestRecovery = recoveryValues.at(-1) ?? 0;
  const earliestRecovery = recoveryValues[0] ?? latestRecovery;
  const recoveryDelta = latestRecovery - earliestRecovery;
  const averageSleep = sleep.data?.length ? Math.round(sleep.data.reduce((sum, item) => sum + item.durationMinutes, 0) / sleep.data.length) : null;
  const averageLoad = activities.data?.length ? Math.round(activities.data.reduce((sum, item) => sum + (item.trainingLoad ?? 0), 0) / activities.data.length) : null;
  const isLoading = recovery.isLoading || sleep.isLoading || activities.isLoading;
  const hasError = recovery.error || sleep.error || activities.error;

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
          </InsetGroup>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chartCard: {
    borderRadius: radius.card,
    gap: spacing.sm,
    marginHorizontal: 20,
    padding: 18
  },
  chartLabels: { flexDirection: "row", justifyContent: "space-between" },
  statCard: {
    borderRadius: radius.card,
    gap: spacing.xs,
    marginHorizontal: 20,
    padding: 18
  }
});
```

- [ ] **Step 7: Hide the Settings root native header**

Replace the whole of `apps/mobile/app/(app)/(tabs)/settings/_layout.tsx`. Only the index screen changes; the eight detail screens keep their native inline headers and titles:

```tsx
import { Stack } from "expo-router";
import { useNativeHeaderOptions } from "../../../../src/navigation/headerOptions";

const detailScreens = [
  { name: "profile-settings", title: "个人资料" },
  { name: "account-security", title: "账户安全" },
  { name: "healthkit-settings", title: "Apple 健康" },
  { name: "model-settings", title: "模型运行时" },
  { name: "connection-settings", title: "连接配置" },
  { name: "notification-settings", title: "通知与提醒" },
  { name: "goal-settings", title: "管理目标" },
  { name: "data-export", title: "导出数据" }
];

export default function SettingsLayout() {
  const screenOptions = useNativeHeaderOptions();

  return (
    <Stack screenOptions={screenOptions}>
      {/* The settings root draws the shared warm in-page header; the eight
          detail pages keep their native inline headers for the back button. */}
      <Stack.Screen name="index" options={{ title: "我的", headerShown: false }} />
      {detailScreens.map((screen) => (
        <Stack.Screen
          key={screen.name}
          name={screen.name}
          options={{ title: screen.title, headerLargeTitleEnabled: false }}
        />
      ))}
    </Stack>
  );
}
```

- [ ] **Step 8: Rebuild the Settings root with a warm profile card**

Replace the whole of `apps/mobile/app/(app)/(tabs)/settings/index.tsx`. The five groups, the 退出登录 row, every `router.push` absolute path, and the automation expand/collapse logic are unchanged; the headerless profile `InsetGroup` becomes a warm card:

```tsx
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell, Brain, CalendarDays, ChevronDown, ChevronRight, ChevronUp, Cloud, Download, HeartPulse, KeyRound, Link, Ruler, Shield, Target, UserRound, Utensils, Watch } from "lucide-react-native";
import { Screen } from "../../../../src/components/Screen";
import { Text } from "../../../../src/components/Text";
import { useFeedback } from "../../../../src/components/Feedback";
import { InsetGroup } from "../../../../src/components/InsetGroup";
import { Row } from "../../../../src/components/Row";
import { WarmHeader } from "../../../../src/components/WarmHeader";
import { useAccountQuery, useAutomationStatesQuery, useGoalsQuery, useProfileQuery, useSettingsQuery } from "../../../../src/api/hooks";
import { useAuth } from "../../../../src/auth/AuthContext";
import { mcpConnectionStatus } from "../../../../src/settingsStatus";
import { cardShadow, radius, spacing, useTheme } from "../../../../src/theme/tokens";

export default function SettingsTab() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { confirm } = useFeedback();
  const goals = useGoalsQuery();
  const profile = useProfileQuery();
  const account = useAccountQuery();
  const settings = useSettingsQuery();
  const automations = useAutomationStatesQuery();
  const { tokens, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const shadow = cardShadow(isDark ? "dark" : "light");
  const [showAutomations, setShowAutomations] = useState(false);
  const iconProps = { color: tokens.tint, size: 20, strokeWidth: 1.8 } as const;
  const accountEmail = account.data?.email ?? "正在读取账户…";
  const initials = account.data?.email.slice(0, 2).toUpperCase() ?? "HB";
  const connection = (id: "coros" | "calendar" | "meal_menu") =>
    settings.data?.dataMcpConnections.find((item) => item.id === id);
  const automationSummary = automations.data?.some((item) => item.status === "failed")
    ? "需检查"
    : automations.data?.length
      ? "运行中"
      : "未运行";

  async function requestSignOut() {
    const confirmed = await confirm({
      title: "退出当前账号？",
      description: "会清空本机保存的 access 和 refresh token，下次需要重新登录。",
      confirmLabel: "退出",
      destructive: true
    });
    if (confirmed) await signOut();
  }

  return (
    <Screen contentContainerStyle={{ paddingTop: insets.top + spacing.lg }}>
      {/* In-page header: the native header is hidden for this tab, so the
          safe-area top inset is applied manually via contentContainerStyle. */}
      <WarmHeader overline="账户与偏好" title="我的" />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="个人资料"
        onPress={() => router.push("/(app)/(tabs)/settings/profile-settings")}
        style={[styles.profileCard, { backgroundColor: tokens.surface }, shadow]}
      >
        <View style={[styles.profileAvatar, { backgroundColor: tokens.controlFill }]}>
          <Text size="headline" color={tokens.controlLabel}>
            {initials}
          </Text>
        </View>
        <View style={styles.profileCopy}>
          <Text size="headline">个人健康空间</Text>
          <Text size="footnote" color={tokens.labelSecondary}>
            {account.error ? "账户信息加载失败" : accountEmail}
          </Text>
        </View>
        <ChevronRight color={tokens.labelTertiary} size={18} strokeWidth={2.2} />
      </Pressable>

      <InsetGroup header="账户" insetSeparators>
        <Row icon={<UserRound {...iconProps} />} title="个人资料" subtitle="身体数据、限制和偏好" onPress={() => router.push("/(app)/(tabs)/settings/profile-settings")} />
        <Row icon={<Shield {...iconProps} />} title="账户安全" subtitle="修改密码会退出所有设备" onPress={() => router.push("/(app)/(tabs)/settings/account-security")} />
      </InsetGroup>

      <InsetGroup header="数据与连接" insetSeparators>
        <Row icon={<HeartPulse {...iconProps} />} title="Apple 健康" subtitle="授权并同步 HealthKit" onPress={() => router.push("/(app)/(tabs)/settings/healthkit-settings")} />
        <Row
          icon={<Cloud {...iconProps} />}
          title="自动同步"
          subtitle={automations.data?.length ? `${automations.data.length} 个后台任务` : "后台任务尚未运行"}
          value={automationSummary}
          trailing={showAutomations
            ? <ChevronUp color={tokens.labelTertiary} size={18} strokeWidth={2.2} />
            : <ChevronDown color={tokens.labelTertiary} size={18} strokeWidth={2.2} />}
          onPress={() => setShowAutomations((value) => !value)}
        />
        {showAutomations
          ? automations.data?.length
            ? automations.data.map((item) => (
              <Row key={item.kind} title={item.kind} subtitle={item.lastError ?? undefined} value={item.status} destructive={item.status === "failed"} />
            ))
            : [<Row key="no-automations" title="还没有自动任务运行记录" />]
          : []}
        <Row icon={<KeyRound {...iconProps} />} title="模型运行时" value={settings.data?.hasApiKey ? settings.data.modelProvider : "未配置密钥"} onPress={() => router.push("/(app)/(tabs)/settings/model-settings")} />
        <Row icon={<Link {...iconProps} />} title="连接配置" subtitle="维护 Endpoint、开关和访问令牌" onPress={() => router.push("/(app)/(tabs)/settings/connection-settings")} />
        <Row icon={<Watch {...iconProps} />} title="COROS" subtitle="浏览器登录授权" value={mcpConnectionStatus(connection("coros"))} onPress={() => router.push("/(app)/(tabs)/settings/connection-settings")} />
        <Row icon={<CalendarDays {...iconProps} />} title="日历" value={mcpConnectionStatus(connection("calendar"))} onPress={() => router.push("/(app)/(tabs)/settings/connection-settings")} />
        <Row icon={<Utensils {...iconProps} />} title="餐食菜单" value={mcpConnectionStatus(connection("meal_menu"))} onPress={() => router.push("/(app)/(tabs)/settings/connection-settings")} />
      </InsetGroup>

      <InsetGroup header="偏好" insetSeparators>
        <Row icon={<Cloud {...iconProps} />} title="外观" subtitle="跟随系统的浅色与深色模式" value="跟随系统" />
        <Row icon={<Ruler {...iconProps} />} title="单位" subtitle="距离用公里，体重用公斤" value="公制" />
        <Row icon={<Bell {...iconProps} />} title="通知与提醒" subtitle="训练开始前 30 分钟提醒" onPress={() => router.push("/(app)/(tabs)/settings/notification-settings")} />
      </InsetGroup>

      <InsetGroup header="目标" insetSeparators>
        <Row icon={<Target {...iconProps} />} title="管理目标" subtitle="新建、编辑或暂停目标" onPress={() => router.push("/(app)/(tabs)/settings/goal-settings")} />
        {goals.isLoading
          ? [<Row key="goals-loading" title="正在读取目标…" />]
          : goals.error
            ? [<Row key="goals-error" title="目标加载失败" subtitle="请确认后端服务" destructive />]
            : goals.data?.length
              ? goals.data.slice(0, 4).map((goal) => (
                <Row key={goal.id} icon={<Target {...iconProps} />} title={goal.title} subtitle={`${goal.status} · 优先级 ${goal.priority}`} onPress={() => router.push("/(app)/(tabs)/settings/goal-settings")} />
              ))
              : [<Row key="goals-empty" icon={<Target {...iconProps} />} title="暂无目标" subtitle="目标会影响计划和教练建议" />]}
      </InsetGroup>

      <InsetGroup header="隐私" insetSeparators>
        <Row icon={<Brain {...iconProps} />} title="Agent 记忆" subtitle="在教练页的记忆面板中管理" value={profile.data ? "可用" : "同步中"} />
        <Row icon={<Download {...iconProps} />} title="导出数据" subtitle="生成脱敏 JSON 文件" onPress={() => router.push("/(app)/(tabs)/settings/data-export")} />
      </InsetGroup>

      <InsetGroup>
        <Row title="退出登录" destructive onPress={requestSignOut} />
      </InsetGroup>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profileAvatar: {
    alignItems: "center",
    borderRadius: radius.pill,
    height: 48,
    justifyContent: "center",
    width: 48
  },
  profileCard: {
    alignItems: "center",
    borderRadius: radius.card,
    flexDirection: "row",
    gap: spacing.md,
    marginHorizontal: 20,
    padding: 18
  },
  profileCopy: { flex: 1, gap: 2 }
});
```

- [ ] **Step 9: Run the focused tests to verify they pass**

Run: `npm test --workspace @hbm/mobile -- src/warmUi.test.ts src/trainingFlows.test.ts`

Expected: PASS. `trainingFlows.test.ts` is untouched and still finds `提交完成` in the rewritten Today screen.

- [ ] **Step 10: Run the full suite and typecheck**

Run: `npm test --workspace @hbm/mobile`

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit`

Expected: both exit 0.

- [ ] **Step 11: Verify on the simulator**

Run: `npm run ios --workspace @hbm/mobile`

Check: Today looks pixel-identical to phase 1 (the header is now the shared component); 数据 shows the 最近 8 天 / 数据 header with shadowed stat and chart cards; 我的 shows the 账户与偏好 / 我的 header with the profile card, and tapping it pushes 个人资料 with a working back button; all five tab glyphs still switch through the capsule.

- [ ] **Step 12: Commit**

```bash
git add apps/mobile/src/components/WarmHeader.tsx "apps/mobile/app/(app)/(tabs)/today/index.tsx" "apps/mobile/app/(app)/(tabs)/today/_layout.tsx" "apps/mobile/app/(app)/(tabs)/insights/_layout.tsx" "apps/mobile/app/(app)/(tabs)/insights/index.tsx" "apps/mobile/app/(app)/(tabs)/settings/_layout.tsx" "apps/mobile/app/(app)/(tabs)/settings/index.tsx" apps/mobile/src/warmUi.test.ts
git commit -m "feat(mobile): extract WarmHeader and migrate insights and settings roots"
```

---

### Task 2: Rebuild the Plan tab with a warm in-page header

Hide Plan's native header, move the 生成/调整/生成中 action from the native `headerRight` to a circular Sparkles `WarmHeaderButton` (spinner while pending), and restyle the week strip and the primary training card as shadowed warm cards with 20pt margins. Every mutation, the 409 "还差一步" guidance path, the three `InsetGroup` lists, and the empty state stay exactly as they are.

**Files:**
- Modify: `apps/mobile/app/(app)/(tabs)/plan/_layout.tsx`
- Modify: `apps/mobile/app/(app)/(tabs)/plan/index.tsx`
- Modify: `apps/mobile/src/warmUi.test.ts`

**Interfaces:**
- Consumes: `WarmHeader`/`WarmHeaderButton` from Task 1; `cardShadow`, `radius.card`, tokens from phase 1.
- Produces: unchanged data behaviour — `generateActivePlan(currentWeekStartIso())`, `confirmCalendarDraft`, and the `["plan", "active"]` / `["today"]` / `["calendar", "drafts"]` query keys keep their exact shapes; `trainingFlows.test.ts` keeps passing untouched.

- [ ] **Step 1: Replace the Plan contract test and extend the WarmHeader loop**

In `apps/mobile/src/warmUi.test.ts`, replace the whole `builds Plan from grouped cards with a card week strip` test with:

```ts
  it("hides the native header and builds Plan around warm cards", () => {
    expect(read("../app/(app)/(tabs)/plan/_layout.tsx")).toContain("headerShown: false");

    const source = read("../app/(app)/(tabs)/plan/index.tsx");

    expect(source).toContain("WarmHeader");
    expect(source).toContain("Sparkles");
    expect(source).toContain("生成或调整本周计划");
    expect(source).toContain("styles.weekStrip");
    expect(source).toContain("cardShadow");
    expect(source).toContain("<InsetGroup");
    expect(source).not.toContain("headerRight");
    expect(source).not.toContain("useNavigation");
  });
```

In the `shares one in-page warm header across the migrated tab roots` test from Task 1, change the loop list from `["today", "insights", "settings"]` to `["today", "plan", "insights", "settings"]`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace @hbm/mobile -- src/warmUi.test.ts`

Expected: FAIL — `plan/_layout.tsx` has no `headerShown: false` yet and `plan/index.tsx` still contains `headerRight`.

- [ ] **Step 3: Hide the Plan native header**

Replace the whole of `apps/mobile/app/(app)/(tabs)/plan/_layout.tsx`:

```tsx
import { Stack } from "expo-router";
import { useNativeHeaderOptions } from "../../../../src/navigation/headerOptions";

export default function PlanLayout() {
  const screenOptions = useNativeHeaderOptions();

  return (
    <Stack screenOptions={screenOptions}>
      {/* Plan draws the shared warm in-page header, so the native large title
          is hidden; the 生成/调整 action lives on the in-page header's
          circular Sparkles button instead of a native headerRight. */}
      <Stack.Screen name="index" options={{ title: "计划", headerShown: false }} />
    </Stack>
  );
}
```

- [ ] **Step 4: Rebuild the Plan screen**

Replace the whole of `apps/mobile/app/(app)/(tabs)/plan/index.tsx`. The `useEffect`/`useNavigation` headerRight machinery is deleted; everything data-related is unchanged:

```tsx
import { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CalendarCheck, Dumbbell, Sparkles, Utensils } from "lucide-react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Screen } from "../../../../src/components/Screen";
import { Text } from "../../../../src/components/Text";
import { Button } from "../../../../src/components/Button";
import { useFeedback } from "../../../../src/components/Feedback";
import { InsetGroup } from "../../../../src/components/InsetGroup";
import { Row } from "../../../../src/components/Row";
import { EmptyState, Spinner } from "../../../../src/components/States";
import { WarmHeader, WarmHeaderButton } from "../../../../src/components/WarmHeader";
import { ApiError } from "../../../../src/api/client";
import { useActivePlanQuery, useCalendarDraftsQuery } from "../../../../src/api/hooks";
import { generateActivePlan } from "../../../../src/api/training";
import { confirmCalendarDraft } from "../../../../src/api/calendar";
import { currentWeekStartIso, formatDateLabel, formatTaskWindow, parseJsonObject, weekDayNumbers } from "../../../../src/ui/format";
import { cardShadow, radius, spacing, useTheme } from "../../../../src/theme/tokens";

const weekNames = ["一", "二", "三", "四", "五", "六", "日"];

// Week-of-year for the overline, derived from the plan's week start so the
// header tracks the plan instead of the device clock.
function planWeekLabel(weekStart: string | undefined): string {
  const start = new Date(weekStart ?? currentWeekStartIso());
  const yearStart = new Date(start.getFullYear(), 0, 1);
  const week = Math.ceil(((start.getTime() - yearStart.getTime()) / 86400000 + yearStart.getDay() + 1) / 7);
  return `第 ${week} 周`;
}

export default function PlanTab() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useActivePlanQuery();
  const drafts = useCalendarDraftsQuery();
  const { notify } = useFeedback();
  const { tokens, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const shadow = cardShadow(isDark ? "dark" : "light");
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const generateMutation = useMutation({
    mutationFn: () => generateActivePlan(currentWeekStartIso()),
    onSuccess: (plan) => {
      queryClient.setQueryData(["plan", "active"], plan);
      void queryClient.invalidateQueries({ queryKey: ["today"] });
      notify({ title: "计划已生成", description: "本周训练和饮食建议已同步。" });
    },
    onError: (err) => {
      // A 409 means a prerequisite is missing and the message tells the user
      // what to set up, so it reads as guidance rather than a failure.
      if (err instanceof ApiError && err.status === 409) {
        notify({ tone: "neutral", title: "还差一步", description: err.message });
        return;
      }
      notify({ tone: "danger", title: "生成失败", description: err instanceof Error ? err.message : "请稍后重试。" });
    }
  });
  const confirmMutation = useMutation({
    mutationFn: confirmCalendarDraft,
    onSuccess: (draft) => {
      void queryClient.invalidateQueries({ queryKey: ["calendar", "drafts"] });
      if (draft.status === "confirmed") {
        notify({ title: "已写入日历", description: "飞书日历已更新。" });
      } else {
        notify({ tone: "danger", title: "写入失败", description: draft.failureReason || "请稍后重试。" });
      }
    },
    onError: (err) => notify({ tone: "danger", title: "确认失败", description: err instanceof Error ? err.message : "请稍后重试。" })
  });
  const nutrition = parseJsonObject(data?.nutritionTargetsJson, {
    proteinTargetGrams: null,
    calorieTarget: "未设置",
    carbohydrateGuidance: "暂无碳水建议"
  });
  const primaryTask = data?.trainingTasks[0];
  const dayNumbers = weekDayNumbers(data?.weekStart ?? currentWeekStartIso());
  const weekDays = weekNames.map((name, index) => ({
    name,
    day: dayNumbers[index],
    active: index === 0
  }));

  return (
    <Screen contentContainerStyle={{ paddingTop: insets.top + spacing.lg }}>
      {/* In-page header: the native header is hidden for this tab, so the
          safe-area top inset is applied manually via contentContainerStyle. */}
      <WarmHeader
        overline={planWeekLabel(data?.weekStart)}
        title="计划"
        actions={
          <WarmHeaderButton
            accessibilityLabel="生成或调整本周计划"
            disabled={generateMutation.isPending}
            onPress={() => generateMutation.mutate()}
          >
            {generateMutation.isPending ? (
              <ActivityIndicator color={tokens.tint} size="small" />
            ) : (
              <Sparkles color={tokens.label} size={18} strokeWidth={1.8} />
            )}
          </WarmHeaderButton>
        }
      />

      <View style={[styles.weekStrip, { backgroundColor: tokens.surface }, shadow]}>
        {weekDays.map((day) => (
          <View key={day.name} style={styles.dayItem}>
            <Text size="caption2" color={tokens.labelSecondary}>周{day.name}</Text>
            <View style={[styles.dayCircle, day.active ? { backgroundColor: tokens.controlFill } : null]}>
              <Text size="callout" color={day.active ? tokens.controlLabel : tokens.label} tabularNums>{day.day}</Text>
            </View>
          </View>
        ))}
      </View>

      {isLoading ? <Spinner /> : error ? (
        <EmptyState title="计划加载失败" description="请稍后重试或重新登录。" />
      ) : data ? (
        <>
          <View style={[styles.primaryCard, { backgroundColor: tokens.surface }, shadow]}>
            <Text size="footnote" color={tokens.tint}>星期一</Text>
            <View style={styles.sessionTitleRow}>
              <View style={[styles.sessionIcon, { backgroundColor: tokens.fill }]}>
                <Dumbbell color={tokens.tint} size={24} strokeWidth={1.8} />
              </View>
              <View style={styles.sessionCopy}>
                <Text size="title2" color={tokens.label}>{primaryTask?.title ?? data.summary}</Text>
                <Text size="subheadline" color={tokens.labelSecondary}>
                  {primaryTask ? `${primaryTask.durationMinutes} 分钟 · ${primaryTask.intensity}` : `${data.trainingTasks.length} 个训练任务`}
                </Text>
              </View>
            </View>
            {primaryTask ? <TrainingTimeline duration={primaryTask.durationMinutes} /> : null}
          </View>

          <InsetGroup header="训练安排">
            {data.trainingTasks.slice(1).flatMap((task) => [
              <Row
                key={task.id}
                title={task.title}
                subtitle={`${formatDateLabel(task.date)} · ${formatTaskWindow(task.scheduledStart, task.scheduledEnd)} · ${task.intensity}`}
                value={`${task.durationMinutes} 分`}
                onPress={() => setExpandedTaskId((current) => (current === task.id ? null : task.id))}
              />,
              ...(expandedTaskId === task.id
                ? task.checklistItems.length
                  ? task.checklistItems.map((item) => (
                    <Row key={`${task.id}-${item.id}`} title={item.label} />
                  ))
                  : [<Row key={`${task.id}-empty`} title="这个任务没有拆分步骤" />]
                : [])
            ])}
          </InsetGroup>

          <InsetGroup header="饮食" insetSeparators>
            <Row
              icon={<Utensils color={tokens.tint} size={20} strokeWidth={1.8} />}
              title="蛋白目标"
              subtitle={String(nutrition.carbohydrateGuidance)}
              value={typeof nutrition.proteinTargetGrams === "number" ? `${nutrition.proteinTargetGrams}g` : "未设置"}
            />
            <Row
              icon={<Utensils color={tokens.tint} size={20} strokeWidth={1.8} />}
              title="热量目标"
              value={String(nutrition.calorieTarget)}
            />
          </InsetGroup>

          <InsetGroup header="日历草稿" insetSeparators>
            {drafts.data?.length ? drafts.data.map((draft) => (
              <Row
                key={draft.id}
                icon={<CalendarCheck color={draft.status === "failed" ? tokens.red : tokens.tint} size={20} strokeWidth={1.8} />}
                title={draft.title}
                subtitle={`${formatTaskWindow(draft.startsAt, draft.endsAt)}${draft.failureReason ? ` · ${draft.failureReason}` : ""}`}
                value={confirmMutation.isPending && confirmMutation.variables === draft.id
                  ? "写入中"
                  : draft.status === "failed" ? "重试" : draft.operation === "cancel" ? "确认取消" : "确认"}
                onPress={() => confirmMutation.mutate(draft.id)}
              />
            )) : <Row title="没有待确认的日历变更" />}
          </InsetGroup>
        </>
      ) : (
        <View style={styles.emptyPlan}>
          <EmptyState title="暂无当前计划" description="生成后，这里会显示一周训练和饮食节奏。" />
          <Button title="生成本周计划" onPress={() => generateMutation.mutate()} disabled={generateMutation.isPending} />
        </View>
      )}
    </Screen>
  );
}

function TrainingTimeline({ duration }: { duration: number }) {
  const { tokens } = useTheme();
  const warmup = 5;
  const cooldown = 5;
  const steady = Math.max(5, duration - warmup - cooldown);
  return (
      <View style={styles.timeline}>
      <View style={styles.timelineTrack}>
        <View style={[styles.trackLine, { backgroundColor: tokens.tint }]} />
        {[0, 1, 2].map((index) => <View key={index} style={[styles.trackDot, { borderColor: tokens.tint, backgroundColor: tokens.surface }]} />)}
      </View>
      <View style={styles.timelineLabels}>
        <View><Text size="footnote" color={tokens.label}>热身</Text><Text size="caption" color={tokens.labelSecondary}>{warmup} 分</Text></View>
        <View style={{ alignItems: "center" }}><Text size="footnote" color={tokens.label}>主体</Text><Text size="caption" color={tokens.labelSecondary}>{steady} 分</Text></View>
        <View style={{ alignItems: "flex-end" }}><Text size="footnote" color={tokens.label}>放松</Text><Text size="caption" color={tokens.labelSecondary}>{cooldown} 分</Text></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dayCircle: { alignItems: "center", borderRadius: 16, height: 32, justifyContent: "center", width: 32 },
  dayItem: { alignItems: "center", flex: 1, gap: spacing.xs },
  emptyPlan: { gap: spacing.lg },
  primaryCard: { borderRadius: radius.card, gap: spacing.lg, marginHorizontal: 20, padding: 18 },
  sessionCopy: { flex: 1, gap: spacing.xs },
  sessionIcon: { alignItems: "center", borderRadius: 24, height: 48, justifyContent: "center", width: 48 },
  sessionTitleRow: { alignItems: "center", flexDirection: "row", gap: spacing.md },
  timeline: { gap: spacing.sm },
  timelineLabels: { flexDirection: "row", justifyContent: "space-between" },
  timelineTrack: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: spacing.md },
  trackDot: { borderRadius: 6, borderWidth: 2, height: 12, width: 12 },
  trackLine: { height: 2, left: 0, position: "absolute", right: 0 },
  weekStrip: {
    borderRadius: radius.card,
    flexDirection: "row",
    marginHorizontal: 20,
    paddingVertical: spacing.md
  }
});
```

- [ ] **Step 5: Run the focused tests to verify they pass**

Run: `npm test --workspace @hbm/mobile -- src/warmUi.test.ts src/trainingFlows.test.ts`

Expected: PASS. `trainingFlows.test.ts` still finds `generateActivePlan`, `currentWeekStartIso`, and `生成本周计划` in the rewritten screen.

- [ ] **Step 6: Run the full suite and typecheck**

Run: `npm test --workspace @hbm/mobile`

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit`

Expected: both exit 0.

- [ ] **Step 7: Verify on the simulator**

Run: `npm run ios --workspace @hbm/mobile`

Check: the 计划 header shows 第 N 周 with the Sparkles circle; tapping it triggers 生成 (spinner in the circle while pending, toast on success, the neutral 还差一步 banner on a 409); the week strip and primary card cast the card shadow; 训练安排/饮食/日历草稿 behave exactly as before; the empty state still offers 生成本周计划.

- [ ] **Step 8: Commit**

```bash
git add "apps/mobile/app/(app)/(tabs)/plan/_layout.tsx" "apps/mobile/app/(app)/(tabs)/plan/index.tsx" apps/mobile/src/warmUi.test.ts
git commit -m "feat(mobile): rebuild the plan tab with a warm in-page header"
```

---

### Task 3: Coach warm finishing, FAB selected state, and Today leftover fixes

Finish the Coach tab's warm treatment surgically — `cardShadow` on the assistant bubble, memory sheet, and history drawer, and a true-circle send button — without touching its composer clearance (landed in commit `672b091`; this task only adds the contract assertion). Then land the three phase-1 leftover fixes: the FAB exposes `accessibilityState={{ selected }}` and a `tint` background while the coach tab is focused, Today's sleep bars become accessible units with per-bar labels, and Today's submit button reaches the 20pt card margin via a 4pt wrapper (`Button`'s global margin is untouched).

**Files:**
- Modify: `apps/mobile/app/(app)/(tabs)/coach/index.tsx` (six small before/after edits, no rewrite)
- Modify: `apps/mobile/src/navigation/FloatingTabBar.tsx` (two small before/after edits)
- Modify: `apps/mobile/app/(app)/(tabs)/today/index.tsx` (three small before/after edits)
- Modify: `apps/mobile/src/navigation/FloatingTabBar.test.tsx` (full replacement)
- Modify: `apps/mobile/src/warmUi.test.ts`

**Interfaces:**
- Consumes: `cardShadow`, `radius.pill`, tokens, `FLOATING_TAB_BAR_CLEARANCE` from phase 1; the `WarmHeader`-based Today file from Task 1.
- Produces: unchanged coach behaviour — `coachLayout.test.ts` and `coachLifecycle.test.ts` keep passing untouched; every mutation and the drawer/sheet animations keep their exact code.
- Produces: `FloatingTabBar` exposing the FAB selected state; Today sleep bars readable by VoiceOver.

- [ ] **Step 1: Add the failing warmUi contract tests**

Append to the `describe` block in `apps/mobile/src/warmUi.test.ts`:

```ts
  it("keeps the coach chrome native and finishes it with warm shadows", () => {
    expect(read("../app/(app)/(tabs)/coach/_layout.tsx")).not.toContain("headerShown: false");

    const source = read("../app/(app)/(tabs)/coach/index.tsx");

    expect(source).toContain("navigation.setOptions");
    expect(source).toContain("headerLeft");
    expect(source).toContain("cardShadow");
    expect(source).toContain("FLOATING_TAB_BAR_CLEARANCE");
    expect(source).not.toContain("BottomTabBarHeightContext");
  });

  it("labels each Today sleep bar and aligns the submit button to the card margin", () => {
    const source = read("../app/(app)/(tabs)/today/index.tsx");

    expect(source).toContain("accessible");
    expect(source).toContain("accessibilityLabel={sleepBarLabel(record)}");
    expect(source).toContain("小时");
    expect(source).toContain("styles.submitWrap");
  });
```

The `FLOATING_TAB_BAR_CLEARANCE` / `BottomTabBarHeightContext` pair is the contract assertion for the composer clearance fix that already landed in commit `672b091` — do not re-fix the composer.

- [ ] **Step 2: Add the failing FAB selected-state tests**

Replace the whole of `apps/mobile/src/navigation/FloatingTabBar.test.tsx`. The `Node` type gains `accessibilityState` and `style`, a `flatten` helper joins style arrays, and two new tests pin the FAB's coach-focused treatment; the four existing tests are unchanged:

```tsx
/* eslint-disable import/first -- component imports must follow Vitest module mocks */
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  Pressable: "Pressable",
  StyleSheet: { create: (styles: unknown) => styles },
  useColorScheme: () => "light",
  View: "View"
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 34, left: 0, right: 0, top: 0 })
}));

vi.mock("lucide-react-native", () => ({ Plus: "Plus" }));

import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { FloatingTabBar } from "./FloatingTabBar";

type Node = {
  type?: unknown;
  props?: {
    accessibilityLabel?: string;
    accessibilityRole?: string;
    accessibilityState?: { selected?: boolean };
    onPress?: () => void;
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

const tabNames = ["today", "plan", "coach", "insights", "settings"] as const;
const tabTitles: Record<(typeof tabNames)[number], string> = {
  today: "今日",
  plan: "计划",
  coach: "教练",
  insights: "数据",
  settings: "我的"
};

function makeProps() {
  const routes = tabNames.map((name) => ({ key: `${name}-key`, name, params: undefined }));
  const descriptors = Object.fromEntries(
    routes.map((route) => [route.key, { options: { title: tabTitles[route.name] } }])
  );
  const navigation = {
    emit: vi.fn(() => ({ defaultPrevented: false })),
    navigate: vi.fn()
  };
  const props = { state: { index: 0, routes }, descriptors, navigation } as unknown as BottomTabBarProps;

  return { navigation, props };
}

function buttons(tree: unknown): Node[] {
  return collect(tree, (element) => element.type === "Pressable");
}

describe("FloatingTabBar", () => {
  it("renders the four visible tabs with Chinese labels and leaves the centre slot to the FAB", () => {
    const tree = FloatingTabBar(makeProps().props);

    expect(buttons(tree).map((button) => button.props?.accessibilityLabel)).toEqual([
      "今日",
      "计划",
      "数据",
      "我的",
      "快速记录"
    ]);
    for (const button of buttons(tree)) {
      expect(button.props?.accessibilityRole).toBe("button");
    }
  });

  it("emits tabPress but does not navigate when the focused tab is pressed", () => {
    const { navigation, props } = makeProps();
    const [today] = buttons(FloatingTabBar(props));

    today.props?.onPress?.();

    expect(navigation.emit).toHaveBeenCalledWith({
      type: "tabPress",
      target: "today-key",
      canPreventDefault: true
    });
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it("navigates to an unfocused tab when pressed", () => {
    const { navigation, props } = makeProps();
    const [, plan] = buttons(FloatingTabBar(props));

    plan.props?.onPress?.();

    expect(navigation.navigate).toHaveBeenCalledWith("plan", undefined);
  });

  it("sends the FAB to the coach tab as the placeholder action", () => {
    const { navigation, props } = makeProps();
    const fab = buttons(FloatingTabBar(props)).find(
      (button) => button.props?.accessibilityLabel === "快速记录"
    );

    fab?.props?.onPress?.();

    expect(navigation.navigate).toHaveBeenCalledWith("coach", undefined);
  });

  it("marks the FAB selected and tinted while the coach tab is focused", () => {
    const { props } = makeProps();
    const focusedProps = {
      ...props,
      state: { ...props.state, index: 2 }
    } as unknown as BottomTabBarProps;
    const fab = buttons(FloatingTabBar(focusedProps)).find(
      (button) => button.props?.accessibilityLabel === "快速记录"
    );

    expect(fab?.props?.accessibilityState).toEqual({ selected: true });
    expect(flatten(fab?.props?.style).backgroundColor).toBe("#3D7A55");
  });

  it("keeps the FAB unselected and dark on the other tabs", () => {
    const fab = buttons(FloatingTabBar(makeProps().props)).find(
      (button) => button.props?.accessibilityLabel === "快速记录"
    );

    expect(fab?.props?.accessibilityState).toEqual({ selected: false });
    expect(flatten(fab?.props?.style).backgroundColor).toBe("#22221F");
  });
});
```

The placeholder-action test is renamed (`as the placeholder action`, dropping the `phase-1` qualifier) because phase 2 keeps the same placeholder — the real FAB action remains a non-goal.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test --workspace @hbm/mobile -- src/warmUi.test.ts src/navigation/FloatingTabBar.test.tsx`

Expected: FAIL — the coach test fails on `cardShadow` (not yet imported in coach), the Today test fails on `sleepBarLabel`, and the two FAB tests fail on `accessibilityState` being `undefined`.

- [ ] **Step 4: Add the warm shadows to Coach (six surgical edits)**

All edits are in `apps/mobile/app/(app)/(tabs)/coach/index.tsx`. Nothing else in the file changes — the composer dock, message list, drawer animation, and all mutations stay byte-identical.

Edit 1 — import `cardShadow`. Replace:

```tsx
import { opacity, radius, spacing, useTheme } from "../../../../src/theme/tokens";
```

with:

```tsx
import { cardShadow, opacity, radius, spacing, useTheme } from "../../../../src/theme/tokens";
```

Edit 2 — `CoachTab` needs `isDark` for the sheet and drawer shadows. Replace:

```tsx
  const { confirm } = useFeedback();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
```

with:

```tsx
  const { confirm } = useFeedback();
  const { tokens, isDark } = useTheme();
  const insets = useSafeAreaInsets();
```

Edit 3 — memory sheet shadow. Replace:

```tsx
          <Pressable
            style={[
              styles.memorySheet,
              { backgroundColor: tokens.surface, borderColor: tokens.separator, paddingBottom: Math.max(insets.bottom, spacing.lg) }
            ]}
```

with:

```tsx
          <Pressable
            style={[
              styles.memorySheet,
              { backgroundColor: tokens.surface, borderColor: tokens.separator, paddingBottom: Math.max(insets.bottom, spacing.lg) },
              cardShadow(isDark ? "dark" : "light")
            ]}
```

Edit 4 — history drawer shadow. Replace:

```tsx
          <Animated.View
            style={[
              styles.conversationDrawer,
              {
```

with:

```tsx
          <Animated.View
            style={[
              styles.conversationDrawer,
              cardShadow(isDark ? "dark" : "light"),
              {
```

Edit 5 — assistant bubble shadow. Replace:

```tsx
function MessageBubble({ message, onUndo }: { message: AgentMessage; onUndo: (adjustment: AgentAdjustment) => void }) {
  const { tokens } = useTheme();
  const isUser = message.role === "user";
```

with:

```tsx
function MessageBubble({ message, onUndo }: { message: AgentMessage; onUndo: (adjustment: AgentAdjustment) => void }) {
  const { tokens, isDark } = useTheme();
  const isUser = message.role === "user";
```

and replace:

```tsx
        <View style={[styles.assistantContent, { backgroundColor: tokens.surface }]}>
```

with:

```tsx
        <View style={[styles.assistantContent, { backgroundColor: tokens.surface }, cardShadow(isDark ? "dark" : "light")]}>
```

Edit 6 — the send button becomes a true circle via the token. In the `StyleSheet.create` block, replace:

```tsx
  sendButton: { alignItems: "center", borderRadius: 16, height: 32, justifyContent: "center", width: 32 },
```

with:

```tsx
  sendButton: { alignItems: "center", borderRadius: radius.pill, height: 32, justifyContent: "center", width: 32 },
```

The composer TextInput keeps `radius.bubble`: it is `multiline` (maxHeight 110), and the spec's pill treatment only applies at single-line height — already satisfied, no edit. The composer dock's `paddingBottom: spacing.sm + insets.bottom + FLOATING_TAB_BAR_CLEARANCE` from commit `672b091` is deliberately untouched.

- [ ] **Step 5: Expose the FAB selected state**

Two edits in `apps/mobile/src/navigation/FloatingTabBar.tsx`.

Edit 1 — derive the coach-focused flag. Replace:

```tsx
  const coachRoute = state.routes[FAB_ROUTE_INDEX];
```

with:

```tsx
  const coachRoute = state.routes[FAB_ROUTE_INDEX];
  // The coach capsule slot is a spacer, so the FAB doubles as the coach tab's
  // selected indicator: VoiceOver gets `selected` and the fill turns to tint.
  const coachFocused = state.index === FAB_ROUTE_INDEX;
```

Edit 2 — the FAB itself. Replace:

```tsx
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="快速记录"
        onPress={() => {
          if (coachRoute) {
            navigation.navigate(coachRoute.name, coachRoute.params);
          }
        }}
        style={[styles.fab, { backgroundColor: tokens.controlFill }, shadow]}
      >
        <Plus color={tokens.controlLabel} size={26} strokeWidth={2.2} />
      </Pressable>
```

with:

```tsx
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: coachFocused }}
        accessibilityLabel="快速记录"
        onPress={() => {
          if (coachRoute) {
            navigation.navigate(coachRoute.name, coachRoute.params);
          }
        }}
        style={[styles.fab, { backgroundColor: coachFocused ? tokens.tint : tokens.controlFill }, shadow]}
      >
        <Plus color={tokens.controlLabel} size={26} strokeWidth={2.2} />
      </Pressable>
```

The FAB's position in the a11y tree (after the four tab buttons) is unchanged — the spec documents this order as acceptable.

- [ ] **Step 6: Land the Today leftover fixes**

Three edits in `apps/mobile/app/(app)/(tabs)/today/index.tsx`.

Edit 1 — the per-bar label helper. Replace:

```tsx
function weekdayLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : weekdayFormat.format(date);
}
```

with:

```tsx
function weekdayLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : weekdayFormat.format(date);
}

// VoiceOver reads each sleep bar as one unit, e.g. 周二睡眠 8 小时 35 分.
function sleepBarLabel(record: { date: string; durationMinutes: number }): string {
  const hours = Math.floor(record.durationMinutes / 60);
  const rest = record.durationMinutes % 60;
  const duration = rest > 0 ? `${hours} 小时 ${rest} 分` : `${hours} 小时`;
  return `${weekdayLabel(record.date)}睡眠 ${duration}`;
}
```

Edit 2 — each bar column becomes an accessible unit. Replace:

```tsx
                {weekSleep.map((record, index) => (
                  <View key={record.id} style={styles.barCol}>
```

with:

```tsx
                {weekSleep.map((record, index) => (
                  <View
                    key={record.id}
                    accessible
                    accessibilityLabel={sleepBarLabel(record)}
                    style={styles.barCol}
                  >
```

Edit 3 — the submit button reaches the 20pt card margin by wrapping (`Button` keeps its global 16pt margin; 16 + 4 = 20). Replace:

```tsx
      <Button
        title={alreadyRecorded ? "已记录" : completionMutation.isPending ? "提交中" : "提交完成"}
        disabled={alreadyRecorded || completionMutation.isPending}
        onPress={() => completionMutation.mutate()}
      />
```

with:

```tsx
      {/* Button's global 16pt margin plus this 4pt wrap equals the 20pt card
          margin, without changing Button for every other screen. */}
      <View style={styles.submitWrap}>
        <Button
          title={alreadyRecorded ? "已记录" : completionMutation.isPending ? "提交中" : "提交完成"}
          disabled={alreadyRecorded || completionMutation.isPending}
          onPress={() => completionMutation.mutate()}
        />
      </View>
```

and in the `StyleSheet.create` block, append after the `rowDivider` entry:

```tsx
  submitWrap: { marginHorizontal: spacing.xs }
```

(keep the trailing comma on `rowDivider`'s line valid: `rowDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: spacing.lg },`).

- [ ] **Step 7: Run the focused tests to verify they pass**

Run: `npm test --workspace @hbm/mobile -- src/warmUi.test.ts src/navigation/FloatingTabBar.test.tsx src/coachLayout.test.ts src/coachLifecycle.test.ts src/trainingFlows.test.ts`

Expected: PASS — the new contract and FAB tests pass, and the untouched coach/training behavior suites stay green.

- [ ] **Step 8: Run the full suite and typecheck**

Run: `npm test --workspace @hbm/mobile`

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit`

Expected: both exit 0.

- [ ] **Step 9: Verify on the simulator**

Run: `npm run ios --workspace @hbm/mobile`

Check: coach bubbles, the memory sheet, and the history drawer cast the card shadow; the send button is a perfect circle; focusing 教练 turns the FAB `tint` and VoiceOver announces 快速记录 selected; VoiceOver on Today's sleep card reads each bar as 周X睡眠 N 小时 M 分; the submit button's edges align with the cards above it; the composer still clears the capsule, including with the keyboard open.

- [ ] **Step 10: Commit**

```bash
git add "apps/mobile/app/(app)/(tabs)/coach/index.tsx" apps/mobile/src/navigation/FloatingTabBar.tsx "apps/mobile/app/(app)/(tabs)/today/index.tsx" apps/mobile/src/navigation/FloatingTabBar.test.tsx apps/mobile/src/warmUi.test.ts
git commit -m "feat(mobile): finish warm coach chrome, FAB selected state, and today a11y fixes"
```

---

### Task 4: Settings detail alignment and auth header metrics

The eight settings detail pages keep their native inline headers and `InsetGroup` content; the only change is a uniform `paddingTop: spacing.lg` on each `Screen` so their top rhythm matches the in-page-header tabs. The auth login/register screens keep their structure and swap `size="largeTitle"` for the warm header metrics (30pt `weight="strong"` title + subheadline).

**Files:**
- Modify: all eight detail pages under `apps/mobile/app/(app)/(tabs)/settings/` (`profile-settings.tsx`, `account-security.tsx`, `healthkit-settings.tsx`, `model-settings.tsx`, `connection-settings.tsx`, `notification-settings.tsx`, `goal-settings.tsx`, `data-export.tsx`)
- Modify: `apps/mobile/app/(auth)/login.tsx`, `apps/mobile/app/(auth)/register.tsx`
- Modify: `apps/mobile/src/warmUi.test.ts`

**Interfaces:**
- Consumes: `Screen`'s `contentContainerStyle` passthrough from phase 1; `spacing` from tokens.
- Produces: unchanged forms and mutations — `saveProfile`, `changePassword`, `deleteAccount`, `syncHealthKit`, `saveSettings`, `enableTrainingNotifications`, goal CRUD, `exportAccountData`, and the auth actions keep their exact call shapes.

- [ ] **Step 1: Add the failing contract tests**

Append to the `describe` block in `apps/mobile/src/warmUi.test.ts`:

```ts
  it("aligns the settings detail pages with the in-page-header rhythm", () => {
    for (const screen of detailScreens) {
      const source = read(`../app/(app)/(tabs)/settings/${screen}.tsx`);

      expect(source).toContain("contentContainerStyle={{ paddingTop: spacing.lg }}");
    }
  });

  it("gives the auth screens the warm header metrics", () => {
    for (const screen of ["login", "register"]) {
      const source = read(`../app/(auth)/${screen}.tsx`);

      expect(source).toContain('size="title1"');
      expect(source).toContain('weight="strong"');
      expect(source).toContain("fontSize: 30");
      expect(source).not.toContain('size="largeTitle"');
    }
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --workspace @hbm/mobile -- src/warmUi.test.ts`

Expected: FAIL — the detail pages have no `contentContainerStyle` yet and the auth screens still say `size="largeTitle"`.

- [ ] **Step 3: Align the eight settings detail pages**

One mechanical change per page: pass `contentContainerStyle={{ paddingTop: spacing.lg }}` to `Screen`. Four pages already import `spacing`; four need the import added.

- `profile-settings.tsx` (`spacing` already imported): replace `<Screen>` with `<Screen contentContainerStyle={{ paddingTop: spacing.lg }}>` (one occurrence).
- `goal-settings.tsx` (`spacing` already imported): same replacement (one occurrence).
- `model-settings.tsx` (`spacing` already imported): same replacement for **both** occurrences — the early-return loading `Screen` and the main one.
- `connection-settings.tsx` (`spacing` already imported): same replacement for **both** occurrences.
- `account-security.tsx`: replace

  ```tsx
  import { useAuth } from "../../../../src/auth/AuthContext";
  ```

  with:

  ```tsx
  import { useAuth } from "../../../../src/auth/AuthContext";
  import { spacing } from "../../../../src/theme/tokens";
  ```

  then replace `<Screen>` with `<Screen contentContainerStyle={{ paddingTop: spacing.lg }}>` (one occurrence).
- `healthkit-settings.tsx`: replace

  ```tsx
  import { syncHealthKit } from "../../../../src/healthKit";
  ```

  with:

  ```tsx
  import { syncHealthKit } from "../../../../src/healthKit";
  import { spacing } from "../../../../src/theme/tokens";
  ```

  then the same `<Screen>` replacement (one occurrence).
- `notification-settings.tsx`: replace

  ```tsx
  import { enableTrainingNotifications } from "../../../../src/notifications";
  ```

  with:

  ```tsx
  import { enableTrainingNotifications } from "../../../../src/notifications";
  import { spacing } from "../../../../src/theme/tokens";
  ```

  then the same `<Screen>` replacement (one occurrence).
- `data-export.tsx`: replace

  ```tsx
  import { exportAccountData } from "../../../../src/api/export";
  ```

  with:

  ```tsx
  import { exportAccountData } from "../../../../src/api/export";
  import { spacing } from "../../../../src/theme/tokens";
  ```

  then the same `<Screen>` replacement (one occurrence).

Nothing else changes on these pages: native inline headers and titles stay, the goal editor and 危险操作 groups remain `InsetGroup` lists at the 16pt inset (shared decision 2 in the spec — they are list groups, not full-width cards, so the 20pt treatment does not apply), and `ChoiceGroup` keeps its segmented style.

- [ ] **Step 4: Restyle the auth headers**

In `apps/mobile/app/(auth)/login.tsx`, replace:

```tsx
      <View style={styles.header}>
        <Text size="largeTitle" color={tokens.label}>登录</Text>
        <Text size="subheadline" color={tokens.labelSecondary}>Healthy Body Manager</Text>
      </View>
```

with:

```tsx
      <View style={styles.header}>
        <Text size="title1" weight="strong" style={styles.pageTitle}>登录</Text>
        <Text size="subheadline" color={tokens.labelSecondary}>Healthy Body Manager</Text>
      </View>
```

and replace the styles block:

```tsx
const styles = StyleSheet.create({
  actions: { gap: spacing.md },
  header: { gap: spacing.xs, paddingHorizontal: spacing.lg, paddingTop: spacing.xxl }
});
```

with:

```tsx
const styles = StyleSheet.create({
  actions: { gap: spacing.md },
  header: { gap: spacing.xs, paddingHorizontal: spacing.lg, paddingTop: spacing.xxl },
  pageTitle: { fontSize: 30, letterSpacing: -0.5, lineHeight: 36, marginTop: 2 }
});
```

In `apps/mobile/app/(auth)/register.tsx`, replace both header blocks:

```tsx
        <View style={styles.header}>
          <Text size="largeTitle" color={tokens.label}>请查收邮件</Text>
```

with:

```tsx
        <View style={styles.header}>
          <Text size="title1" weight="strong" style={styles.pageTitle}>请查收邮件</Text>
```

and:

```tsx
      <View style={styles.header}>
        <Text size="largeTitle" color={tokens.label}>注册</Text>
```

with:

```tsx
      <View style={styles.header}>
        <Text size="title1" weight="strong" style={styles.pageTitle}>注册</Text>
```

and replace the styles block:

```tsx
const styles = StyleSheet.create({
  actions: { gap: spacing.md },
  header: { gap: spacing.xs, paddingHorizontal: spacing.lg, paddingTop: spacing.xxl }
});
```

with:

```tsx
const styles = StyleSheet.create({
  actions: { gap: spacing.md },
  header: { gap: spacing.xs, paddingHorizontal: spacing.lg, paddingTop: spacing.xxl },
  pageTitle: { fontSize: 30, letterSpacing: -0.5, lineHeight: 36, marginTop: 2 }
});
```

The auth header keeps its 16pt horizontal padding: it sits above the `InsetGroup` form (16pt inset) and pill `Button`s (16pt margin), so 16pt is the aligned value there — the warm metric change is the title, not the margin.

- [ ] **Step 5: Run the focused tests to verify they pass**

Run: `npm test --workspace @hbm/mobile -- src/warmUi.test.ts`

Expected: PASS.

- [ ] **Step 6: Run the full suite and typecheck**

Run: `npm test --workspace @hbm/mobile`

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit`

Expected: both exit 0.

- [ ] **Step 7: Verify on the simulator**

Run: `npm run ios --workspace @hbm/mobile`

Check: each settings detail page pushes with its Chinese inline title and back button, and the first card's top spacing matches across pages; login and register show the smaller warm title above the form; 注册 → 请查收邮件 keeps the same metrics.

- [ ] **Step 8: Commit**

```bash
git add "apps/mobile/app/(app)/(tabs)/settings" "apps/mobile/app/(auth)/login.tsx" "apps/mobile/app/(auth)/register.tsx" apps/mobile/src/warmUi.test.ts
git commit -m "feat(mobile): align settings detail pages and auth headers with warm metrics"
```

---

### Task 5: Full verification and manual QA

Phase 2 is code-complete: every screen now speaks the warm language. Run every gate, then walk the whole app in both appearances.

**Files:**
- Modify: only files touched by fixes the verification surfaces (ideally none).

**Interfaces:**
- Consumes: everything from Tasks 1–4.

- [ ] **Step 1: Full mobile suite**

Run: `npm test --workspace @hbm/mobile`

Expected: exit 0 — the extended `warmUi.test.ts` contract suite, the six `FloatingTabBar` tests, and every pre-existing suite (`trainingFlows`, `coachLayout`, `coachLifecycle`, `coachMessages`, component tests) green, with the behavior suites byte-untouched.

- [ ] **Step 2: Typecheck**

Run: `npx tsc -p apps/mobile/tsconfig.json --noEmit`

Expected: exit 0.

- [ ] **Step 3: Lint**

Run: `npm run lint --workspace @hbm/mobile`

Expected: exit 0. In particular no unused-import warnings in the rewritten screens (`Pressable` left Today and Plan with their hand-rolled headers; `useNavigation`/`useEffect` left Plan; `size="largeTitle"` left the auth screens).

- [ ] **Step 4: Repo-root suite**

Run: `npm test`

Expected: exit 0 — the backend and web suites are untouched by this plan.

- [ ] **Step 5: Manual QA pass**

Run: `npm run ios --workspace @hbm/mobile`

Walk the checklist:
- All five tabs switch through the capsule; the FAB turns `tint` and announces selected only on 教练; the capsule and FAB shadows are unchanged.
- 今日: unchanged from phase 1 except the aligned submit button and the VoiceOver sleep-bar labels.
- 计划: 第 N 周 overline; Sparkles circle runs 生成 with an in-circle spinner while pending; the 409 还差一步 toast still fires on a fresh account; week strip and primary card shadows; expand a 训练安排 row; confirm a 日历草稿 row; empty state generates a plan.
- 数据: 最近 8 天 overline; stat and chart cards shadowed; `TrendChart`'s `tint` line and `separator` baseline read well on the warm `surface` — check this specifically in dark mode (spec risk item).
- 教练: native inline header with the three `tint` icon actions; bubbles/sheet/drawer shadows; circular send button; open the keyboard and confirm the composer and the latest message stay clear of the capsule (spec acceptance item — `KeyboardAvoidingView` plus the `672b091` clearance); memory sheet add/edit/delete still works; drawer open/close animation unchanged.
- 我的: 账户与偏好 overline; profile card pushes 个人资料; automation group expands; 退出登录 confirm still works; every detail page pushes with back button.
- Auth: log out, then log in and register — headers use the warm 30pt title; verification resend flow unchanged.
- Toggle dark mode (Features > Toggle Appearance) and re-walk all five tabs: cards `#252421`, shadows subtle, coach bubbles and the FAB tint legible.
- Enable VoiceOver: tab buttons and FAB announce as before plus the FAB selected state on 教练; WarmHeader buttons announce 查看本周计划 and 生成或调整本周计划; sleep bars announce 周X睡眠 N 小时 M 分.
- Set Dynamic Type to the largest accessibility size: warm headers grow without truncation, the week strip day circles stay aligned, and no card clips its content.
- Enable Increase Contrast: filled buttons, the FAB glyph, and the Sparkles icon stay legible in both appearances. Reduce Transparency remains a no-op (no blur anywhere).

- [ ] **Step 6: Commit any fixes**

If QA surfaced fixes, commit them:

```bash
git add -A apps/mobile
git commit -m "fix(mobile): address warm card phase 2 QA findings"
```

If the tree is clean, skip the commit — do not create an empty one.

---

## Self-Review

**Spec coverage.** Every spec bullet maps to a task. Shared decision 1 (tab-root headers go in-page; Plan/Insights/Settings hide native headers; coach keeps its native inline header with tint icon actions — already `tint`, asserted, untouched) → Tasks 1–2 (layouts + `WarmHeader`) and Task 3 (coach contract). Shared decision 2 (settings detail pages keep native inline headers, alignment only) → Task 4. Shared decision 3 (20pt warm cards, 16pt `InsetGroup`, Today submit button fixed by wrapping) → Tasks 1–2 (card margins), Task 3 (submit wrap), Task 4 (detail pages keep 16pt groups). Shared decision 4 (composer clearance) → already landed in `672b091`; Task 3 adds the contract assertion and deliberately does not re-fix it. Shared decision 5 (FAB a11y selected + tint) → Task 3. Shared decision 6 (sleep bars a11y) → Task 3. Plan tab (overline 第 N 周 + 计划, Sparkles action with pending spinner, no `headerRight`, warm week strip and primary card, unchanged 训练安排/饮食/日历草稿 groups, unchanged 409 `Feedback` path and empty state) → Task 2. Insights tab (最近 8 天 + 数据, warm stat card with `size="metric"` ±Δ%, warm chart card wrapping `TrendChart` with first/last labels, unchanged 分析 group) → Task 1. Coach (bubble/sheet/drawer `cardShadow`, pill send button, composer clearance assertion, header actions untouched, ~780-line file edited via six small before/after blocks, not rewritten) → Task 3. Settings root (账户与偏好 + 我的, warm profile card with avatar circle/name/email, five groups + destructive sign-out unchanged, absolute `router.push` paths unchanged) → Task 1. Eight detail pages (headers and titles kept, `paddingTop` alignment, `ChoiceGroup` untouched) → Task 4. Auth (structure unchanged, 30pt `weight="strong"` titles on login + both register headers) → Task 4. Tests section of the spec (`headerShown: false` assertions, Sparkles/no-`headerRight`, composer `FLOATING_TAB_BAR_CLEARANCE` + no `BottomTabBarHeightContext`, profile card, auth metrics, `FloatingTabBar.test.tsx` FAB selected state, sleep-bar labels, untouched behavior suites) → Tasks 1–4 test steps; acceptance commands (mobile suite, `tsc`, lint, repo-root `npm test`) → every task's final steps plus Task 5. Non-goals respected: FAB still navigates to Coach as a placeholder; no endpoint or data-shape changes; no custom fonts/gradients/blur; `InsetGroup`/`Row` kept.

**Placeholder scan.** Every code step carries complete pasteable content: full files for `WarmHeader.tsx`, `today/index.tsx`, `today/_layout.tsx`, `insights/_layout.tsx` + `index.tsx`, `settings/_layout.tsx` + `index.tsx`, `plan/_layout.tsx` + `index.tsx`, and `FloatingTabBar.test.tsx`; exact before/after blocks for the six coach edits, two `FloatingTabBar` edits, three Today edits, the eight detail-page edits (with exact import anchors for the four pages missing `spacing`), and the login/register edits (both register headers and both styles blocks shown in full). Every warmUi test addition or replacement is given in full, and the tests being replaced are named exactly (`builds Insights from a stat card, a chart card, and a grouped list`, `hides the native header and builds Today from warm cards`, `builds Plan from grouped cards with a card week strip`, plus the Task-1 loop list edit in `shares one in-page warm header`). No TBDs, no "similar to Task N".

**Type consistency.** `WarmHeader`/`WarmHeaderButton` are defined in Task 1 before Plan consumes them in Task 2; the Task-1 contract loop covers only the tabs migrated so far, and Task 2 Step 1 extends it — no intermediate red state. `WarmHeaderButton.disabled` exists in Task 1 but is first consumed by Plan's pending state in Task 2 (legal optional prop, `tsc` clean). `planWeekLabel` consumes `currentWeekStartIso`, already imported by Plan. `sleepBarLabel`'s structural parameter `{ date: string; durationMinutes: number }` matches the sleep record shape Today's `weekSleep` already maps over. `cardShadow(isDark ? "dark" : "light")` is used identically in WarmHeader, Insights, Settings, Plan, and the coach edits; `CoachTab` and `MessageBubble` each destructure `isDark` in the scope that uses it. The FAB test's `flatten` helper mirrors the one in `InsetGroup.test.tsx`; `state.index: 2` matches `FAB_ROUTE_INDEX`. The auth `pageTitle` style metrics are byte-identical to `WarmHeader`'s, which is what the contract assertion (`fontSize: 30`) pins. One deliberate spec deviation: the spec says the coach message list gets the same bottom clearance as the composer, but the landed `672b091` implementation clears via the in-flow composer dock's `paddingBottom`, which already lifts the list above the capsule — duplicating 110pt+ on `messageList` would add dead space. The plan asserts the landed behavior; revisit only if the dock ever becomes absolutely positioned. Two documented derivations: 第 N 周 is a week-of-year computed from `weekStart` (no backend field carries it), and `headerCopy: { flex: 1 }` replaces Today's unstyled title wrapper so long overlines wrap before hitting the action button — visually identical at default Dynamic Type.

## Risks

- **Hiding native headers on three more tabs removes collapse-on-scroll there.** Intended (warm headers are static) and called out in each layout's comment so it is not "fixed" later — flagged in the spec's risk list.
- **Composer clearance interacts with `KeyboardAvoidingView`.** The `672b091` clearance plus iOS padding behavior must be verified with the keyboard open in the simulator; it is Task 3 Step 9 and Task 5 Step 5 acceptance items.
- **Coach is the largest file in the app (~780 lines).** The plan keeps edits to six exact before/after blocks and pins them with `coachLayout.test.ts`/`coachLifecycle.test.ts` staying green untouched; if any `old` block fails to match, stop and re-read the file rather than improvising a rewrite.
- **TrendChart contrast on warm `surface` in dark mode** has no visual source; the dark-mode QA pass (Task 5 Step 5) is its acceptance check — expect to tune the `separator` baseline or dot fills there.
- **The FAB's `tint` selected fill is new.** `controlLabel` is the foreground in both schemes (near-white on `#3D7A55` light, near-black on `#5FA97E` dark); the Task 5 Increase-Contrast and dark-mode checks cover legibility. The a11y-tree order (FAB after the four tab buttons) is unchanged and documented as acceptable in the spec.
- **`paddingTop: spacing.lg` on detail pages** stacks with `contentInsetAdjustmentBehavior="automatic"` under the inline native header; it matches the in-page-header tabs' rhythm but is a visual derivation of the spec's "page top padding consistent" — verify on a small device in Task 5.
