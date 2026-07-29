import { Pressable, StyleSheet, type PressableProps } from "react-native";
import { radius, spacing, useTheme } from "../theme/tokens";
import { Text } from "./Text";

type Variant = "filled" | "tinted" | "plain" | "destructive";

type ButtonProps = PressableProps & {
  label?: string;
  title?: string;
  variant?: Variant;
};

export function Button({
  label,
  title,
  variant = "filled",
  disabled,
  style,
  ...props
}: ButtonProps) {
  const { tokens } = useTheme();
  const backgroundColor =
    variant === "filled"
      ? tokens.controlFill
      : variant === "destructive"
        ? tokens.destructiveFill
        : variant === "tinted"
          ? tokens.fill
          : "transparent";
  const color =
    variant === "filled"
      ? tokens.controlLabel
      : variant === "destructive"
        ? tokens.destructiveLabel
        : tokens.tint;
  const buttonLabel = label ?? title ?? "";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      style={(state) => [
        styles.base,
        {
          backgroundColor,
          opacity: disabled ? 0.45 : state.pressed ? 0.65 : 1
        },
        typeof style === "function" ? style(state) : style
      ]}
      {...props}
    >
      <Text size="headline" style={{ color }}>
        {buttonLabel}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    borderRadius: radius.md,
    justifyContent: "center",
    marginHorizontal: spacing.md,
    minHeight: 50,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm
  }
});
