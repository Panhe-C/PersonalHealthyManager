import { useState } from "react";
import { Screen } from "../../../../src/components/Screen";
import { Button } from "../../../../src/components/Button";
import { useFeedback } from "../../../../src/components/Feedback";
import { InsetGroup } from "../../../../src/components/InsetGroup";
import { Row } from "../../../../src/components/Row";
import { TextField } from "../../../../src/components/TextField";

import { changePassword, deleteAccount } from "../../../../src/api/account";
import { useAuth } from "../../../../src/auth/AuthContext";

const MIN_PASSWORD_LENGTH = 12;

export default function AccountSecurityScreen() {
  const { signOut } = useAuth();
  const { confirm, notify } = useFeedback();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<{ newPassword?: string; confirmPassword?: string }>({});
  const [busy, setBusy] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function submit() {
    const nextErrors = {
      newPassword: newPassword.length < MIN_PASSWORD_LENGTH ? `新密码至少需要 ${MIN_PASSWORD_LENGTH} 个字符` : undefined,
      confirmPassword: newPassword !== confirmPassword ? "两次输入的新密码不一致" : undefined
    };
    setErrors(nextErrors);
    if (nextErrors.newPassword || nextErrors.confirmPassword) return;

    setBusy(true);
    try {
      await changePassword(currentPassword, newPassword);
      notify({ title: "密码已修改", description: "所有设备的会话都已失效，请用新密码重新登录。" });
      await signOut();
    } catch (error) {
      notify({ tone: "danger", title: "修改失败", description: error instanceof Error ? error.message : "请检查当前密码后重试。" });
    } finally {
      setBusy(false);
    }
  }

  async function removeAccount() {
    if (!deletePassword) return;
    const confirmed = await confirm({
      title: "永久删除账户？",
      description: "服务器中的账户、健康记录、计划和教练数据会被永久删除。已有备份和已写入第三方日历的事件不会自动删除。",
      confirmLabel: "永久删除",
      destructive: true
    });
    if (!confirmed) return;

    setDeleting(true);
    try {
      await deleteAccount(deletePassword);
      await signOut();
    } catch (error) {
      notify({ tone: "danger", title: "删除失败", description: error instanceof Error ? error.message : "请检查密码后重试。" });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Screen>
      <InsetGroup header="修改密码" footer="修改密码后，Web 和其他设备都需要重新登录。">
        <TextField label="当前密码" value={currentPassword} onChange={setCurrentPassword} secure placeholder="••••••••" />
        <TextField
          label="新密码"
          value={newPassword}
          onChange={setNewPassword}
          secure
          placeholder="••••••••"
          hint={`至少 ${MIN_PASSWORD_LENGTH} 个字符`}
          error={errors.newPassword}
        />
        <TextField
          label="确认新密码"
          value={confirmPassword}
          onChange={setConfirmPassword}
          secure
          placeholder="••••••••"
          error={errors.confirmPassword}
        />
        <Button
          title={busy ? "修改中…" : "修改密码"}
          disabled={busy || !currentPassword || !newPassword || !confirmPassword}
          onPress={submit}
        />
      </InsetGroup>

      <InsetGroup header="危险操作" footer="建议先导出数据。删除后无法恢复，备份文件和第三方日历事件需要单独处理。">
        <TextField label="输入当前密码以确认删除" value={deletePassword} onChange={setDeletePassword} secure placeholder="••••••••" />
        <Row title={deleting ? "删除中…" : "永久删除账户"} destructive disabled={deleting || !deletePassword} onPress={removeAccount} />
      </InsetGroup>
    </Screen>
  );
}
