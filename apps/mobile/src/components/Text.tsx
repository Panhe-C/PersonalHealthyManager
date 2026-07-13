import { StyleSheet, Text as RNText, type TextProps } from "react-native";
import { typography, useTheme } from "../theme/tokens";

export function Text({ style, size = "md", weight = "regular", ...props }: TextProps & { size?: keyof typeof typography; weight?: "regular" | "medium" | "strong" }) {
  const { tokens } = useTheme();
  return (
    <RNText
      style={[
        styles.base,
        { color: tokens.ink, fontSize: typography[size], lineHeight: Math.round(typography[size] * 1.28) },
        weight === "medium" && styles.medium,
        weight === "strong" && styles.strong,
        (size === "display" || size === "hero" || size === "metric") && styles.editorial,
        style
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  base: {},
  editorial: { fontFamily: "Georgia" },
  medium: { fontWeight: "500" },
  strong: { fontWeight: "700" }
});
