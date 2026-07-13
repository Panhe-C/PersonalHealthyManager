import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { spacing, useTheme } from "../theme/tokens";
import { Text } from "./Text";

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  const { tokens } = useTheme();

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text size="lg" weight="strong">{title}</Text>
        {action ? <View>{action}</View> : null}
      </View>
      <View style={[styles.body, { borderColor: tokens.line }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  body: { gap: spacing.sm }
});
