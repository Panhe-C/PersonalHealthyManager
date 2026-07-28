import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { spacing, useTheme } from "../theme/tokens";
import { Text } from "./Text";

export function Section({
  title,
  description,
  action,
  children
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const { tokens } = useTheme();

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text size="sm" weight="strong" style={{ color: tokens.sage, letterSpacing: 0.6 }}>{title}</Text>
          {description ? <Text size="sm" style={{ color: tokens.muted }}>{description}</Text> : null}
        </View>
        {action ? <View>{action}</View> : null}
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
  header: { alignItems: "center", flexDirection: "row", gap: spacing.md, justifyContent: "space-between" },
  headerCopy: { flex: 1, gap: spacing.xs },
  section: { gap: spacing.md }
});
