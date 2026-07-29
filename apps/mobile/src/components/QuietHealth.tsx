import { StyleSheet, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { useTheme } from "../theme/tokens";
import { Text } from "./Text";

// Readiness ring geometry (spec: 116pt ring, 10pt stroke). Named once so the
// arc math below stays readable.
const RING_SIZE = 116;
const RING_STROKE = 10;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CENTER = RING_SIZE / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function ReadinessRing({ value, label = "准备就绪" }: { value: number; label?: string }) {
  const { tokens } = useTheme();
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <View style={styles.ringWrap}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Circle
          cx={RING_CENTER}
          cy={RING_CENTER}
          r={RING_RADIUS}
          fill="none"
          stroke={tokens.fill}
          strokeWidth={RING_STROKE}
        />
        <Circle
          cx={RING_CENTER}
          cy={RING_CENTER}
          r={RING_RADIUS}
          fill="none"
          stroke={tokens.tint}
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
          strokeDashoffset={RING_CIRCUMFERENCE * (1 - safeValue / 100)}
          rotation="-90"
          origin={`${RING_CENTER}, ${RING_CENTER}`}
        />
      </Svg>
      <View style={styles.ringCenter}>
        <Text size="title1" weight="strong" tabularNums>
          {safeValue}
        </Text>
        <Text size="caption2" color={tokens.labelSecondary}>
          {label}
        </Text>
      </View>
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
  ringCenter: { alignItems: "center", position: "absolute" },
  ringWrap: { alignItems: "center", height: RING_SIZE, justifyContent: "center", width: RING_SIZE }
});
