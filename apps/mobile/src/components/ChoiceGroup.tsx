import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { opacity, radius, spacing, useTheme } from "../theme/tokens";

export function ChoiceGroup<Value extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false
}: {
  label?: string;
  options: readonly { value: Value; label: string }[];
  value: Value;
  onChange: (value: Value) => void;
  disabled?: boolean;
}) {
  const { tokens } = useTheme();

  return (
    <View style={styles.group}>
      {label ? <Text size="sm" style={{ color: tokens.muted }}>{label}</Text> : null}
      <View style={styles.options}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              disabled={disabled}
              key={option.value}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.chip,
                { backgroundColor: selected ? tokens.sage : tokens.panelSoft, borderColor: selected ? tokens.sage : tokens.line },
                pressed && { opacity: opacity.pressed },
                disabled && { opacity: opacity.disabled }
              ]}
            >
              <Text size="sm" weight={selected ? "medium" : "regular"} style={{ color: selected ? "#fff" : tokens.ink }}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { borderRadius: radius.md, borderWidth: 1, minHeight: 40, justifyContent: "center", paddingHorizontal: spacing.md },
  group: { gap: spacing.sm },
  options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }
});
