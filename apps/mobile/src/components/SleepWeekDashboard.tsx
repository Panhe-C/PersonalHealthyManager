import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import type { SleepRecord } from "../api/schemas";
import { buildSleepAnalysisPrompt } from "../insights/askAi";
import { radius, spacing, useTheme } from "../theme/tokens";
import { formatDateLabel, formatDuration, formatTaskWindow } from "../ui/format";
import { AskAiButton } from "./AskAiButton";
import { WeekBars, type WeekBar } from "./WeekBars";
import { Text } from "./Text";

export type SleepStageBreakdown = {
  deep: number;
  light: number;
  rem: number;
  awake: number;
};

export function SleepWeekDashboard({
  bars,
  qualityBars,
  averageMinutes,
  averageQuality,
  recordedNights,
  stageMinutes,
  records,
  onAskAi
}: {
  bars: WeekBar[];
  qualityBars: WeekBar[];
  averageMinutes: number | null;
  averageQuality: number | null;
  recordedNights: number;
  stageMinutes: SleepStageBreakdown;
  records: SleepRecord[];
  onAskAi?: (prompt: string) => void;
}) {
  const { tokens } = useTheme();
  const durationTarget = 8 * 60;
  const durationRate = averageMinutes === null
    ? 0
    : Math.max(0, Math.min(100, Math.round((averageMinutes / durationTarget) * 100)));
  const qualityRate = averageQuality ?? 0;
  const consistencyRate = Math.round((recordedNights / 7) * 100);
  const stageTotal = Math.max(stageMinutes.deep + stageMinutes.light + stageMinutes.rem + stageMinutes.awake, 1);

  return (
    <View style={styles.dashboard}>
      <View style={[styles.overview, { backgroundColor: tokens.surfaceAlt }]}>
        <Gauge
          label="时长达标"
          value={durationRate}
          caption={averageMinutes === null ? "暂无" : formatDuration(averageMinutes)}
          color={tokens.tintFill}
        />
        <Gauge
          label="平均质量"
          value={qualityRate}
          caption={averageQuality === null ? "暂无" : `${averageQuality} 分`}
          color={tokens.controlFill}
        />
      </View>

      <View style={styles.metricGrid}>
        <MetricChip label="记录夜晚" value={`${recordedNights}/7`} />
        <MetricChip label="规律性" value={`${consistencyRate}%`} />
        <MetricChip label="平均时长" value={averageMinutes === null ? "—" : formatDuration(averageMinutes)} />
        <MetricChip label="平均质量" value={averageQuality === null ? "—" : `${averageQuality}`} />
      </View>

      <Section title="本周睡眠时长">
        <WeekBars bars={bars} />
      </Section>

      <Section title="本周睡眠质量">
        <WeekBars bars={qualityBars} />
      </Section>

      <Section title="睡眠阶段占比">
        {stageTotal > 1 ? (
          <>
            <View style={[styles.stackedTrack, { backgroundColor: tokens.fill }]}>
              {stageMinutes.deep > 0 ? <View style={[styles.segment, { flex: stageMinutes.deep, backgroundColor: tokens.controlFill }]} /> : null}
              {stageMinutes.light > 0 ? <View style={[styles.segment, { flex: stageMinutes.light, backgroundColor: tokens.tintFill }]} /> : null}
              {stageMinutes.rem > 0 ? <View style={[styles.segment, { flex: stageMinutes.rem, backgroundColor: tokens.orange }]} /> : null}
              {stageMinutes.awake > 0 ? <View style={[styles.segment, { flex: stageMinutes.awake, backgroundColor: tokens.red }]} /> : null}
            </View>
            <View style={styles.legend}>
              <LegendDot color={tokens.controlFill} label={`深睡 ${formatDuration(stageMinutes.deep)}`} />
              <LegendDot color={tokens.tintFill} label={`浅睡 ${formatDuration(stageMinutes.light)}`} />
              <LegendDot color={tokens.orange} label={`REM ${formatDuration(stageMinutes.rem)}`} />
              <LegendDot color={tokens.red} label={`清醒 ${formatDuration(stageMinutes.awake)}`} />
            </View>
          </>
        ) : (
          <Text size="footnote" color={tokens.labelSecondary}>同步睡眠分期后会显示深睡、浅睡、REM 占比</Text>
        )}
      </Section>

      <Section title="逐晚记录">
        <View style={styles.nightList}>
          {records.length ? records.map((record) => (
            <View key={record.id} style={[styles.nightCard, { backgroundColor: tokens.surface }]}>
              <View style={styles.nightHeader}>
                <Text size="callout" weight="semibold">{formatDateLabel(record.date)}</Text>
                <Text size="callout" weight="semibold" tabularNums>
                  {record.qualityScore === null ? "—" : `${record.qualityScore} 分`}
                </Text>
              </View>
              <Text size="footnote" color={tokens.labelSecondary}>
                {[
                  formatDuration(record.durationMinutes),
                  record.sleepStart && record.sleepEnd ? formatTaskWindow(record.sleepStart, record.sleepEnd) : null
                ].filter(Boolean).join(" · ")}
              </Text>
              <NightStageRow record={record} />
              {onAskAi ? (
                <AskAiButton onPress={() => onAskAi(buildSleepAnalysisPrompt(record))} />
              ) : null}
            </View>
          )) : (
            <Text size="footnote" color={tokens.labelSecondary}>暂无睡眠记录</Text>
          )}
        </View>
      </Section>
    </View>
  );
}

