import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../src/auth/AuthContext";
import { Button } from "../../src/components/Button";
import { InsetGroup } from "../../src/components/InsetGroup";
import { Screen } from "../../src/components/Screen";
import { Text } from "../../src/components/Text";
import { TextField } from "../../src/components/TextField";
import { REGISTRATION_ENABLED } from "../../src/config/registration";
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
      router.replace("/(app)/(tabs)/today");
    } catch (e) {
      setError(e instanceof Error ? e.message : "登录失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text size="title1" weight="strong" style={styles.pageTitle}>登录</Text>
        <Text size="subheadline" color={tokens.labelSecondary}>Healthy Body Manager</Text>
      </View>

      <InsetGroup>
        <TextField
          label="邮箱"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoComplete="email"
        />
        <TextField
          label="密码"
          value={password}
          onChange={setPassword}
          placeholder="••••••••"
          secure
          autoComplete="password"
        />
      </InsetGroup>

      {error && <Text style={{ color: tokens.red, paddingHorizontal: spacing.lg }}>{error}</Text>}

      <View style={styles.actions}>
        <Button title={busy ? "登录中…" : "登录"} onPress={submit} disabled={busy} />
        <Button title="忘记密码？" variant="plain" onPress={() => router.push("/(auth)/forgot-password")} />
        {REGISTRATION_ENABLED ? (
          <Button title="还没有账号？去注册" variant="plain" onPress={() => router.push("/(auth)/register")} />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.md },
  header: { gap: spacing.xs, paddingHorizontal: spacing.lg, paddingTop: spacing.xxl },
  pageTitle: { fontSize: 30, letterSpacing: -0.5, lineHeight: 36, marginTop: 2 }
});
