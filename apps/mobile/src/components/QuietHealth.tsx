import { StyleSheet, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
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

const styles = StyleSheet.create({
  ringCenter: { alignItems: "center", position: "absolute" },
  ringWrap: { alignItems: "center", height: RING_SIZE, justifyContent: "center", width: RING_SIZE }
});
