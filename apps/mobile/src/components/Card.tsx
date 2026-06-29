import { StyleSheet, View, type ViewProps } from "react-native";
import { radius, spacing, useTheme } from "../theme/tokens";

export function Card({ style, ...props }: ViewProps) {
  const { tokens } = useTheme();
  return <View style={[styles.card, { backgroundColor: tokens.panel, borderColor: tokens.line }, style]} {...props} />;
}

const styles = StyleSheet.create({
  card: { padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1 }
});
