import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle
} from "react-native";
import { X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { opacity, radius, spacing, useTheme } from "../theme/tokens";

type CardFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ExpandingCardCloseOptions = {
  immediate?: boolean;
  onClosed?: () => void;
};

export type ExpandingCardDetailApi = {
  close: (options?: ExpandingCardCloseOptions) => void;
};

type DetailContent = ReactNode | ((api: ExpandingCardDetailApi) => ReactNode);

/**
 * Shared-element style expand: the card itself grows from its on-screen
 * rectangle to the full window. The compact summary stays pinned to the top
 * during the growth so the motion reads as one continuous object, not a zoom
 * followed by a new page. Detail content fades in only after the frame is
 * mostly open.
 */
export function ExpandingCard({
  accessibilityLabel,
  accessibilityHint,
  cardStyle,
  summaryStyle,
  summary,
  detail
}: {
  accessibilityLabel: string;
  accessibilityHint: string;
  cardStyle?: StyleProp<ViewStyle>;
  summaryStyle?: StyleProp<ViewStyle>;
  summary: ReactNode;
  detail: DetailContent;
}) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const sourceRef = useRef<View>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const [origin, setOrigin] = useState<CardFrame | null>(null);
  const [visible, setVisible] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => subscription.remove();
  }, []);

  function animateOpen(frame: CardFrame) {
    progress.stopAnimation();
    progress.setValue(0);
    setOrigin(frame);
    setVisible(true);
    // Wait one frame so the Modal paints at the source rect before growing.
    requestAnimationFrame(() => {
      Animated.timing(progress, {
        toValue: 1,
        duration: reduceMotion ? 0 : 320,
        easing: Easing.bezier(0.32, 0.72, 0, 1),
        useNativeDriver: false
      }).start();
    });
  }

  function open() {
    const node = sourceRef.current;
    if (!node) {
      animateOpen({ x: 20, y: 120, width: Math.max(160, windowWidth - 40), height: 160 });
      return;
    }

    node.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) {
        animateOpen({ x, y, width, height });
        return;
      }
      animateOpen({
        x: 20,
        y: 120,
        width: Math.max(160, windowWidth - 40),
        height: Math.max(140, height || 160)
      });
    });
  }

  function close(options?: ExpandingCardCloseOptions) {
    const finish = () => {
      setVisible(false);
      setOrigin(null);
      options?.onClosed?.();
    };

    progress.stopAnimation();
    if (options?.immediate || reduceMotion) {
      progress.setValue(0);
      finish();
      return;
    }

    Animated.timing(progress, {
      toValue: 0,
      duration: 220,
      easing: Easing.bezier(0.23, 1, 0.32, 1),
      useNativeDriver: false
    }).start(({ finished }) => {
      if (!finished) return;
      finish();
    });
  }

  const frameStyle = origin
    ? {
        left: progress.interpolate({ inputRange: [0, 1], outputRange: [origin.x, 0] }),
        top: progress.interpolate({ inputRange: [0, 1], outputRange: [origin.y, 0] }),
        width: progress.interpolate({ inputRange: [0, 1], outputRange: [origin.width, windowWidth] }),
        height: progress.interpolate({ inputRange: [0, 1], outputRange: [origin.height, windowHeight] }),
        borderRadius: progress.interpolate({ inputRange: [0, 1], outputRange: [radius.card, 0] })
      }
    : null;

  // Keep the summary fully visible while the card grows; only fade it once the
  // frame has nearly filled the screen. That avoids the "zoom then swap page" feel.
  const summaryOpacity = progress.interpolate({
    inputRange: [0, 0.72, 0.9, 1],
    outputRange: [1, 1, 0.35, 0]
  });
  const detailOpacity = progress.interpolate({
    inputRange: [0, 0.55, 0.78, 1],
    outputRange: [0, 0, 0.75, 1]
  });
  const detailTranslate = progress.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [18, 18, 0]
  });
  const detailContent = typeof detail === "function" ? detail({ close }) : detail;

  return (
    <>
      <View
        ref={sourceRef}
        collapsable={false}
        style={[cardStyle, visible ? styles.hiddenSource : null]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={accessibilityHint}
          accessibilityState={{ expanded: visible }}
          disabled={visible}
          onPress={open}
          style={({ pressed }) => [
            styles.pressableFill,
            pressed && !visible ? { opacity: opacity.pressed, transform: [{ scale: 0.985 }] } : null
          ]}
        >
          <View pointerEvents="none" style={summaryStyle}>
            {summary}
          </View>
        </Pressable>
      </View>

      <Modal
        animationType="none"
        navigationBarTranslucent
        onRequestClose={() => close()}
        statusBarTranslucent
        transparent
        visible={visible && Boolean(origin)}
      >
        <View style={styles.modalRoot}>
          <Animated.View
            accessibilityViewIsModal
            style={[
              styles.expandedCard,
              frameStyle,
              { backgroundColor: tokens.surface }
            ]}
          >
            <Animated.View
              pointerEvents="none"
              style={[styles.summaryLayer, summaryStyle, { opacity: summaryOpacity }]}
            >
              {summary}
            </Animated.View>

            <Animated.View
              pointerEvents={visible ? "auto" : "none"}
              style={[
                styles.detailLayer,
                {
                  opacity: detailOpacity,
                  transform: [{ translateY: detailTranslate }]
                }
              ]}
            >
              {detailContent}
            </Animated.View>

            <Animated.View style={[styles.closeWrap, { opacity: detailOpacity, top: insets.top + spacing.sm }]}>
              <Pressable
                accessibilityLabel="关闭"
                accessibilityRole="button"
                hitSlop={12}
                onPress={() => close()}
                style={({ pressed }) => [
                  styles.closeButton,
                  { backgroundColor: tokens.fill },
                  pressed ? { opacity: opacity.pressed, transform: [{ scale: 0.94 }] } : null
                ]}
              >
                <X color={tokens.label} size={20} strokeWidth={2} />
              </Pressable>
            </Animated.View>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  closeButton: {
    alignItems: "center",
    borderRadius: radius.pill,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  closeWrap: {
    position: "absolute",
    right: spacing.lg,
    zIndex: 3
  },
  detailLayer: {
    ...StyleSheet.absoluteFillObject
  },
  expandedCard: {
    overflow: "hidden",
    position: "absolute"
  },
  hiddenSource: {
    opacity: 0
  },
  modalRoot: {
    flex: 1
  },
  pressableFill: {
    flexGrow: 1
  },
  summaryLayer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0
  }
});
