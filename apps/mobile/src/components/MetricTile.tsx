import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, type PressableProps } from "react-native";
import { radius, spacing, useTheme } from "../theme/tokens";
import { Text } from "./Text";

export function MetricTile({
  label,
  value,
  detail,
  tone = "sage",
  icon,
  onPress
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "sage" | "blue" | "clay" | "danger";
  icon?: ReactNode;
  onPress?: PressableProps["onPress"];
}) {
  const { tokens } = useTheme();
  const accent = tokens[tone];
  const soft = tokens[`${tone}Soft` as keyof typeof tokens] ?? tokens.panelSoft;
  const tileStyle = [styles.tile, { backgroundColor: soft, borderColor: tokens.line }];
  const content = (
    <>
      <View style={styles.topline}>
        <Text size="sm" style={{ color: tokens.muted }}>{label}</Text>
        {icon ? <View>{icon}</View> : null}
      </View>
      <Text size="xl" weight="strong" style={{ color: accent }}>{value}</Text>
      {detail ? <Text size="sm" style={{ color: tokens.muted }}>{detail}</Text> : null}
    </>
  );

  if (!onPress) {
    return <View style={tileStyle}>{content}</View>;
  }

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [tileStyle, pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xs,
    minWidth: 140,
    padding: spacing.md
  },
  pressed: { opacity: 0.82 },
  topline: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" }
});
