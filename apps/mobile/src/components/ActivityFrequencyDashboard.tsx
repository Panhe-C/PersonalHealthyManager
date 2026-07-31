import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { radius, spacing, useTheme } from "../theme/tokens";
import { formatDuration } from "../ui/format";
import { ActivityHeatmap } from "./ActivityHeatmap";
import { Text } from "./Text";

export type FrequencyTrendPoint = {
  key: string;
  label: string;
  sessions: number;
};

export type FrequencyBreakdownItem = {
  key: string;
  label: string;
  value: number;
  tone?: "tint" | "orange" | "red";
};

export function ActivityFrequencyDashboard({
  weeks,
  minutesByDay,
  todayKey,
  sessions,
  totalMinutes,
  totalDistanceKm,
  activeDays,
  trackedDays,
  weeklyTrend,
  sportBreakdown,
  intensityBreakdown
}: {
  weeks: string[][];
  minutesByDay: ReadonlyMap<string, number>;
  todayKey: string;
  sessions: number;
  totalMinutes: number;
  totalDistanceKm: number;
  activeDays: number;
  trackedDays: number;
  weeklyTrend: FrequencyTrendPoint[];
  sportBreakdown: FrequencyBreakdownItem[];
  intensityBreakdown: FrequencyBreakdownItem[];
}) {
  const { tokens } = useTheme();
  const activeRate = trackedDays > 0 ? Math.round((activeDays / trackedDays) * 100) : 0;
  const circumference = 2 * Math.PI * 42;
  const maxWeeklySessions = Math.max(...weeklyTrend.map((item) => item.sessions), 1);
  const sportTotal = Math.max(sportBreakdown.reduce((sum, item) => sum + item.value, 0), 1);
  const intensityTotal = Math.max(intensityBreakdown.reduce((sum, item) => sum + item.value, 0), 1);

  return (
    <View style={styles.dashboard}>
      <View style={[styles.overview, { backgroundColor: tokens.surfaceAlt }]}>
        <View style={styles.gauge}>
          <Svg accessibilityLabel={`活跃日比例 ${activeRate}%`} height={112} width={112}>
            <Circle cx={56} cy={56} fill="none" r={42} stroke={tokens.fill} strokeWidth={10} />
            <Circle
              cx={56}
              cy={56}
              fill="none"
              origin="56, 56"
              r={42}
              rotation={-90}
              stroke={tokens.tintFill}
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={circumference * (1 - activeRate / 100)}
              strokeLinecap="round"
              strokeWidth={10}
            />
          </Svg>
          <View pointerEvents="none" style={styles.gaugeLabel}>
            <Text size="title2" weight="strong" tabularNums>{activeRate}%</Text>
            <Text size="caption2" color={tokens.labelSecondary}>活跃日</Text>
          </View>
        </View>

        <View style={styles.metricGrid}>
          <DashboardMetric label="运动次数" value={`${sessions}`} />
          <DashboardMetric label="活跃天数" value={`${activeDays}`} />
          <DashboardMetric label="总时长" value={formatDuration(totalMinutes)} />
          <DashboardMetric label="总距离" value={`${Number(totalDistanceKm.toFixed(1))} km`} />
        </View>
      </View>

      <DashboardSection title="12 周活跃分布">
        <ActivityHeatmap weeks={weeks} minutesByDay={minutesByDay} todayKey={todayKey} />
      </DashboardSection>

      <DashboardSection title="每周运动次数">
        <View style={styles.trend}>
          {weeklyTrend.map((item, index) => (
            <View
              accessible
              accessibilityLabel={`${item.label} ${item.sessions} 次运动`}
              key={item.key}
              style={styles.trendColumn}
            >
              <Text size="caption2" color={tokens.labelSecondary} tabularNums>
                {item.sessions || " "}
              </Text>
              <View
                style={[
                  styles.trendBar,
                  {
                    backgroundColor: index === weeklyTrend.length - 1 ? tokens.tintFill : tokens.fill,
                    height: Math.max(5, Math.round((item.sessions / maxWeeklySessions) * 58))
                  }
                ]}
              />
              <Text size="caption2" color={tokens.labelTertiary}>
                {index % 3 === 0 || index === weeklyTrend.length - 1 ? item.label : " "}
              </Text>
            </View>
          ))}
        </View>
      </DashboardSection>

      <DashboardSection title="运动类型">
        <View style={styles.breakdownList}>
          {sportBreakdown.length ? sportBreakdown.map((item) => (
            <BreakdownBar key={item.key} item={item} total={sportTotal} />
          )) : <Text size="footnote" color={tokens.labelSecondary}>暂无运动记录</Text>}
        </View>
      </DashboardSection>

      <DashboardSection title="强度构成">
        <View style={[styles.stackedTrack, { backgroundColor: tokens.fill }]}>
          {intensityBreakdown.filter((item) => item.value > 0).map((item) => (
            <View
              key={item.key}
              style={[
                styles.stackedSegment,
                {
                  backgroundColor: item.tone === "red"
                    ? tokens.red
                    : item.tone === "orange"
                      ? tokens.orange
                      : tokens.tintFill,
                  flex: item.value / intensityTotal
                }
              ]}
            />
          ))}
        </View>
        <View style={styles.legend}>
          {intensityBreakdown.map((item) => (
            <View key={item.key} style={styles.legendItem}>
              <View
                style={[
                  styles.legendDot,
                  {
                    backgroundColor: item.tone === "red"
                      ? tokens.red
                      : item.tone === "orange"
                        ? tokens.orange
                        : tokens.tintFill
                  }
                ]}
              />
              <Text size="caption" color={tokens.labelSecondary}>
                {item.label} {item.value}
              </Text>
            </View>
          ))}
        </View>
      </DashboardSection>
    </View>
  );
}

