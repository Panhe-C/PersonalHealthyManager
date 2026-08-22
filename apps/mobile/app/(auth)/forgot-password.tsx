import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { ApiError } from "../../src/api/client";
import { useAuth } from "../../src/auth/AuthContext";
import { Button } from "../../src/components/Button";
import { InsetGroup } from "../../src/components/InsetGroup";
import { Screen } from "../../src/components/Screen";
import { Text } from "../../src/components/Text";
import { TextField } from "../../src/components/TextField";
import { spacing, useTheme } from "../../src/theme/tokens";

export default function ForgotPasswordScreen() {
  const { requestPasswordReset } = useAuth();
  const { tokens } = useTheme();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(email.trim().toLowerCase());
      setSent(true);
    } catch (e) {
      setError(
        e instanceof ApiError && e.code === "rate_limited"
          ? "请求过于频繁，请稍后再试。"
          : "发送失败，请稍后再试。"
      );
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <Screen>
        <View style={styles.header}>
          <Text size="title1" weight="strong" style={styles.pageTitle}>请查收邮件</Text>
          {/* Says nothing about whether this address has an account. */}
          <Text size="subheadline" color={tokens.labelSecondary}>
            如果该邮箱已验证过账号，重置链接已发出，1 小时内有效。在浏览器中打开链接即可设置新密码。
          </Text>
        </View>
        <View style={styles.actions}>
          <Button title="返回登录" onPress={() => router.replace("/(auth)/login")} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text size="title1" weight="strong" style={styles.pageTitle}>忘记密码</Text>
        <Text size="subheadline" color={tokens.labelSecondary}>我们会发送一封重置密码的邮件</Text>
      </View>

      <InsetGroup>
        <TextField
          label="邮箱"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
        />
      </InsetGroup>

      {error && <Text style={{ color: tokens.red, paddingHorizontal: spacing.lg }}>{error}</Text>}

      <View style={styles.actions}>
        <Button title={busy ? "发送中…" : "发送重置邮件"} onPress={submit} disabled={busy || !email.trim()} />
        <Button title="返回登录" variant="plain" onPress={() => router.replace("/(auth)/login")} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.md },
  header: { gap: spacing.xs, paddingHorizontal: spacing.lg, paddingTop: spacing.xxl },
  pageTitle: { fontSize: 30, letterSpacing: -0.5, lineHeight: 36, marginTop: 2 }
});