function Gauge({
  label,
  value,
  caption,
  color
}: {
  label: string;
  value: number;
  caption: string;
  color: string;
}) {
  const { tokens } = useTheme();
  const circumference = 2 * Math.PI * 36;
  return (
    <View style={styles.gauge}>
      <Svg accessibilityLabel={`${label} ${value}%`} height={96} width={96}>
        <Circle cx={48} cy={48} fill="none" r={36} stroke={tokens.fill} strokeWidth={8} />
        <Circle
          cx={48}
          cy={48}
          fill="none"
          origin="48, 48"
          r={36}
          rotation={-90}
          stroke={color}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - value / 100)}
          strokeLinecap="round"
          strokeWidth={8}
        />
      </Svg>
      <View pointerEvents="none" style={styles.gaugeLabel}>
        <Text size="title3" weight="strong" tabularNums>{value}%</Text>
        <Text size="caption2" color={tokens.labelSecondary}>{label}</Text>
      </View>
      <Text size="caption" color={tokens.labelSecondary} style={styles.gaugeCaption}>{caption}</Text>
    </View>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  const { tokens } = useTheme();
  return (
    <View style={[styles.chip, { backgroundColor: tokens.surfaceAlt }]}>
      <Text size="headline" weight="semibold" tabularNums>{value}</Text>
      <Text size="caption" color={tokens.labelSecondary}>{label}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { tokens } = useTheme();
  return (
    <View style={[styles.section, { backgroundColor: tokens.surfaceAlt }]}>
      <Text size="headline" weight="semibold">{title}</Text>
      {children}
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  const { tokens } = useTheme();
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text size="caption" color={tokens.labelSecondary}>{label}</Text>
    </View>
  );
}

function NightStageRow({ record }: { record: SleepRecord }) {
  const { tokens } = useTheme();
  const deep = record.deepSleepMinutes ?? 0;
  const light = record.lightSleepMinutes ?? 0;
  const rem = record.remSleepMinutes ?? 0;
  const awake = record.awakeMinutes ?? 0;
  const total = deep + light + rem + awake;
  if (total <= 0) return null;

  return (
    <View style={styles.nightStages}>
      <View style={[styles.stackedTrack, { backgroundColor: tokens.fill }]}>
        {deep > 0 ? <View style={[styles.segment, { flex: deep, backgroundColor: tokens.controlFill }]} /> : null}
        {light > 0 ? <View style={[styles.segment, { flex: light, backgroundColor: tokens.tintFill }]} /> : null}
        {rem > 0 ? <View style={[styles.segment, { flex: rem, backgroundColor: tokens.orange }]} /> : null}
        {awake > 0 ? <View style={[styles.segment, { flex: awake, backgroundColor: tokens.red }]} /> : null}
      </View>
      <Text size="caption2" color={tokens.labelTertiary}>
        深睡 {formatDuration(deep)} · 浅睡 {formatDuration(light)} · REM {formatDuration(rem)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { borderRadius: radius.md, flexGrow: 1, gap: 2, minWidth: "45%", padding: spacing.md },
  dashboard: { gap: spacing.md },
  gauge: { alignItems: "center", flex: 1, gap: spacing.xs },
  gaugeCaption: { textAlign: "center" },
  gaugeLabel: { alignItems: "center", position: "absolute", top: 28 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  legendDot: { borderRadius: radius.pill, height: 8, width: 8 },
  legendItem: { alignItems: "center", flexDirection: "row", gap: spacing.xs },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  nightCard: { borderRadius: radius.md, gap: spacing.sm, padding: spacing.md },
  nightHeader: { flexDirection: "row", justifyContent: "space-between" },
  nightList: { gap: spacing.sm },
  nightStages: { gap: spacing.xs },
  overview: {
    alignItems: "center",
    borderRadius: radius.bubble,
    flexDirection: "row",
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl
  },
  section: { borderRadius: radius.bubble, gap: spacing.lg, padding: spacing.lg },
  segment: {},
  stackedTrack: { borderRadius: radius.pill, flexDirection: "row", height: 12, overflow: "hidden" }
});