function DashboardMetric({ label, value }: { label: string; value: string }) {
  const { tokens } = useTheme();
  return (
    <View style={styles.metric}>
      <Text size="title3" weight="semibold" tabularNums>{value}</Text>
      <Text size="caption" color={tokens.labelSecondary}>{label}</Text>
    </View>
  );
}

function DashboardSection({ title, children }: { title: string; children: ReactNode }) {
  const { tokens } = useTheme();
  return (
    <View style={[styles.section, { backgroundColor: tokens.surfaceAlt }]}>
      <Text size="headline" weight="semibold">{title}</Text>
      {children}
    </View>
  );
}

function BreakdownBar({ item, total }: { item: FrequencyBreakdownItem; total: number }) {
  const { tokens } = useTheme();
  const percentage = Math.round((item.value / total) * 100);
  return (
    <View accessible accessibilityLabel={`${item.label} ${item.value} 次，占 ${percentage}%`} style={styles.breakdown}>
      <View style={styles.breakdownHeader}>
        <Text size="footnote">{item.label}</Text>
        <Text size="footnote" color={tokens.labelSecondary} tabularNums>{item.value} 次 · {percentage}%</Text>
      </View>
      <View style={[styles.breakdownTrack, { backgroundColor: tokens.fill }]}>
        <View style={[styles.breakdownFill, { backgroundColor: tokens.tintFill, width: `${percentage}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  breakdown: { gap: spacing.xs },
  breakdownFill: { borderRadius: radius.pill, height: 7 },
  breakdownHeader: { flexDirection: "row", justifyContent: "space-between" },
  breakdownList: { gap: spacing.md },
  breakdownTrack: { borderRadius: radius.pill, height: 7, overflow: "hidden" },
  dashboard: { gap: spacing.md },
  gauge: { alignItems: "center", height: 112, justifyContent: "center", width: 112 },
  gaugeLabel: { alignItems: "center", position: "absolute" },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  legendDot: { borderRadius: radius.pill, height: 8, width: 8 },
  legendItem: { alignItems: "center", flexDirection: "row", gap: spacing.xs },
  metric: { gap: 1, width: "47%" },
  metricGrid: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  overview: {
    alignItems: "center",
    borderRadius: radius.bubble,
    flexDirection: "row",
    gap: spacing.lg,
    padding: spacing.lg
  },
  section: { borderRadius: radius.bubble, gap: spacing.lg, padding: spacing.lg },
  stackedSegment: {},
  stackedTrack: { borderRadius: radius.pill, flexDirection: "row", height: 12, overflow: "hidden" },
  trend: { alignItems: "flex-end", flexDirection: "row", height: 100, justifyContent: "space-between" },
  trendBar: { borderRadius: 4, width: 12 },
  trendColumn: { alignItems: "center", flex: 1, gap: spacing.xs }
});
