import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from "react-native";
import { RefreshCw } from "lucide-react-native";
import { cardShadow, radius, spacing, useTheme } from "../theme/tokens";
import { Text } from "./Text";

const enterEasing = Easing.bezier(0.23, 1, 0.32, 1);

export function RecentSyncIndicator({
  visible,
  top,
  days = 2
}: {
  visible: boolean;
  top: number;
  days?: number;
}) {
  const dayLabel = days === 2 ? "近两日" : `近 ${days} 日`;

  const { tokens, isDark } = useTheme();
  const [reduceMotion, setReduceMotion] = useState(false);
  const presence = useRef(new Animated.Value(0)).current;
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const presenceAnimation = Animated.timing(presence, {
      toValue: visible ? 1 : 0,
      duration: visible ? 180 : 120,
      easing: visible ? enterEasing : Easing.out(Easing.quad),
      useNativeDriver: true
    });
    presenceAnimation.start();

    let rotationAnimation: Animated.CompositeAnimation | undefined;
    if (visible && !reduceMotion) {
      rotation.setValue(0);
      rotationAnimation = Animated.loop(
        Animated.timing(rotation, {
          toValue: 1,
          duration: 700,
          easing: Easing.linear,
          useNativeDriver: true
        })
      );
      rotationAnimation.start();
    }

    return () => {
      presenceAnimation.stop();
      rotationAnimation?.stop();
    };
  }, [presence, reduceMotion, rotation, visible]);

  return (
    <Animated.View
      accessibilityElementsHidden={!visible}
      accessibilityLiveRegion="polite"
      accessibilityRole="progressbar"
      accessibilityLabel={`正在同步${dayLabel}数据`}
      importantForAccessibility={visible ? "yes" : "no-hide-descendants"}
      pointerEvents="none"
      style={[
        styles.layer,
        {
          opacity: presence,
          top,
          transform: [
            {
              translateY: reduceMotion
                ? 0
                : presence.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] })
            },
            {
              scale: reduceMotion
                ? 1
                : presence.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] })
            }
          ]
        }
      ]}
    >
      <View
        style={[
          styles.pill,
          { backgroundColor: tokens.surface, borderColor: tokens.separator },
          cardShadow(isDark ? "dark" : "light")
        ]}
      >
        <View style={[styles.iconTile, { backgroundColor: tokens.tintFill }]}>
          <Animated.View
            style={{
              transform: [
                {
                  rotate: rotation.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0deg", "360deg"]
                  })
                }
              ]
            }}
          >
            <RefreshCw color={tokens.controlLabel} size={15} strokeWidth={2.2} />
          </Animated.View>
        </View>
        <View style={styles.copy}>
          <Text size="footnote" weight="semibold">同步{dayLabel}</Text>
          <Text size="caption2" color={tokens.labelSecondary}>运动 · 睡眠 · 恢复</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  copy: { gap: 1 },
  iconTile: {
    alignItems: "center",
    borderRadius: radius.pill,
    height: 30,
    justifyContent: "center",
    width: 30
  },
  layer: {
    alignItems: "center",
    left: 0,
    position: "absolute",
    right: 0,
    zIndex: 10
  },
  pill: {
    alignItems: "center",
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7
  }
});
