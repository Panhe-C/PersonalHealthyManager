import { SafeAreaView, StyleSheet, type ViewProps } from "react-native";
import { spacing, useTheme } from "../theme/tokens";

export function Screen({ style, ...props }: ViewProps) {
  const { tokens } = useTheme();
  return <SafeAreaView style={[styles.screen, { backgroundColor: tokens.bg }, style]} {...props} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: spacing.lg }
});
