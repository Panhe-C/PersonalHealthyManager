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
