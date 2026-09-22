import { useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { Activity, Flame, Leaf } from "lucide-react-native";
import type { ActivityRecord } from "../api/schemas";
import { buildActivityAnalysisPrompt } from "../insights/askAi";
import { cardShadow, opacity, radius, spacing, useTheme } from "../theme/tokens";
import {
  formatDateLabel,
  formatDuration,
  formatTaskWindow,
  intensityLabel,
  sportTypeLabel
} from "../ui/format";
import { AskAiButton } from "./AskAiButton";
import { Text } from "./Text";

const INTENSITY_GUIDE = [
  {
    key: "轻松",
    label: "低强度",
    Icon: Leaf,
    summary: "恢复跑、散步、轻松骑行等",
    detail: "呼吸平稳，能轻松对话。训练负荷通常低于 40，适合恢复日或热身。"
  },
  {
    key: "中等",
    label: "中强度",
    Icon: Activity,
    summary: "稳态有氧、节奏跑、力量训练等",
    detail: "呼吸加快但仍可控。训练负荷大约在 40–100，是大部分日常训练的区间。"
  },
  {
    key: "高强度",
    label: "高强度",
    Icon: Flame,
    summary: "间歇、冲刺、比赛配速等",
    detail: "明显吃力，说话困难。训练负荷通常高于 100，恢复需求更高。"
  }
] as const;

export function ActivitySessionDetails({
  records,
  onAskAi
}: {
  records: ActivityRecord[];
  onAskAi?: (prompt: string) => void;
}) {
  const { tokens } = useTheme();

  if (!records.length) {
    return (
      <View style={[styles.empty, { backgroundColor: tokens.surfaceAlt }]}>
        <Text size="headline" weight="semibold">暂无运动记录</Text>
        <Text size="footnote" color={tokens.labelSecondary}>
          同步 COROS 或 HealthKit 后会出现在这里
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      <Text size="footnote" color={tokens.labelSecondary} style={styles.sectionTitle}>
        具体运动数据
      </Text>
      {records.map((activity) => (
        <View key={activity.id} style={[styles.session, { backgroundColor: tokens.surfaceAlt }]}>
          <View style={styles.sessionHeader}>
            <View style={styles.sessionTitle}>
              <Text size="title3" weight="semibold">{sportTypeLabel(activity.sportType)}</Text>
              <Text size="footnote" color={tokens.labelSecondary}>
                {formatDateLabel(activity.startedAt)} · {formatTaskWindow(activity.startedAt, activity.endedAt)}
              </Text>
            </View>
            <IntensityBadge intensity={activity.intensity} />
          </View>

          <View style={styles.metrics}>
            <SessionMetric label="时长" value={formatDuration(activity.durationMinutes)} />
            <SessionMetric
              label="距离"
              value={activity.distanceKm === null ? "—" : `${Number(activity.distanceKm.toFixed(2))} km`}
            />
            <SessionMetric
              label="平均心率"
              value={activity.averageHeartRateBpm === null ? "—" : `${activity.averageHeartRateBpm} bpm`}
            />
            <SessionMetric label="平均配速" value={formatPace(activity.averagePaceSecPerKm)} />
            <SessionMetric
              label="热量"
              value={activity.calories === null ? "—" : `${activity.calories} kcal`}
            />
            <SessionMetric
              label="训练负荷"
              value={activity.trainingLoad === null ? "—" : `${Math.round(activity.trainingLoad)}`}
            />
            <SessionMetric
              label="平均速度"
              value={activity.averageSpeedKph === null ? "—" : `${Number(activity.averageSpeedKph.toFixed(1))} km/h`}
            />
            <SessionMetric label="数据来源" value={sourceLabel(activity.source)} />
          </View>

          {onAskAi ? (
            <AskAiButton onPress={() => onAskAi(buildActivityAnalysisPrompt(activity))} />
          ) : null}
        </View>
      ))}
    </View>
  );
}

function SessionMetric({ label, value }: { label: string; value: string }) {
  const { tokens } = useTheme();
  return (
    <View style={styles.metric}>
      <Text size="subheadline" weight="semibold" tabularNums>{value}</Text>
      <Text size="caption2" color={tokens.labelSecondary}>{label}</Text>
    </View>
  );
}

function IntensityBadge({ intensity }: { intensity: string }) {
  const { tokens, isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const normalized = intensityLabel(intensity);
  const color = intensityColor(intensity, tokens);
  const icon = normalized === "高强度"
    ? <Flame color={color} size={14} strokeWidth={2} />
    : normalized === "中等"
      ? <Activity color={color} size={14} strokeWidth={2} />
      : <Leaf color={color} size={14} strokeWidth={2} />;
  const label = displayIntensityLabel(normalized);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}，查看强度说明`}
        accessibilityHint="打开悬浮卡片，了解低中高训练强度的定义"
        hitSlop={8}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.intensityPill,
          { backgroundColor: intensityBackground(intensity, tokens) },
          pressed ? { opacity: opacity.pressed, transform: [{ scale: 0.97 }] } : null
        ]}
      >
        {icon}
      </Pressable>

      <Modal
        animationType="fade"
        transparent
        visible={open}
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="关闭强度说明"
          onPress={() => setOpen(false)}
          style={styles.guideBackdrop}
        >
          <Pressable
            accessibilityViewIsModal
            onPress={(event) => event.stopPropagation()}
            style={[
              styles.guideCard,
              { backgroundColor: tokens.surface, borderColor: tokens.separator },
              cardShadow(isDark ? "dark" : "light")
            ]}
          >
            <Text size="title3" weight="semibold">训练强度说明</Text>
            <Text size="footnote" color={tokens.labelSecondary}>
              本次运动标记为{label}。强度主要依据训练负荷与运动体感综合判断。
            </Text>

            <View style={styles.guideList}>
              {INTENSITY_GUIDE.map((item) => {
                const active = item.key === normalized;
                const itemColor = intensityColor(item.key, tokens);
                const Icon = item.Icon;
                return (
                  <View
                    key={item.key}
                    style={[
                      styles.guideRow,
                      {
                        backgroundColor: active ? intensityBackground(item.key, tokens) : tokens.surfaceAlt,
                        borderColor: active ? itemColor : "transparent"
                      }
                    ]}
                  >
                    <View style={[styles.guideIcon, { backgroundColor: tokens.surface }]}>
                      <Icon color={itemColor} size={16} strokeWidth={2} />
                    </View>
                    <View style={styles.guideCopy}>
                      <View style={styles.guideTitleRow}>
                        <Text size="callout" weight="semibold" color={itemColor}>{item.label}</Text>
                        {active ? (
                          <Text size="caption2" weight="semibold" color={itemColor}>本次</Text>
                        ) : null}
                      </View>
                      <Text size="footnote" color={tokens.label}>{item.summary}</Text>
                      <Text size="caption" color={tokens.labelSecondary}>{item.detail}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function displayIntensityLabel(normalized: string) {
  if (normalized === "高强度") return "高强度";
  if (normalized === "中等") return "中强度";
  if (normalized === "轻松") return "低强度";
  return normalized;
}

function formatPace(seconds: number | null) {
  if (seconds === null || seconds <= 0) return "—";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, "0")} /km`;
}

function sourceLabel(source: string) {
  const value = source.toLowerCase();
  if (value.includes("coros")) return "COROS";
  if (value.includes("health")) return "HealthKit";
  return source || "—";
}

function intensityBackground(intensity: string, tokens: ReturnType<typeof useTheme>["tokens"]) {
  const value = intensityLabel(intensity);
  if (value === "高强度") return tokens.redFill;
  return value === "中等" ? tokens.fill : tokens.surface;
}

function intensityColor(intensity: string, tokens: ReturnType<typeof useTheme>["tokens"]) {
  const value = intensityLabel(intensity);
  if (value === "高强度") return tokens.red;
  return value === "中等" ? tokens.orange : tokens.tint;
}

const styles = StyleSheet.create({
  empty: { borderRadius: radius.bubble, gap: spacing.xs, marginHorizontal: spacing.lg, padding: spacing.lg },
  guideBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(28, 28, 26, 0.36)",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xl
  },
  guideCard: {
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    maxWidth: 360,
    padding: spacing.lg,
    width: "100%"
  },
  guideCopy: { flex: 1, gap: 2 },
  guideIcon: {
    alignItems: "center",
    borderRadius: radius.pill,
    height: 32,
    justifyContent: "center",
    width: 32
  },
  guideList: { gap: spacing.sm },
  guideRow: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md
  },
  guideTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "space-between"
  },
  intensityPill: {
    alignItems: "center",
    aspectRatio: 1,
    borderRadius: radius.pill,
    height: 28,
    justifyContent: "center"
  },
  list: { gap: spacing.md, marginHorizontal: spacing.lg },
  metric: { gap: 2, width: "47%" },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  sectionTitle: { paddingHorizontal: spacing.sm },
  session: { borderRadius: radius.bubble, gap: spacing.lg, padding: spacing.lg },
  sessionHeader: { alignItems: "flex-start", flexDirection: "row", gap: spacing.sm, justifyContent: "space-between" },
  sessionTitle: { flex: 1, gap: 2 }
});
