import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../src/auth/AuthContext";
import { Button } from "../../src/components/Button";
import { Screen } from "../../src/components/Screen";
import { Text } from "../../src/components/Text";
import { spacing, useTheme } from "../../src/theme/tokens";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const { tokens } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim().toLowerCase(), password);
      router.replace("/(app)/(tabs)");
    } catch (e) {
      setError(e instanceof Error ? e.message : "登录失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={styles.heading}>
        <Text size="xxl" weight="strong">Healthy Body Manager</Text>
        <Text style={{ color: tokens.muted }}>登录以继续</Text>
      </View>
      <View style={styles.field}>
        <Text size="sm" style={{ color: tokens.muted }}>邮箱</Text>
        <TextInputMock value={email} onChange={setEmail} placeholder="demo@example.com" tokens={tokens} />
      </View>
      <View style={styles.field}>
        <Text size="sm" style={{ color: tokens.muted }}>密码</Text>
        <TextInputMock value={password} onChange={setPassword} placeholder="••••••••" secure tokens={tokens} />
      </View>
      {error && <Text style={{ color: tokens.danger }}>{error}</Text>}
      <Button title={busy ? "登录中…" : "登录"} onPress={submit} disabled={busy} />
    </Screen>
  );
}

// Minimal text input wrapper so the scaffold doesn't require extra deps;
// swap for @react-native-... TextInput in the real app — kept inline to keep
// the scaffold self-contained.
import { TextInput } from "react-native";
function TextInputMock({ value, onChange, placeholder, secure, tokens }: { value: string; onChange: (v: string) => void; placeholder: string; secure?: boolean; tokens: ReturnType<typeof useTheme>["tokens"] }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      secureTextEntry={secure}
      autoCapitalize="none"
      style={{
        borderWidth: 1,
        borderColor: tokens.line,
        borderRadius: 12,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        color: tokens.ink,
        backgroundColor: tokens.panel
      }}
    />
  );
}

const styles = StyleSheet.create({
  heading: { gap: spacing.xs, marginBottom: spacing.xxl },
  field: { gap: spacing.xs, marginBottom: spacing.lg }
});
