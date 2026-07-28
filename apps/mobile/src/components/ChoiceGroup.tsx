import { Pressable, StyleSheet, View } from "react-native";
import { radius, spacing, useTheme } from "../theme/tokens";
import { Text } from "./Text";

type ChoiceGroupProps<Value extends string> = {
  label?: string;
  value: Value;
  options: readonly { label: string; value: Value }[];
  onChange: (value: Value) => void;
  disabled?: boolean;
};

export function ChoiceGroup<Value extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false
}: ChoiceGroupProps<Value>) {
  const { tokens } = useTheme();

  return (
    <View style={styles.group}>
      {label ? (
        <Text size="footnote" style={{ color: tokens.labelSecondary }}>
          {label}
        </Text>
      ) : null}
      <View style={[styles.track, { backgroundColor: tokens.fill }]}>
        {options.map((option) => {
          const selected = option.value === value;

          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ disabled, selected }}
              disabled={disabled}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.segment,
                selected && { backgroundColor: tokens.surface },
                { opacity: disabled ? 0.45 : pressed ? 0.65 : 1 }
              ]}
            >
              <Text
                size="subheadline"
                style={{
                  color: tokens.label,
                  fontWeight: selected ? "600" : "400"
                }}
              >
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
  group: {
    gap: spacing.xs
  },
  track: {
    borderRadius: radius.md,
    flexDirection: "row",
    gap: 2,
    padding: 2
  },
  segment: {
    alignItems: "center",
    borderRadius: radius.sm,
    flex: 1,
    justifyContent: "center",
    minHeight: 32,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  }
});
