import { useState } from "react";
import { Alert, StyleSheet } from "react-native";
import { Screen } from "../../src/components/Screen";
import { Text } from "../../src/components/Text";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { PageHeader } from "../../src/components/QuietHealth";
import { useActivePlanQuery } from "../../src/api/hooks";
import { enableTrainingNotifications } from "../../src/notifications";
import { spacing, useTheme } from "../../src/theme/tokens";

export default function NotificationSettingsScreen() {
  const plan = useActivePlanQuery();
  const { tokens } = useTheme();
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState("尚未启用");

  async function enable() {
    setBusy(true);
    try {
      const result = await enableTrainingNotifications(plan.data?.trainingTasks ?? []);
      const remote = result.remoteRegistered ? "远程推送已注册" : result.remoteReason;
      setSummary(`已安排 ${result.localReminders} 条本地提醒 · ${remote}`);
      Alert.alert("通知已更新", `已安排 ${result.localReminders} 条未来七天训练提醒。\n${remote}`);
    } catch (error) {
      Alert.alert("启用失败", error instanceof Error ? error.message : "无法配置通知。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <PageHeader title="通知与提醒" subtitle="训练开始前 30 分钟提醒；每次更新会与当前计划重新对齐。" />
      <Card style={styles.card}>
        <Text size="xl" weight="strong">训练提醒</Text>
        <Text style={{ color: tokens.muted }}>{summary}</Text>
        <Text size="sm" style={{ color: tokens.muted }}>本地提醒无需服务器即可工作；配置 EAS Project ID 后还会注册远程推送。</Text>
      </Card>
      <Button title={busy ? "配置中…" : "启用并同步提醒"} disabled={busy || plan.isLoading} onPress={enable} />
    </Screen>
  );
}

const styles = StyleSheet.create({ card: { gap: spacing.md } });
