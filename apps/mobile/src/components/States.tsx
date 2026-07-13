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

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { tokens } = useTheme();
  return (
    <View style={styles.center}>
      <ActivityIndicator color={tokens.danger} />
      <Text style={{ color: tokens.danger, textAlign: "center" }}>{message}</Text>
    </View>
  );
}

export function EmptyState({ message, title, description }: { message?: string; title?: string; description?: string }) {
  const { tokens } = useTheme();
  return (
    <View style={styles.center}>
      {title ? <Text weight="strong" style={{ textAlign: "center" }}>{title}</Text> : null}
      <Text size="sm" style={{ color: tokens.muted, textAlign: "center" }}>{description ?? message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", gap: spacing.sm, justifyContent: "center", padding: 24 }
});
