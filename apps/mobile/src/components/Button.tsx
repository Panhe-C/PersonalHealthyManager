import { Pressable, StyleSheet, type PressableProps } from "react-native";
import { radius, spacing, useTheme } from "../theme/tokens";
import { Text } from "./Text";

type Variant =
  | "filled"
  | "tinted"
  | "plain"
  | "destructive"
  | "primary"
  | "ghost"
  | "danger";

type ButtonProps = PressableProps & {
  label?: string;
  title?: string;
  variant?: Variant;
};

const variantAliases: Record<Variant, "filled" | "tinted" | "plain" | "destructive"> = {
  filled: "filled",
  tinted: "tinted",
  plain: "plain",
  destructive: "destructive",
  primary: "filled",
  ghost: "plain",
  danger: "destructive"
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
  const resolvedVariant = variantAliases[variant];
  const backgroundColor =
    resolvedVariant === "filled"
      ? tokens.controlFill
      : resolvedVariant === "destructive"
        ? tokens.destructiveFill
        : resolvedVariant === "tinted"
          ? tokens.fill
          : "transparent";
  const color =
    resolvedVariant === "filled"
      ? tokens.controlLabel
      : resolvedVariant === "destructive"
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
