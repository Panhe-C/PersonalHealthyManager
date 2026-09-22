import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { spacing, useTheme } from "../theme/tokens";
import { Text } from "./Text";

/**
 * iOS list row, meant to sit inside an InsetGroup. Presses tint the whole row
 * with the system fill colour rather than fading it, which is what UIKit does
 * for selection. Separators are the group's job, not the row's.
 */
export function Row({
  icon,
  title,
  subtitle,
  value,
  onPress,
  destructive = false,
  trailing,
  disabled = false
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  trailing?: ReactNode;
  disabled?: boolean;
}) {
  const { tokens } = useTheme();
  const body = (
    <>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <View style={styles.copy}>
        <Text size="body" color={destructive ? tokens.red : tokens.label}>
          {title}
        </Text>
        {subtitle ? (
          <Text size="footnote" color={tokens.labelSecondary}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text size="body" color={tokens.labelSecondary} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {trailing}
      {onPress && !trailing ? (
        <ChevronRight color={tokens.labelTertiary} size={17} strokeWidth={2.2} />
      ) : null}
    </>
  );

  if (!onPress) {
    return <View style={[styles.row, subtitle ? styles.rowTall : null]}>{body}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        subtitle ? styles.rowTall : null,
        pressed ? { backgroundColor: tokens.fill } : null
      ]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  copy: { flex: 1, gap: 1 },
  icon: { alignItems: "center", justifyContent: "center", width: 28 },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm
  },
  rowTall: { minHeight: 60 }
});
