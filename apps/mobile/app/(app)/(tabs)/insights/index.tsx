import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Activity, Dumbbell, Footprints, Heart, HeartPulse, Moon } from "lucide-react-native";
import { Screen } from "../../../../src/components/Screen";
import { Text } from "../../../../src/components/Text";
import { EmptyState, Spinner } from "../../../../src/components/States";
import { InsetGroup } from "../../../../src/components/InsetGroup";
import { Row } from "../../../../src/components/Row";
import { WarmHeader } from "../../../../src/components/WarmHeader";
import { WeekBars, type WeekBar } from "../../../../src/components/WeekBars";
import { ActivityHeatmap } from "../../../../src/components/ActivityHeatmap";
import {
  ActivityFrequencyDashboard,
  type FrequencyBreakdownItem,
  type FrequencyTrendPoint
} from "../../../../src/components/ActivityFrequencyDashboard";
import { ActivitySessionDetails } from "../../../../src/components/ActivitySessionDetails";
import { ExpandingCard } from "../../../../src/components/ExpandingCard";
import { SleepWeekDashboard } from "../../../../src/components/SleepWeekDashboard";
import { useActivitiesQuery, useRecoveryQuery, useSleepQuery } from "../../../../src/api/hooks";
import {
  activitiesForDateKeys,
  buildHeatmapWeeks,
  buildWeek,
  dominantIntensityByDay,
  minutesByDay,
  normalizeIntensity,
  type Intensity
} from "../../../../src/insights/aggregates";
import {
  APP_TIME_ZONE,
  formatDateLabel,
  formatDuration,
  localDateKey,
  numberLabel,
  sportTypeLabel
} from "../../../../src/ui/format";
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

function RecordsDetailScreen({
  title,
  subtitle,
  visual,
  children
}: {
  title: string;
  subtitle: string;
  visual: ReactNode;
  children?: ReactNode;
}) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      automaticallyAdjustsScrollIndicatorInsets
      contentContainerStyle={[
        styles.detailContent,
        { paddingTop: insets.top + 64, paddingBottom: insets.bottom + spacing.xl }
      ]}
    >
      <View style={styles.detailHero}>
        <Text size="largeTitle" weight="strong">
          {title}
        </Text>
        <Text size="subheadline" color={tokens.labelSecondary}>
          {subtitle}
        </Text>
      </View>
      <View style={styles.detailChart}>{visual}</View>
      {children}
    </ScrollView>
  );
}

