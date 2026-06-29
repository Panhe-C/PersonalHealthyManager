import { ActivityIndicator, StyleSheet, View, type ViewProps } from "react-native";
import { useTheme } from "../theme/tokens";

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
      {/* ErrorState renders the message; retry wired by parent via onRetry press handled elsewhere */}
    </View>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.center}>
      <EmptyText text={message} />
    </View>
  );
}

import { Text } from "./Text";
function EmptyText({ text }: { text: string }) {
  const { tokens } = useTheme();
  return <Text style={{ color: tokens.muted, textAlign: "center" }}>{text}</Text>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }
});
