import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { ChevronRight } from "lucide-react-native";
import { opacity, spacing, useTheme } from "../theme/tokens";
import { Text } from "./Text";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  const { tokens } = useTheme();
  return (
    <View style={styles.pageHeader}>
      <View style={styles.headerCopy}>
        <Text size="display" weight="strong" style={{ color: tokens.inkStrong }}>{title}</Text>
        {subtitle ? <Text style={{ color: tokens.muted }}>{subtitle}</Text> : null}
      </View>
      {action ? <View>{action}</View> : null}
    </View>
  );
}

export function MetricStrip({ items }: { items: { label: string; value: string; icon?: ReactNode }[] }) {
  const { tokens } = useTheme();
  return (
    <View style={styles.metricStrip}>
      {items.map((item, index) => (
        <View key={item.label} style={[styles.metricItem, index > 0 && { borderLeftColor: tokens.line, borderLeftWidth: 1 }]}>
          {item.icon}
          <Text size="sm" style={{ color: tokens.muted }}>{item.label}</Text>
          <Text size="xl" weight="strong" style={{ color: tokens.inkStrong }}>{item.value}</Text>
        </View>
      ))}
    </View>
  );
}

export function HairlineRow({ icon, title, subtitle, value, onPress, danger = false, trailing }: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  trailing?: ReactNode;
}) {
  const { tokens } = useTheme();
  const content = (
    <>
      {icon ? <View style={styles.rowIcon}>{icon}</View> : null}
      <View style={styles.rowCopy}>
        <Text weight="medium" style={{ color: danger ? tokens.danger : tokens.ink }}>{title}</Text>
        {subtitle ? <Text size="sm" style={{ color: tokens.muted }}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={{ color: danger ? tokens.danger : tokens.sage }}>{value}</Text> : null}
      {trailing}
      {onPress && !trailing ? <ChevronRight color={tokens.muted} size={18} strokeWidth={1.6} /> : null}
    </>
  );
  const sharedStyle = [styles.hairlineRow, { borderBottomColor: tokens.line }];
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [sharedStyle, pressed && styles.pressed]}>{content}</Pressable>
  ) : <View style={sharedStyle}>{content}</View>;
}

export function ReadinessRing({ value, label = "准备就绪" }: { value: number; label?: string }) {
  const { tokens } = useTheme();
  const safeValue = Math.max(0, Math.min(100, value));
  const circumference = 2 * Math.PI * 72;
  return (
    <View style={styles.ringWrap}>
      <Svg width={188} height={188} viewBox="0 0 188 188" style={StyleSheet.absoluteFill}>
        <Circle cx="94" cy="94" r="72" fill="none" stroke={tokens.line} strokeWidth="3" />
        <Circle
          cx="94" cy="94" r="72" fill="none" stroke={tokens.sage} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - safeValue / 100)}
          rotation="-90" origin="94, 94"
        />
      </Svg>
      <Text size="metric" weight="regular" style={{ color: tokens.inkStrong }}>{safeValue}</Text>
      <Text style={{ color: tokens.sage }}>{label}</Text>
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
        <Line x1="12" y1={height - 14} x2={width - 12} y2={height - 14} stroke={tokens.line} strokeWidth="1" />
        <Path d={path} fill="none" stroke={tokens.sage} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) => <Circle key={index} cx={point.x} cy={point.y} r="5" fill={tokens.bg} stroke={tokens.sage} strokeWidth="2.5" />)}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  chartWrap: { width: "100%" },
  hairlineRow: { alignItems: "center", borderBottomWidth: 1, flexDirection: "row", gap: spacing.md, minHeight: 68, paddingVertical: spacing.md },
  headerCopy: { flex: 1, gap: spacing.xs },
  metricItem: { alignItems: "center", flex: 1, gap: spacing.xs, minWidth: 0, paddingHorizontal: spacing.sm },
  metricStrip: { flexDirection: "row", marginHorizontal: -spacing.sm },
  pageHeader: { alignItems: "flex-start", flexDirection: "row", gap: spacing.md, justifyContent: "space-between" },
  pressed: { opacity: opacity.pressed },
  ringWrap: { alignItems: "center", alignSelf: "center", height: 188, justifyContent: "center", width: 188 },
  rowCopy: { flex: 1, gap: 2 },
  rowIcon: { alignItems: "center", justifyContent: "center", width: 28 }
});
