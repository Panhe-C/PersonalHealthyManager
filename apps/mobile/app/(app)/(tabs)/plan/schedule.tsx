import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Screen } from "../../../../src/components/Screen";
import { Text } from "../../../../src/components/Text";
import { EmptyState, Spinner } from "../../../../src/components/States";
import { useActivePlanQuery } from "../../../../src/api/hooks";
import {
  layoutDaySchedule,
  scheduleStatusLabel,
  scheduleStatusTone,
  TIMELINE_END_HOUR,
  TIMELINE_HOUR_HEIGHT,
  TIMELINE_START_HOUR
} from "../../../../src/planning/scheduleLayout";
import { APP_TIME_ZONE, currentWeekStartIso, formatTaskWindow, localDateKey } from "../../../../src/ui/format";
import { cardShadow, radius, spacing, useTheme } from "../../../../src/theme/tokens";

const DAY_MS = 24 * 60 * 60 * 1000;
const weekNames = ["一", "二", "三", "四", "五", "六", "日"];
const rulerHours = Array.from(
  { length: TIMELINE_END_HOUR - TIMELINE_START_HOUR },
  (_, index) => TIMELINE_START_HOUR + index
);
const timelineHeight = (TIMELINE_END_HOUR - TIMELINE_START_HOUR) * TIMELINE_HOUR_HEIGHT;
const rulerWidth = 52;

const monthFormat = new Intl.DateTimeFormat("zh-CN", { timeZone: APP_TIME_ZONE, year: "numeric", month: "long" });
const hourLabel = (hour: number) => `${hour}:00`;

