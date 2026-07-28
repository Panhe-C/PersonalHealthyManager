import { ActivityIndicator, StyleSheet, View, type ViewProps } from "react-native";
import { spacing, useTheme } from "../theme/tokens";
import { Text } from "./Text";

export function Spinner({ style, ...props }: ViewProps) {
  const { tokens } = useTheme();
  return (
    <View style={[styles.center, style]} {...props}>
      <ActivityIndicator color={tokens.sage} />
    </View>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  const { tokens } = useTheme();
  return (
    <View style={styles.center}>
      <Text weight="strong" style={{ textAlign: "center" }}>{title}</Text>
      {description ? <Text size="sm" style={{ color: tokens.muted, textAlign: "center" }}>{description}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", gap: spacing.sm, justifyContent: "center", padding: 24 }
});
