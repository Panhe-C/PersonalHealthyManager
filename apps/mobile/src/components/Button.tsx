import { Pressable, StyleSheet, type PressableProps } from "react-native";
import { Text } from "./Text";
import { radius, spacing, useTheme } from "../theme/tokens";

export function Button({ title, onPress, variant = "primary", disabled, ...props }: PressableProps & { title: string; variant?: "primary" | "ghost" }) {
  const { tokens } = useTheme();
  const isPrimary = variant === "primary";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: isPrimary ? tokens.sage : "transparent", borderColor: isPrimary ? tokens.sage : tokens.line, opacity: pressed ? 0.78 : 1 },
        disabled && styles.disabled
      ]}
      {...props}
    >
      <Text size="md" weight="medium" style={{ color: isPrimary ? "#fff" : tokens.ink, textAlign: "center" }}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 48, justifyContent: "center", paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.md, borderWidth: 1 },
  disabled: { opacity: 0.5 }
});
