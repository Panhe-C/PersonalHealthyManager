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
