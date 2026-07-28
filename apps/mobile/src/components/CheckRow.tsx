import { Pressable, StyleSheet, View } from "react-native";
import { Check } from "lucide-react-native";
import { spacing, useTheme } from "../theme/tokens";
import { Text } from "./Text";

export type CheckStatus = "pending" | "completed" | "skipped";

/**
 * Checklist row for training tasks. Tapping cycles the status upstream; this
 * component only renders the three states.
 */
export function CheckRow({
  label,
  status,
  onPress,
  disabled = false
}: {
  label: string;
  status: CheckStatus;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const { tokens } = useTheme();
  const completed = status === "completed";
  const skipped = status === "skipped";
  const isDisabled = disabled || !onPress;

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: skipped ? "mixed" : completed, disabled: isDisabled }}
      accessibilityValue={skipped ? { text: "已跳过" } : undefined}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? { backgroundColor: tokens.fill } : null]}
    >
      <View
        style={[
          styles.box,
          completed
            ? { backgroundColor: tokens.controlFill, borderColor: tokens.controlFill }
            : { borderColor: tokens.separatorOpaque }
        ]}
      >
        {completed ? <Check color={tokens.controlLabel} size={15} strokeWidth={3} /> : null}
        {skipped ? <View style={[styles.dash, { backgroundColor: tokens.labelTertiary }]} /> : null}
      </View>

      <Text
        size="body"
        color={skipped ? tokens.labelSecondary : tokens.label}
        style={[styles.label, skipped ? styles.struck : null]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: "center",
    borderRadius: 11,
    borderWidth: 1.5,
    height: 22,
    justifyContent: "center",
    width: 22
  },
  dash: { height: 1.5, width: 10 },
  label: { flex: 1 },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm
  },
  struck: { textDecorationLine: "line-through" }
});
