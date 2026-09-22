import { Pressable, StyleSheet } from "react-native";
import { Sparkles } from "lucide-react-native";
import { opacity, radius, spacing, useTheme } from "../theme/tokens";
import { Text } from "./Text";

export function AskAiButton({ onPress }: { onPress: () => void }) {
  const { tokens } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Ask AI 分析这次数据"
      onPress={onPress}
      style={({ pressed }) => [
        styles.askButton,
        {
          backgroundColor: tokens.surface,
          borderColor: tokens.separator,
          opacity: pressed ? opacity.pressed : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }]
        }
      ]}
    >
      <Sparkles color={tokens.tint} size={13} strokeWidth={2} />
      <Text size="caption" weight="semibold" color={tokens.tint}>
        Ask AI
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  askButton: {
    alignItems: "center",
    alignSelf: "flex-end",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 30,
    paddingHorizontal: 10,
    paddingVertical: 5
  }
});
