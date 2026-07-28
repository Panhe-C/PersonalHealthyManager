import { Pressable, StyleSheet, View, type PressableProps, type ViewProps } from "react-native";
import { opacity, radius, spacing, useTheme } from "../theme/tokens";

type CardProps = ViewProps & Pick<PressableProps, "disabled" | "onLongPress" | "onPress">;

export function Card({ disabled, onLongPress, onPress, style, ...props }: CardProps) {
  const { tokens } = useTheme();
  const cardStyle = [styles.card, { backgroundColor: tokens.panel, borderColor: tokens.line }, style];

  if (!onPress && !onLongPress) {
    return <View style={cardStyle} {...props} />;
  }

  return (
    <Pressable
      accessibilityRole={props.accessibilityRole ?? "button"}
      disabled={disabled}
      onLongPress={onLongPress}
      onPress={onPress}
      style={({ pressed }) => [cardStyle, pressed && styles.pressed, disabled && styles.disabled]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1 },
  disabled: { opacity: opacity.disabled },
  pressed: { opacity: opacity.pressed }
});
