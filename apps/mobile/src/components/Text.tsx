import { StyleSheet, Text as RNText, type TextProps } from "react-native";
import { textStyles, useTheme } from "../theme/tokens";

const weights = {
  regular: "400",
  medium: "500",
  semibold: "600",
  strong: "700",
  bold: "700"
} as const;

// UIKit preferred text styles are regular by default except headline.
// Callers opt into stronger emphasis explicitly.
const semiboldSizes = new Set(["headline"]);

export function Text({
  style,
  size = "body",
  weight,
  color,
  tabularNums = false,
  ...props
}: TextProps & {
  size?: keyof typeof textStyles;
  weight?: keyof typeof weights;
  color?: string;
  tabularNums?: boolean;
}) {
  const { tokens } = useTheme();
  const fallbackWeight = semiboldSizes.has(size) ? "semibold" : "regular";

  return (
    <RNText
      style={[
        textStyles[size],
        { color: color ?? tokens.label, fontWeight: weights[weight ?? fallbackWeight] },
        tabularNums && styles.tabular,
        style
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  tabular: { fontVariant: ["tabular-nums"] }
});
