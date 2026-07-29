import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { spacing, useTheme } from "../theme/tokens";
import { Text } from "./Text";

export function MetricStrip({ items }: { items: { label: string; value: string; icon?: ReactNode }[] }) {
  const { tokens } = useTheme();
  return (
    <View style={styles.metricStrip}>
      {items.map((item, index) => (
        <View key={item.label} style={[styles.metricItem, index > 0 && { borderLeftColor: tokens.separator, borderLeftWidth: 1 }]}>
          {item.icon}
          <Text size="caption" color={tokens.labelSecondary}>{item.label}</Text>
          <Text size="title3" color={tokens.label} tabularNums>{item.value}</Text>
        </View>
      ))}
    </View>
  );
}

export function ReadinessRing({ value, label = "准备就绪" }: { value: number; label?: string }) {
  const { tokens } = useTheme();
  const safeValue = Math.max(0, Math.min(100, value));
  const circumference = 2 * Math.PI * 72;
  return (
    <View style={styles.ringWrap}>
      <Svg width={188} height={188} viewBox="0 0 188 188" style={StyleSheet.absoluteFill}>
        <Circle cx="94" cy="94" r="72" fill="none" stroke={tokens.separator} strokeWidth="3" />
        <Circle
          cx="94" cy="94" r="72" fill="none" stroke={tokens.tintFill} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - safeValue / 100)}
          rotation="-90" origin="94, 94"
        />
      </Svg>
      <Text size="metric" color={tokens.label} tabularNums>{safeValue}</Text>
      <Text size="subheadline" color={tokens.labelSecondary}>{label}</Text>
    </View>
  );
}

export function TrendChart({ values }: { values: number[] }) {
  const { tokens } = useTheme();
  const safe = values.length > 1 ? values : [0, 0];
  const width = 320;
  const height = 150;
  const min = Math.min(...safe, 0);
  const max = Math.max(...safe, 100);
  const points = safe.map((value, index) => {
    const x = 12 + (index * (width - 24)) / (safe.length - 1);
    const y = height - 14 - ((value - min) / Math.max(1, max - min)) * (height - 28);
    return { x, y };
  });
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

  return (
    <View style={styles.chartWrap}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Line x1="12" y1={height - 14} x2={width - 12} y2={height - 14} stroke={tokens.separator} strokeWidth="1" />
        <Path d={path} fill="none" stroke={tokens.tint} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) => <Circle key={index} cx={point.x} cy={point.y} r="5" fill={tokens.surface} stroke={tokens.tint} strokeWidth="2.5" />)}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  chartWrap: { width: "100%" },
  metricItem: { alignItems: "center", flex: 1, gap: spacing.xs, minWidth: 0, paddingHorizontal: spacing.sm },
  metricStrip: { flexDirection: "row", marginHorizontal: -spacing.sm },
  ringWrap: { alignItems: "center", alignSelf: "center", height: 188, justifyContent: "center", width: 188 }
});
