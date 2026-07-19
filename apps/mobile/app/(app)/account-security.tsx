import { useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../../src/components/Screen";
import { Text } from "../../src/components/Text";
import { Button } from "../../src/components/Button";
import { PageHeader } from "../../src/components/QuietHealth";
import { changePassword, deleteAccount } from "../../src/api/account";
import { useAuth } from "../../src/auth/AuthContext";
import { radius, spacing, useTheme } from "../../src/theme/tokens";

export default function AccountSecurityScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { tokens } = useTheme();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function submit() {
    if (newPassword.length < 12) {
      Alert.alert("密码过短", "新密码至少需要 12 个字符。");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("密码不一致", "两次输入的新密码不一致。");
      return;
    }

    setBusy(true);
    try {
      await changePassword(currentPassword, newPassword);
      Alert.alert("密码已修改", "所有设备上的会话都已失效，请使用新密码重新登录。", [
        { text: "重新登录", onPress: () => void signOut() }
      ]);
    } catch (error) {
      Alert.alert("修改失败", error instanceof Error ? error.message : "请检查当前密码后重试。");
    } finally {
      setBusy(false);
    }
  }

  function confirmDeletion() {
    if (!deletePassword) return;
    Alert.alert(
      "永久删除账户？",
      "服务器中的账户、健康记录、计划和教练数据会被永久删除。已有备份和已写入第三方日历的事件不会自动删除。",
      [
        { text: "取消", style: "cancel" },
        {
          text: "永久删除",
          style: "destructive",
          onPress: () => void performDeletion(),
        },
      ],
    );
  }

  async function performDeletion() {
    setDeleting(true);
    try {
      await deleteAccount(deletePassword);
      await signOut();
    } catch (error) {
      Alert.alert("删除失败", error instanceof Error ? error.message : "请检查密码后重试。");
    } finally {
      setDeleting(false);
    }
  }

  const inputStyle = [styles.input, { borderColor: tokens.line, color: tokens.inkStrong, backgroundColor: tokens.panel }];

  return (
    <Screen>
      <PageHeader title="账户安全" subtitle="修改密码后，Web 和其他设备都需要重新登录。" />
      <View style={styles.form}>
        <PasswordField label="当前密码" value={currentPassword} onChange={setCurrentPassword} inputStyle={inputStyle} />
        <PasswordField label="新密码" value={newPassword} onChange={setNewPassword} inputStyle={inputStyle} />
        <PasswordField label="确认新密码" value={confirmPassword} onChange={setConfirmPassword} inputStyle={inputStyle} />
        <Button title={busy ? "修改中…" : "修改密码"} disabled={busy || !currentPassword || !newPassword || !confirmPassword} onPress={submit} />
        <Button title="返回设置" variant="ghost" onPress={() => router.back()} />
      </View>

      <View style={[styles.dangerZone, { backgroundColor: tokens.dangerSoft, borderColor: tokens.danger }]}>
        <Text size="xl" weight="strong" style={{ color: tokens.danger }}>永久删除账户</Text>
        <Text style={{ color: tokens.ink }}>建议先导出数据。删除后无法恢复，备份文件和第三方日历事件需要单独处理。</Text>
        <PasswordField label="输入当前密码以确认删除" value={deletePassword} onChange={setDeletePassword} inputStyle={inputStyle} />
        <Button title={deleting ? "删除中…" : "永久删除账户"} variant="danger" disabled={deleting || !deletePassword} onPress={confirmDeletion} />
      </View>
    </Screen>
  );
}

function PasswordField({ label, value, onChange, inputStyle }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputStyle: object[];
}) {
  return (
    <View style={styles.field}>
      <Text weight="medium">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        value={value}
        onChangeText={onChange}
        style={inputStyle}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.sm },
  form: { gap: spacing.lg },
  dangerZone: { borderRadius: radius.lg, borderWidth: 1, gap: spacing.md, padding: spacing.lg },
  input: { borderRadius: radius.md, borderWidth: 1, fontSize: 17, minHeight: 52, paddingHorizontal: spacing.md }
});
