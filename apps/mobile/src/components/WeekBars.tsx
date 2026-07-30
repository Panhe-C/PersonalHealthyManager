import { StyleSheet, View } from "react-native";
import { spacing, useTheme } from "../theme/tokens";
import { Text } from "./Text";

// Geometry mirrors the Today sleep card (which keeps its inline version per
// the spec's non-goals) so both weekly bar cards read identically.
const BAR_MAX_HEIGHT = 72;
const BAR_MIN_HEIGHT = 6;
const BAR_WIDTH = 18;
const BAR_RADIUS = 6;

/** Colour slots the two weekly charts need: empty/placeholder days and the
 *  latest sleep night use fill/controlFill; dominant exercise intensity maps
 *  to tintFill (轻松) / orange (中等) / red (高). */
export type WeekBarTone = "fill" | "controlFill" | "tintFill" | "orange" | "red";

export type WeekBar = {
  key: string;
  label: string;
  value: number;
  tone: WeekBarTone;
  accessibilityLabel: string;
  /** Small figure above the bar (e.g. "87%"). The slot is always reserved so
   *  columns with and without figures stay aligned. */
  valueLabel?: string;
};

/** Shared 7-bar chart for the weekly exercise and sleep cards. Dumb: values,
 *  colours and a11y labels all arrive via props. Empty days render as a short
 *  placeholder bar, so every column stays visible. */
export function WeekBars({ bars }: { bars: WeekBar[] }) {
  const { tokens } = useTheme();
  const maxValue = Math.max(...bars.map((bar) => bar.value), 1);
  // Only reserve the figure row when a caller actually uses it, so the
  // exercise/sleep cards keep their original spacing.
  const showValues = bars.some((bar) => bar.valueLabel);

  return (
    <View style={styles.barRow}>
      {bars.map((bar) => (
        <View key={bar.key} accessible accessibilityLabel={bar.accessibilityLabel} style={styles.barCol}>
          {showValues ? (
            <Text size="caption2" color={tokens.labelSecondary}>
              {bar.valueLabel ?? " "}
            </Text>
          ) : null}
          <View
            style={[
              styles.bar,
              {
                backgroundColor: tokens[bar.tone],
                height: Math.max(BAR_MIN_HEIGHT, Math.round((bar.value / maxValue) * BAR_MAX_HEIGHT))
              }
            ]}
          />
          <Text size="caption2" color={tokens.labelSecondary}>
            {bar.label}
          </Text>
        </View>
      ))}
    </View>
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
  }
});
