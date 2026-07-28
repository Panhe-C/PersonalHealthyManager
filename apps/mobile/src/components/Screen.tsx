import { SafeAreaView, ScrollView, StyleSheet, type ScrollViewProps } from "react-native";
import { spacing, useTheme } from "../theme/tokens";

/**
 * Uses React Native's position-aware SafeAreaView on purpose: the same Screen is
 * rendered both as a headerless tab and as a pushed page under a native header,
 * where the frame-based SafeAreaView from react-native-safe-area-context would
 * add the device inset a second time.
 */
export function Screen({ style, contentContainerStyle, children, ...props }: ScrollViewProps) {
  const { tokens } = useTheme();
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={styles.scroll}
        contentContainerStyle={[styles.content, contentContainerStyle, style]}
        {...props}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.xl }
});
