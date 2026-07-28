import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { ApiError } from "../../src/api/client";
import { useAuth } from "../../src/auth/AuthContext";
import { Button } from "../../src/components/Button";
import { PageHeader } from "../../src/components/QuietHealth";
import { Screen } from "../../src/components/Screen";
import { Text } from "../../src/components/Text";
import { TextField } from "../../src/components/TextField";
import { spacing, useTheme } from "../../src/theme/tokens";

export default function LoginScreen() {
  const { signIn, resendVerification } = useAuth();
  const { tokens } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    setNeedsVerification(false);
    setNotice(null);
    try {
      await signIn(email.trim().toLowerCase(), password);
      router.replace("/(app)/(tabs)/today");
    } catch (e) {
      if (e instanceof ApiError && e.code === "email_unverified") {
        setNeedsVerification(true);
        setError("请先完成邮箱验证再登录");
        return;
      }
      setError(e instanceof Error ? e.message : "登录失败");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    setNotice(null);
    try {
      await resendVerification(email.trim().toLowerCase());
      setNotice("验证邮件已重新发送，请查收。");
    } catch {
      setNotice("发送过于频繁，请稍后再试。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <PageHeader title="登录" subtitle="Healthy Body Manager" />

      <View style={styles.form}>
        <TextField
          label="邮箱"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
        />
        <TextField label="密码" value={password} onChange={setPassword} placeholder="••••••••" secure />
      </View>

      {error && <Text style={{ color: tokens.danger }}>{error}</Text>}
      {notice && <Text style={{ color: tokens.muted }}>{notice}</Text>}

      <View style={styles.actions}>
        {needsVerification && (
          <Button title={busy ? "发送中…" : "重新发送验证邮件"} variant="ghost" onPress={resend} disabled={busy} />
        )}
        <Button title={busy ? "登录中…" : "登录"} onPress={submit} disabled={busy} />
        <Button title="还没有账号？去注册" variant="ghost" onPress={() => router.push("/(auth)/register")} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.md },
  form: { gap: spacing.lg }
});
