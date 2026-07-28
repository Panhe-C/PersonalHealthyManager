import { useContext } from "react";
import { ScrollView, StyleSheet, type ScrollViewProps } from "react-native";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing, useTheme } from "../theme/tokens";

export function Screen({ contentContainerStyle, children, ...props }: ScrollViewProps) {
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
        { paddingBottom: (tabBarHeight ?? insets.bottom) + spacing.xl },
        contentContainerStyle
      ]}
      {...props}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    gap: spacing.xl,
    paddingTop: spacing.sm
  }
});
