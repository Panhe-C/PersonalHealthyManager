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