export default function InsightsTab() {
  const recovery = useRecoveryQuery(8);
  const sleep = useSleepQuery(7);
  const activities = useActivitiesQuery(90);
  const { tokens, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const shadow = cardShadow(isDark ? "dark" : "light");

  function openCoachWithPrompt(prompt: string, close: (options?: { immediate?: boolean; onClosed?: () => void }) => void) {
    close({
      immediate: true,
      onClosed: () => {
        router.push({
          pathname: "/(app)/(tabs)/coach",
          params: { prompt, askId: String(Date.now()) }
        });
      }
    });
  }
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

  const frequencyRecords = activitiesForDateKeys(activityList, heatmapKeySet, APP_TIME_ZONE);
  const weekRecords = activitiesForDateKeys(activityList, weekKeySet, APP_TIME_ZONE);
  const frequencyTotalMinutes = frequencyRecords.reduce((sum, item) => sum + item.durationMinutes, 0);
  const frequencyDistanceKm = frequencyRecords.reduce((sum, item) => sum + (item.distanceKm ?? 0), 0);
  const trackedHeatmapDays = weeks.flat().filter((key) => key <= todayKey);
  const activeHeatmapDays = trackedHeatmapDays.filter((key) => (activityMinutes.get(key) ?? 0) > 0).length;
  const weeklyTrend: FrequencyTrendPoint[] = weeks.map((week, index) => ({
    key: week[0],
    label: `${index + 1}周`,
    sessions: frequencyRecords.filter((item) => week.includes(localDateKey(item.startedAt, APP_TIME_ZONE))).length
  }));
  const sportCounts = new Map<string, number>();
  const intensityCounts = new Map<Intensity, number>([
    ["easy", 0],
    ["moderate", 0],
    ["high", 0]
  ]);
  for (const item of frequencyRecords) {
    const sport = sportTypeLabel(item.sportType);
    sportCounts.set(sport, (sportCounts.get(sport) ?? 0) + 1);
    const intensity = normalizeIntensity(item.intensity);
    intensityCounts.set(intensity, (intensityCounts.get(intensity) ?? 0) + 1);
  }
  const sportBreakdown: FrequencyBreakdownItem[] = [...sportCounts.entries()]
    .map(([label, value]) => ({ key: label, label, value }))
    .sort((a, b) => b.value - a.value);
  const intensityBreakdown: FrequencyBreakdownItem[] = [
    { key: "easy", label: "轻松", value: intensityCounts.get("easy") ?? 0, tone: "tint" },
    { key: "moderate", label: "中等", value: intensityCounts.get("moderate") ?? 0, tone: "orange" },
    { key: "high", label: "高强度", value: intensityCounts.get("high") ?? 0, tone: "red" }
  ];

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
  const weekSleepRecords = (sleep.data ?? [])
    .filter((record) => weekKeySet.has(localDateKey(record.date, APP_TIME_ZONE)))
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const sleepStageMinutes = weekSleepRecords.reduce(
    (totals, record) => ({
      deep: totals.deep + (record.deepSleepMinutes ?? 0),
      light: totals.light + (record.lightSleepMinutes ?? 0),
      rem: totals.rem + (record.remSleepMinutes ?? 0),
      awake: totals.awake + (record.awakeMinutes ?? 0)
    }),
    { deep: 0, light: 0, rem: 0, awake: 0 }
  );
  const qualityByDay = new Map<string, number>();
  for (const record of weekSleepRecords) {
    const key = localDateKey(record.date, APP_TIME_ZONE);
    if (!key || record.qualityScore === null) continue;
    qualityByDay.set(key, record.qualityScore);
  }
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
  const sleepQualityBars: WeekBar[] = sleepWeek.map((day, index) => {
    const quality = qualityByDay.get(day.key) ?? 0;
    return {
      key: day.key,
      label: weekDayNames[index],
      value: quality,
      tone: quality >= 80 ? "tintFill" : quality >= 60 ? "orange" : quality > 0 ? "red" : "fill",
      valueLabel: quality > 0 ? `${quality}` : undefined,
      accessibilityLabel: quality > 0
        ? `周${weekDayNames[index]}睡眠质量 ${quality} 分`
        : `周${weekDayNames[index]}无质量评分`
    };
  });

  return (
    <Screen contentContainerStyle={{ paddingTop: insets.top + spacing.lg }}>
      {/* In-page header: the native header is hidden for this tab, so the
          safe-area top inset is applied manually via contentContainerStyle. */}
      <WarmHeader overline={`近 ${HEATMAP_WEEKS} 周`} title="数据" />

      {isLoading ? <Spinner /> : hasError ? (
        <EmptyState title="数据加载失败" description="请确认登录状态和后端服务。" />
      ) : (
        <>
          {/* 运动频率: compact 12-week heatmap on top — a quick frequency
              glance, not a detailed read. Tap to expand concrete sessions. */}
          <ExpandingCard
            accessibilityLabel="运动频率"
            accessibilityHint="从当前位置展开到全屏查看具体运动记录"
            cardStyle={[styles.card, { backgroundColor: tokens.surface }, shadow]}
            summaryStyle={styles.cardContent}
            summary={(
              <>
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
                <ActivityHeatmap weeks={weeks} minutesByDay={activityMinutes} todayKey={todayKey} compact />
              </>
            )}
            detail={(
              <RecordsDetailScreen
                title="运动频率"
                subtitle={`近 ${HEATMAP_WEEKS} 周活动仪表盘`}
                visual={(
                  <ActivityFrequencyDashboard
                    weeks={weeks}
                    minutesByDay={activityMinutes}
                    todayKey={todayKey}
                    sessions={heatmapSessions}
                    totalMinutes={frequencyTotalMinutes}
                    totalDistanceKm={frequencyDistanceKm}
                    activeDays={activeHeatmapDays}
                    trackedDays={trackedHeatmapDays.length}
                    weeklyTrend={weeklyTrend}
                    sportBreakdown={sportBreakdown}
                    intensityBreakdown={intensityBreakdown}
                  />
                )}
              />
            )}
          />

          {/* 本周运动 / 本周睡眠: half-width compact cards side by side. */}
          <View style={styles.cardRow}>
            <ExpandingCard
              accessibilityLabel="本周运动"
              accessibilityHint="从当前位置展开到全屏查看本周运动记录"
              cardStyle={[styles.card, styles.halfCard, { backgroundColor: tokens.surface }, shadow]}
              summaryStyle={styles.halfCardContent}
              summary={(
                <>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.cardHeaderLeft}>
                      <View style={[styles.iconTile, { backgroundColor: tokens.fill }]}>
                        <Footprints color={tokens.orange} size={16} strokeWidth={1.8} />
                      </View>
                      <Text size="callout" weight="semibold">
                        本周运动
                      </Text>
                    </View>
                  </View>
                  <Text size="footnote" color={tokens.labelSecondary}>
                    {`${exerciseSessions} 次 · 共 ${formatDuration(exerciseTotal)}`}
                  </Text>
                  <WeekBars bars={exerciseBars} compact />
                </>
              )}
              detail={({ close }) => (
                <RecordsDetailScreen
                  title="本周运动"
                  subtitle={`${exerciseSessions} 次 · 共 ${formatDuration(exerciseTotal)} · 逐次数据`}
                  visual={<WeekBars bars={exerciseBars} />}
                >
                  <ActivitySessionDetails
                    records={weekRecords}
                    onAskAi={(prompt) => openCoachWithPrompt(prompt, close)}
                  />
                </RecordsDetailScreen>
              )}
            />

            <ExpandingCard
              accessibilityLabel="本周睡眠"
              accessibilityHint="从当前位置展开到全屏查看本周睡眠记录"
              cardStyle={[styles.card, styles.halfCard, { backgroundColor: tokens.surface }, shadow]}
              summaryStyle={styles.halfCardContent}
              summary={(
                <>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.cardHeaderLeft}>
                      <View style={[styles.iconTile, { backgroundColor: tokens.fill }]}>
                        <Moon color={tokens.label} size={16} strokeWidth={1.8} />
                      </View>
                      <Text size="callout" weight="semibold">
                        本周睡眠
                      </Text>
                    </View>
                  </View>
                  <Text size="footnote" color={tokens.labelSecondary}>
                    {weekAverageSleep === null
                      ? "暂无记录"
                      : `均 ${formatDuration(weekAverageSleep)}${averageQuality === null ? "" : ` · ${averageQuality} 分`}`}
                  </Text>
                  <WeekBars bars={sleepBars} compact />
                </>
              )}
              detail={({ close }) => (
                <RecordsDetailScreen
                  title="本周睡眠"
                  subtitle={weekAverageSleep === null
                    ? "暂无记录"
                    : `平均 ${formatDuration(weekAverageSleep)}${averageQuality === null ? "" : ` · 质量 ${averageQuality} 分`}`}
                  visual={(
                    <SleepWeekDashboard
                      bars={sleepBars}
                      qualityBars={sleepQualityBars}
                      averageMinutes={weekAverageSleep}
                      averageQuality={averageQuality}
                      recordedNights={recordedNights.length}
                      stageMinutes={sleepStageMinutes}
                      records={weekSleepRecords}
                      onAskAi={(prompt) => openCoachWithPrompt(prompt, close)}
                    />
                  )}
                />
              )}
            />
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
  card: { borderRadius: radius.card, marginHorizontal: 20 },
  cardContent: { gap: 14, padding: 18 },
  cardHeaderLeft: { alignItems: "center", flexDirection: "row", gap: 10, flexShrink: 1 },
  cardHeaderRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  cardRow: { flexDirection: "row", gap: 12, marginHorizontal: 20 },
  detailChart: { marginHorizontal: spacing.lg },
  detailContent: { gap: spacing.xl },
  detailHero: { gap: spacing.xs, paddingHorizontal: spacing.xl },
  halfCard: { flex: 1, marginHorizontal: 0 },
  halfCardContent: { gap: 10, padding: 14 },
  iconTile: {
    alignItems: "center",
    borderRadius: 10,
    height: 32,
    justifyContent: "center",
    width: 32
  }
});
