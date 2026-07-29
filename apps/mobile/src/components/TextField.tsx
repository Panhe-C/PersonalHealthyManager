import { StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import { spacing, useTheme } from "../theme/tokens";
import { Text } from "./Text";

type TextFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  secure?: boolean;
  hint?: string;
  error?: string;
  keyboardType?: "default" | "email-address" | "number-pad" | "decimal-pad";
  autoCapitalize?: "none" | "sentences";
  editable?: boolean;
};

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  secure,
  hint,
  error,
  keyboardType = "default",
  autoCapitalize = "none",
  editable = true
}: TextFieldProps) {
  const { tokens } = useTheme();
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale >= 1.4;

  return (
    <View style={styles.field}>
      <View style={[styles.row, stacked && styles.rowStacked]}>
        <Text
          size="body"
          style={[styles.label, stacked && styles.labelStacked, { color: tokens.label }]}
        >
          {label}
        </Text>
        <TextInput
          accessibilityLabel={label}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          editable={editable}
          keyboardType={keyboardType}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={tokens.labelTertiary}
          secureTextEntry={secure}
          value={value}
          style={[
            styles.input,
            stacked && styles.inputStacked,
            { color: editable ? tokens.label : tokens.labelSecondary }
          ]}
        />
      </View>
      {error ? (
        <Text size="footnote" color={tokens.red}>
          {error}
        </Text>
      ) : null}
      {!error && hint ? (
        <Text size="footnote" color={tokens.labelSecondary}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flex: 1,
    gap: spacing.xs
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 44
  },
  rowStacked: {
    alignItems: "stretch",
    flexDirection: "column",
    gap: spacing.xs
  },
  label: {
    width: 96
  },
  labelStacked: {
    width: "100%"
  },
  input: {
    flex: 1,
    fontSize: 17,
    minHeight: 44,
    paddingVertical: spacing.sm,
    textAlign: "right"
  },
  inputStacked: {
    textAlign: "left"
  }
});
