import { useCallback, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Footprints, Gauge, Heart, UtensilsCrossed } from "lucide-react-native";
import { Screen } from "../../../../src/components/Screen";
import { Text } from "../../../../src/components/Text";
import { Button } from "../../../../src/components/Button";
import { CheckRow } from "../../../../src/components/CheckRow";
import { useFeedback } from "../../../../src/components/Feedback";
import { EmptyState, Spinner } from "../../../../src/components/States";
import { TextField } from "../../../../src/components/TextField";
import { ReadinessRing } from "../../../../src/components/QuietHealth";
import { RecentSyncIndicator } from "../../../../src/components/RecentSyncIndicator";
import { WarmHeader, WarmHeaderButton } from "../../../../src/components/WarmHeader";
import { useRecoveryQuery, useTodayOverviewQuery } from "../../../../src/api/hooks";
import { syncCoros } from "../../../../src/api/sync";
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

const RECENT_SYNC_DAYS = 2;

const weekdayFormat = new Intl.DateTimeFormat("zh-CN", {
  timeZone: APP_TIME_ZONE,
  weekday: "short"
});

function weekdayLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : weekdayFormat.format(date);
}

/** Latest value vs the week's average for one recovery metric (resting heart
 *  rate, stress). The newest record often has only the recovery percent, so
 *  the value comes from the most recent record that carries the field; nulls
 *  are dropped from the average; missing data → null. */
function vitalDelta(records: { restingHeartRateBpm?: number | null; stressLevel?: number | null }[], key: "restingHeartRateBpm" | "stressLevel") {
  const latest = records.find((record) => record[key] != null)?.[key] ?? null;
  const values = records.flatMap((record) => (record[key] == null ? [] : [record[key]!]));
  const average = values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
  const delta = latest != null && average != null ? latest - average : null;
  return { latest, delta };
}

