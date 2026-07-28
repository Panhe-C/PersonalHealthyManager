import { StyleSheet, TextInput, View } from "react-native";
import { Text } from "./Text";
import { radius, spacing, useTheme } from "../theme/tokens";

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
}: {
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
}) {
  const { tokens } = useTheme();

  return (
    <View style={styles.field}>
      <Text size="sm" style={{ color: tokens.muted }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        editable={editable}
        keyboardType={keyboardType}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={tokens.muted}
        secureTextEntry={secure}
        value={value}
        style={[
          styles.input,
          {
            backgroundColor: tokens.panel,
            borderColor: error ? tokens.danger : tokens.line,
            color: editable ? tokens.ink : tokens.muted
          }
        ]}
      />
      {error ? <Text size="sm" style={{ color: tokens.danger }}>{error}</Text> : null}
      {!error && hint ? <Text size="sm" style={{ color: tokens.muted }}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flex: 1, gap: spacing.xs },
  input: {
    borderRadius: radius.md,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: spacing.md
  }
});
