import { StyleSheet, View } from "react-native";
import { Activity, Dumbbell, Moon } from "lucide-react-native";
import { Screen } from "../../../src/components/Screen";
import { Text } from "../../../src/components/Text";
import { EmptyState, Spinner } from "../../../src/components/States";
import { HairlineRow, PageHeader, TrendChart } from "../../../src/components/QuietHealth";
import { useActivitiesQuery, useRecoveryQuery, useSleepQuery } from "../../../src/api/hooks";
import { formatDateLabel, formatDuration, numberLabel } from "../../../src/ui/format";
import { spacing, useTheme } from "../../../src/theme/tokens";

export default function InsightsTab() {
  const recovery = useRecoveryQuery(8);
  const sleep = useSleepQuery(8);
  const activities = useActivitiesQuery(8);
  const { tokens } = useTheme();
  const recoveryValues = [...(recovery.data ?? [])].reverse().map((item) => item.recoveryPercent ?? 0);
  const latestRecovery = recoveryValues.at(-1) ?? 0;
  const earliestRecovery = recoveryValues[0] ?? latestRecovery;
  const recoveryDelta = latestRecovery - earliestRecovery;
  const averageSleep = sleep.data?.length ? Math.round(sleep.data.reduce((sum, item) => sum + item.durationMinutes, 0) / sleep.data.length) : null;
  const averageLoad = activities.data?.length ? Math.round(activities.data.reduce((sum, item) => sum + (item.trainingLoad ?? 0), 0) / activities.data.length) : null;
  const isLoading = recovery.isLoading || sleep.isLoading || activities.isLoading;
  const hasError = recovery.error || sleep.error || activities.error;

  return (
    <Screen>
      <PageHeader title="数据洞察" subtitle="最近 4 周" />

      {isLoading ? <Spinner /> : hasError ? <EmptyState title="数据加载失败" description="请确认登录状态和后端服务。" /> : (
        <>
          <View style={styles.insightLead}>
            <Text size="hero" weight="strong" style={{ color: tokens.inkStrong }}>
              恢复状态{recoveryDelta >= 0 ? "正在上升" : "需要关注"}
            </Text>
            <Text size="lg" style={{ color: tokens.sage }}>
              {recoveryDelta >= 0 ? "+" : ""}{recoveryDelta}% · 相比周期开始
            </Text>
          </View>

          <View style={styles.trendChart}>
            {recoveryValues.length ? <TrendChart values={recoveryValues} /> : <EmptyState title="暂无恢复趋势" description="同步 COROS 后会显示趋势。" />}
            {recovery.data?.length ? (
              <View style={styles.chartLabels}>
                <Text size="xs" style={{ color: tokens.muted }}>{formatDateLabel(recovery.data.at(-1)?.date ?? "")}</Text>
                <Text size="xs" style={{ color: tokens.muted }}>现在 · {latestRecovery}%</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.analysisList}>
            <HairlineRow
              icon={<Moon color={tokens.sage} size={24} strokeWidth={1.5} />}
              title="平均睡眠"
              subtitle={sleep.data?.[0]?.qualityScore ? `最近质量评分 ${sleep.data[0].qualityScore}` : "持续同步可获得更准趋势"}
              value={formatDuration(averageSleep)}
            />
            <HairlineRow
              icon={<Dumbbell color={tokens.sage} size={24} strokeWidth={1.5} />}
              title="训练负荷"
              subtitle={`${activities.data?.length ?? 0} 次最近活动`}
              value={averageLoad === null ? "—" : averageLoad < 40 ? "偏轻" : averageLoad > 90 ? "偏高" : "平衡"}
            />
            <HairlineRow
              icon={<Activity color={tokens.sage} size={24} strokeWidth={1.5} />}
              title="最近活动"
              subtitle={activities.data?.[0] ? `${formatDateLabel(activities.data[0].startedAt)} · ${formatDuration(activities.data[0].durationMinutes)}` : "暂无记录"}
              value={activities.data?.[0] ? numberLabel(activities.data[0].averageHeartRateBpm, " bpm") : "—"}
            />
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  analysisList: { marginTop: spacing.sm },
  chartLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: -spacing.sm },
  insightLead: { gap: spacing.sm },
  trendChart: { gap: spacing.sm, minHeight: 180 }
});