export default function TodayTab() {
  const { data, isLoading, error } = useTodayOverviewQuery();
  const recoveryWeek = useRecoveryQuery(7);
  const { tokens, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { notify } = useFeedback();
  const [refreshing, setRefreshing] = useState(false);
  const shadow = cardShadow(isDark ? "dark" : "light");
  const recovery = typeof data?.latestRecovery?.recoveryPercent === "number" ? data.latestRecovery.recoveryPercent : 0;
  const sleepMinutes = typeof data?.latestSleep?.durationMinutes === "number" ? data.latestSleep.durationMinutes : null;
  const activityMinutes = data?.todayTasks.reduce((sum, task) => sum + task.durationMinutes, 0) ?? 0;
  const focusTask = data?.todayTasks[0];
  const heartRate = vitalDelta(recoveryWeek.data ?? [], "restingHeartRateBpm");
  const stress = vitalDelta(recoveryWeek.data ?? [], "stressLevel");

  const refreshRecentData = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await syncCoros({ days: RECENT_SYNC_DAYS });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["today"] }),
        queryClient.invalidateQueries({ queryKey: ["insights"] }),
        queryClient.invalidateQueries({ queryKey: ["plan", "active"] })
      ]);
      notify({
        title: "近两日数据已同步",
        description: `运动 ${result.activities} · 睡眠 ${result.sleep} · 恢复 ${result.recovery}`
      });
    } catch (err) {
      notify({
        tone: "danger",
        title: "同步失败",
        description: err instanceof Error ? err.message : "请稍后重试。"
      });
    } finally {
      setRefreshing(false);
    }
  }, [notify, queryClient]);

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <Screen
        contentContainerStyle={{ gap: spacing.lg, paddingTop: insets.top + spacing.lg }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void refreshRecentData();
            }}
            tintColor="transparent"
            colors={["transparent"]}
            progressBackgroundColor="transparent"
          />
        }
      >
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

          {/* Resting heart rate and stress, side by side. Sleep bars moved to
              the Insights tab, which owns the weekly charts. */}
          <View style={styles.cardRow}>
            <VitalCard icon="heart" title="静息心率" unit="bpm" vital={heartRate} shadow={shadow} />
            <VitalCard icon="gauge" title="压力" unit="" vital={stress} shadow={shadow} />
          </View>

          {data.mealMenus.length > 0 ? (
            <View style={[styles.card, { backgroundColor: tokens.surface }, shadow]}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeaderLeft}>
                  <View style={[styles.iconTile, { backgroundColor: tokens.fill }]}>
                    <UtensilsCrossed color={tokens.orange} size={16} strokeWidth={1.8} />
                  </View>
                  <Text size="callout" weight="semibold">
                    今日饮食
                  </Text>
                </View>
                <Text size="footnote" color={tokens.labelSecondary}>
                  {`${data.mealMenus.length} 餐`}
                </Text>
              </View>
              {data.mealMenus.map((menu, menuIndex) => (
                <View
                  key={`${menu.meal}-${menuIndex}`}
                  style={[
                    styles.mealGroup,
                    menuIndex > 0 ? { borderTopColor: tokens.separator, borderTopWidth: StyleSheet.hairlineWidth } : null
                  ]}
                >
                  <Text size="footnote" weight="semibold" color={tokens.labelSecondary}>
                    {mealLabel(menu.meal)}
                  </Text>
                  {menu.items.map((item, itemIndex) => (
                    <View key={`${item.name}-${itemIndex}`} style={styles.mealItemRow}>
                      <Text size="subheadline" color={tokens.label} style={styles.mealItemName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text size="caption" color={tokens.labelSecondary}>
                        {item.calories} kcal · 蛋白 {item.proteinGrams}g
                      </Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          ) : null}

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
      <RecentSyncIndicator visible={refreshing} top={insets.top + spacing.sm} />
    </View>
  );
}

function nextChecklistStatus(status: ChecklistStatus): ChecklistStatus {
  if (status === "pending") return "completed";
  if (status === "completed") return "skipped";
  return "pending";
}

function mealLabel(meal: string): string {
  if (meal === "breakfast") return "早餐";
  if (meal === "lunch") return "午餐";
  if (meal === "dinner") return "晚餐";
  return meal;
}

type Vital = { latest: number | null; delta: number | null };

/** Half-width card with the latest reading and its delta from the week
 *  average. For both metrics lower is better, so a negative delta is tint. */
function VitalCard({
  icon,
  title,
  unit,
  vital,
  shadow
}: {
  icon: "heart" | "gauge";
  title: string;
  unit: string;
  vital: Vital;
  shadow: ReturnType<typeof cardShadow>;
}) {
  const { tokens } = useTheme();
  const deltaText =
    vital.latest == null
      ? "暂无记录"
      : vital.delta == null || vital.delta === 0
        ? "与周均持平"
        : `较周均 ${vital.delta > 0 ? "+" : ""}${vital.delta}`;
  const deltaColor = vital.delta == null || vital.delta === 0
    ? tokens.labelSecondary
    : vital.delta < 0
      ? tokens.tint
      : tokens.orange;

  return (
    <View
      accessible
      accessibilityLabel={`${title} ${vital.latest ?? "无数据"}${unit ? ` ${unit}` : ""},${deltaText}`}
      style={[styles.card, styles.halfCard, { backgroundColor: tokens.surface }, shadow]}
    >
      <View style={styles.cardHeaderLeft}>
        <View style={[styles.iconTile, { backgroundColor: tokens.fill }]}>
          {icon === "heart" ? (
            <Heart color={tokens.red} size={16} strokeWidth={1.8} />
          ) : (
            <Gauge color={tokens.orange} size={16} strokeWidth={1.8} />
          )}
        </View>
        <Text size="callout" weight="semibold">
          {title}
        </Text>
      </View>
      <Text size="title1" weight="strong" tabularNums>
        {vital.latest ?? "—"}
        {vital.latest != null && unit ? (
          <Text size="footnote" color={tokens.labelSecondary}>{` ${unit}`}</Text>
        ) : null}
      </Text>
      <Text size="footnote" color={deltaColor}>
        {deltaText}
      </Text>
    </View>
  );
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

      {/* Button's global 16pt margin plus this 4pt wrap equals the 20pt card
          margin, without changing Button for every other screen. */}
      <View style={styles.submitWrap}>
        <Button
          title={alreadyRecorded ? "已记录" : completionMutation.isPending ? "提交中" : "提交完成"}
          disabled={alreadyRecorded || completionMutation.isPending}
          onPress={() => completionMutation.mutate()}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, gap: 14, marginHorizontal: 20, padding: 18 },
  cardHeaderLeft: { alignItems: "center", flexDirection: "row", gap: 10 },
  cardHeaderRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  cardRow: { flexDirection: "row", gap: 12, marginHorizontal: 20 },
  halfCard: { flex: 1, gap: 8, marginHorizontal: 0, padding: 14 },
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
  mealGroup: { gap: spacing.xs, paddingTop: spacing.sm },
  mealItemName: { flex: 1 },
  mealItemRow: { alignItems: "baseline", flexDirection: "row", gap: spacing.sm, justifyContent: "space-between" },
  rowDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: spacing.lg },
  screen: { flex: 1 },
  submitWrap: { marginHorizontal: spacing.xs }
});