export default function PlanScheduleScreen() {
  const { data, isLoading, error } = useActivePlanQuery();
  const { tokens, isDark } = useTheme();
  const shadow = cardShadow(isDark ? "dark" : "light");

  // Seven date keys (Mon–Sun) of the active plan's week; today is the default
  // selection when it falls inside the week.
  const weekKeys = useMemo(() => {
    const start = new Date(data?.weekStart ?? currentWeekStartIso());
    return Array.from({ length: 7 }, (_, index) =>
      localDateKey(new Date(start.getTime() + index * DAY_MS), APP_TIME_ZONE)
    );
  }, [data?.weekStart]);
  const todayKey = localDateKey(new Date(), APP_TIME_ZONE);
  const [selectedKey, setSelectedKey] = useState(() =>
    weekKeys.includes(todayKey) ? todayKey : weekKeys[0]
  );

  const dayTasks = useMemo(
    () =>
      (data?.trainingTasks ?? []).filter(
        (task) => localDateKey(task.date, APP_TIME_ZONE) === selectedKey
      ),
    [data?.trainingTasks, selectedKey]
  );
  const schedule = useMemo(
    () => layoutDaySchedule(dayTasks, { timeZone: APP_TIME_ZONE }),
    [dayTasks]
  );

  return (
    <Screen contentContainerStyle={{ gap: spacing.lg }}>
      <Text size="title3" weight="strong" style={styles.monthLabel}>
        {monthFormat.format(new Date(`${selectedKey}T00:00:00+08:00`))}
      </Text>

      {/* Week selector: selected day gets a surface pill, today a tint dot. */}
      <View style={styles.dayRow}>
        {weekKeys.map((key, index) => {
          const selected = key === selectedKey;
          const isToday = key === todayKey;
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`周${weekNames[index]} ${Number(key.slice(8))} 日`}
              onPress={() => setSelectedKey(key)}
              style={styles.dayItem}
            >
              <Text size="caption2" color={tokens.labelSecondary}>
                周{weekNames[index]}
              </Text>
              <View
                style={[
                  styles.dayPill,
                  selected ? { backgroundColor: tokens.surface } : null,
                  selected ? shadow : null
                ]}
              >
                <Text size="callout" weight={selected ? "semibold" : "regular"} color={tokens.label} tabularNums>
                  {Number(key.slice(8))}
                </Text>
              </View>
              <View style={[styles.todayDot, isToday ? { backgroundColor: tokens.tint } : null]} />
            </Pressable>
          );
        })}
      </View>

      {isLoading ? <Spinner /> : error ? (
        <EmptyState title="计划加载失败" description="请稍后重试。" />
      ) : dayTasks.length === 0 ? (
        <EmptyState title="这一天没有安排" description="切换到本周其他日期查看训练时段。" />
      ) : (
        <>
          {/* Hour ruler + absolutely positioned session cards. */}
          <View style={[styles.timeline, { height: timelineHeight }]}>
            {rulerHours.map((hour, index) => (
              <View key={hour} style={[styles.hourRow, { top: index * TIMELINE_HOUR_HEIGHT }]}>
                <Text size="caption2" color={tokens.labelSecondary} style={styles.hourLabel}>
                  {hourLabel(hour)}
                </Text>
                <View style={[styles.hourLine, { backgroundColor: tokens.separator }]} />
              </View>
            ))}
            {schedule.timed.map(({ task, top, height }) => (
              <View
                key={task.id}
                accessible
                accessibilityLabel={`${task.title},${formatTaskWindow(task.scheduledStart, task.scheduledEnd)},${scheduleStatusLabel(task.status)}`}
                style={[
                  styles.sessionCard,
                  shadow,
                  {
                    backgroundColor: tokens.surface,
                    top,
                    height,
                    left: rulerWidth + spacing.sm,
                    right: 0
                  }
                ]}
              >
                <View
                  style={[
                    styles.sessionBar,
                    { backgroundColor: tokens[scheduleStatusTone(task.status)] }
                  ]}
                />
                <View style={styles.sessionCopy}>
                  <Text
                    size="subheadline"
                    weight="semibold"
                    numberOfLines={1}
                    color={task.status === "skipped" ? tokens.labelSecondary : tokens.label}
                    style={task.status === "skipped" ? styles.sessionSkipped : null}
                  >
                    {task.title}
                  </Text>
                  <Text size="caption" color={tokens.labelSecondary} numberOfLines={1}>
                    {scheduleStatusLabel(task.status)} · {formatTaskWindow(task.scheduledStart, task.scheduledEnd)}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {schedule.untimed.length > 0 ? (
            <View style={[styles.untimedCard, { backgroundColor: tokens.surface }, shadow]}>
              <Text size="footnote" color={tokens.labelSecondary}>
                未指定时间
              </Text>
              {schedule.untimed.map((task) => (
                <View key={task.id} style={styles.untimedRow}>
                  <View style={[styles.sessionBar, { backgroundColor: tokens[scheduleStatusTone(task.status)] }]} />
                  <Text size="subheadline" color={tokens.label} style={styles.untimedTitle} numberOfLines={1}>
                    {task.title}
                  </Text>
                  <Text size="caption" color={tokens.labelSecondary}>
                    {task.durationMinutes} 分钟
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  dayItem: { alignItems: "center", flex: 1, gap: 4 },
  dayPill: {
    alignItems: "center",
    borderRadius: radius.md,
    height: 36,
    justifyContent: "center",
    width: 40
  },
  dayRow: { flexDirection: "row", marginHorizontal: 20 },
  hourLabel: { textAlign: "right", width: rulerWidth - spacing.sm },
  hourLine: { flex: 1, height: StyleSheet.hairlineWidth, marginLeft: spacing.sm },
  hourRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    left: 0,
    position: "absolute",
    right: 0
  },
  monthLabel: { marginHorizontal: 20 },
  sessionBar: { borderRadius: 2, height: 28, width: 3 },
  sessionCard: {
    alignItems: "center",
    borderRadius: radius.md,
    flexDirection: "row",
    gap: spacing.sm,
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    position: "absolute"
  },
  sessionCopy: { flex: 1, gap: 2, minWidth: 0 },
  sessionSkipped: { textDecorationLine: "line-through" },
  timeline: { marginHorizontal: 20, position: "relative" },
  todayDot: { borderRadius: 2, height: 4, width: 4 },
  untimedCard: { borderRadius: radius.card, gap: spacing.sm, marginHorizontal: 20, padding: 18 },
  untimedRow: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  untimedTitle: { flex: 1 }
});
