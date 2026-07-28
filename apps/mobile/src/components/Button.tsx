import { Pressable, StyleSheet, type PressableProps } from "react-native";
import { Text } from "./Text";
import { opacity, radius, spacing, useTheme } from "../theme/tokens";

export function Button({ title, onPress, variant = "primary", disabled, ...props }: PressableProps & { title: string; variant?: "primary" | "ghost" | "danger" }) {
  const { tokens } = useTheme();
  const isPrimary = variant === "primary";
  const isDanger = variant === "danger";
  const backgroundColor = isPrimary ? tokens.sage : isDanger ? tokens.danger : "transparent";
  const borderColor = isPrimary ? tokens.sage : isDanger ? tokens.danger : tokens.line;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor, borderColor, opacity: pressed ? opacity.pressed : 1 },
        disabled && styles.disabled
      ]}
      {...props}
    >
      <Text size="md" weight="medium" style={{ color: isPrimary || isDanger ? "#fff" : tokens.ink, textAlign: "center" }}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 48, justifyContent: "center", paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.md, borderWidth: 1 },
  disabled: { opacity: opacity.disabled }
});
