import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../src/auth/AuthContext";
import { Button } from "../../src/components/Button";
import { PageHeader } from "../../src/components/QuietHealth";
import { Screen } from "../../src/components/Screen";
import { Text } from "../../src/components/Text";
import { TextField } from "../../src/components/TextField";
import { spacing, useTheme } from "../../src/theme/tokens";

const MIN_PASSWORD_LENGTH = 12;

export default function RegisterScreen() {
  const { signUp, resendVerification } = useAuth();
  const { tokens } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const normalized = email.trim().toLowerCase();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`密码至少需要 ${MIN_PASSWORD_LENGTH} 个字符`);
      return;
    }

    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }

    setBusy(true);
    try {
      await signUp(normalized, password);
      setSentTo(normalized);
    } catch (e) {
      setError(e instanceof Error ? e.message : "注册失败");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (!sentTo) return;
    setBusy(true);
    setNotice(null);
    try {
      await resendVerification(sentTo);
      setNotice("已重新发送，请查收邮箱。");
    } catch {
      setNotice("发送过于频繁，请稍后再试。");
    } finally {
      setBusy(false);
    }
  }

  if (sentTo) {
    return (
      <Screen>
        <PageHeader
          title="请查收邮件"
          subtitle={`我们已向 ${sentTo} 发送验证链接，24 小时内有效。完成验证后即可返回登录。`}
        />
        {notice && <Text style={{ color: tokens.muted }}>{notice}</Text>}
        <View style={styles.actions}>
          <Button title={busy ? "发送中…" : "重新发送验证邮件"} variant="ghost" onPress={resend} disabled={busy} />
          <Button title="返回登录" onPress={() => router.replace("/(auth)/login")} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <PageHeader title="创建账号" subtitle="验证邮箱后即可登录" />

      <View style={styles.form}>
        <TextField
          label="邮箱"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
        />
        <TextField
          label="密码"
          value={password}
          onChange={setPassword}
          placeholder="••••••••"
          secure
          hint={`至少 ${MIN_PASSWORD_LENGTH} 个字符`}
        />
        <TextField
          label="确认密码"
          value={confirmPassword}
          onChange={setConfirmPassword}
          placeholder="••••••••"
          secure
        />
      </View>

      {error && <Text style={{ color: tokens.danger }}>{error}</Text>}

      <View style={styles.actions}>
        <Button title={busy ? "注册中…" : "注册"} onPress={submit} disabled={busy} />
        <Button title="已有账号？去登录" variant="ghost" onPress={() => router.replace("/(auth)/login")} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.md },
  form: { gap: spacing.lg }
});
