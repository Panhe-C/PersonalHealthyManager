import { StyleSheet, View } from "react-native";
import { intensityScale } from "../insights/aggregates";
import { spacing, useTheme } from "../theme/tokens";
import { Text } from "./Text";

const CELL_GAP = 6;

// Green steps at 25/50/75/100% over the card surface; index 0 is unused
// because rest days render in `fill` at full opacity instead.
const LEVEL_OPACITY = [1, 0.25, 0.5, 0.75, 1] as const;

/** 12-week, GitHub-contribution-style activity grid. Dumb: the page hands it
 *  the week columns from `buildHeatmapWeeks` and the minutes map; colour by
 *  the day's total minutes on the fixed `intensityScale`. Future days of the
 *  current week render with no background (they are not zero-minute days). */
export function ActivityHeatmap({
  weeks,
  minutesByDay,
  todayKey
}: {
  weeks: string[][];
  minutesByDay: ReadonlyMap<string, number>;
  todayKey: string;
}) {
  const { tokens } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {weeks.map((week) => (
          <View key={week[0]} style={styles.weekColumn}>
            {week.map((dayKey) => {
              const isFuture = dayKey > todayKey;
              const level = intensityScale(minutesByDay.get(dayKey) ?? 0);
              return (
                <View
                  key={dayKey}
                  testID="heatmap-cell"
                  style={[
                    styles.cell,
                    isFuture
                      ? null
                      : { backgroundColor: level === 0 ? tokens.fill : tokens.tintFill, opacity: LEVEL_OPACITY[level] }
                  ]}
                />
              );
            })}
          </View>
        ))}
      </View>
      <View style={styles.legend}>
        <Text size="caption2" color={tokens.labelSecondary}>
          少
        </Text>
        {([0, 1, 2, 3, 4] as const).map((level) => (
          <View
            key={level}
            testID="heatmap-swatch"
            style={[
              styles.swatch,
              { backgroundColor: level === 0 ? tokens.fill : tokens.tintFill, opacity: LEVEL_OPACITY[level] }
            ]}
          />
        ))}
        <Text size="caption2" color={tokens.labelSecondary}>
          多
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cell: { aspectRatio: 1, borderRadius: 4, width: "100%" },
  container: { gap: spacing.sm },
  grid: { flexDirection: "row", gap: CELL_GAP },
  legend: { alignItems: "center", flexDirection: "row", gap: spacing.xs, justifyContent: "flex-end" },
  swatch: { borderRadius: 3, height: 12, width: 12 },
  weekColumn: { flex: 1, gap: CELL_GAP }
});
