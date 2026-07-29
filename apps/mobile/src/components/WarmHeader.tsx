import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { cardShadow, radius, spacing, useTheme } from "../theme/tokens";
import { Text } from "./Text";

/**
 * Shared in-page header for the tab roots that hide their native header
 * (今日/计划/数据/我的): a small overline above a 30pt strong title, with
 * optional trailing circular surface icon buttons. Screens render it as the
 * first child of Screen and pad the safe-area top inset themselves through
 * Screen's contentContainerStyle, the pattern Today established in phase 1.
 */
export function WarmHeader({
  overline,
  title,
  actions
}: {
  overline: string;
  title: string;
  actions?: ReactNode;
}) {
  const { tokens } = useTheme();

  return (
    <View style={styles.headerRow}>
      <View style={styles.headerCopy}>
        <Text size="footnote" color={tokens.labelSecondary}>
          {overline}
        </Text>
        <Text size="title1" weight="strong" style={styles.pageTitle}>
          {title}
        </Text>
      </View>
      {actions ? <View style={styles.headerActions}>{actions}</View> : null}
    </View>
  );
}

/**
 * The trailing circular button of a WarmHeader: a 42pt pill on a surface
 * background with the card shadow. The icon comes in as children so each
 * screen picks its own glyph and tint.
 */
export function WarmHeaderButton({
  accessibilityLabel,
  disabled,
  onPress,
  children
}: {
  accessibilityLabel: string;
  disabled?: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  const { tokens, isDark } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.circleButton, { backgroundColor: tokens.surface }, cardShadow(isDark ? "dark" : "light")]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circleButton: {
    alignItems: "center",
    borderRadius: radius.pill,
    height: 42,
    justifyContent: "center",
    width: 42
  },
  headerActions: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  headerCopy: { flex: 1 },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 20
  },
  pageTitle: { fontSize: 30, letterSpacing: -0.5, lineHeight: 36, marginTop: 2 }
});
