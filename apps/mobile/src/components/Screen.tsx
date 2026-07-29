import { useContext } from "react";
import { ScrollView, StyleSheet, type ScrollViewProps } from "react-native";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FLOATING_TAB_BAR_CLEARANCE } from "../navigation/tabBarMetrics";
import { spacing, useTheme } from "../theme/tokens";

/**
 * Scroll container for every screen. `contentInsetAdjustmentBehavior="automatic"`
 * still lets the native stack header own the top inset on the tabs that keep
 * one (Today hides its header and pads the top itself). The floating capsule
 * tab bar is absolutely positioned, so BottomTabBarHeightContext cannot
 * measure it; its presence only tells us we are inside the tab navigator,
 * which is where the explicit FLOATING_TAB_BAR_CLEARANCE applies. The auth
 * screens render outside the navigator and fall back to the safe-area inset.
 * Pass `bottomClearance` when a screen needs a different bottom pad.
 */
export function Screen({
  bottomClearance,
  contentContainerStyle,
  children,
  ...props
}: ScrollViewProps & { bottomClearance?: number }) {
  const { tokens } = useTheme();
  const tabBarHeight = useContext(BottomTabBarHeightContext);
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      automaticallyAdjustsScrollIndicatorInsets
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: tokens.bg }}
      contentContainerStyle={[
        styles.content,
        {
          paddingBottom:
            bottomClearance ??
            (tabBarHeight === undefined ? insets.bottom + spacing.xl : FLOATING_TAB_BAR_CLEARANCE)
        },
        contentContainerStyle
      ]}
      {...props}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, gap: spacing.xl, paddingTop: spacing.sm }
});
