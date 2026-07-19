import { useState } from "react";
import { Alert } from "react-native";
import { Screen } from "../../src/components/Screen";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { Text } from "../../src/components/Text";
import { PageHeader } from "../../src/components/QuietHealth";
import { syncHealthKit } from "../../src/healthKit";
import { spacing, useTheme } from "../../src/theme/tokens";

export default function HealthKitSettingsScreen() {
  const { tokens } = useTheme(); const [busy, setBusy] = useState(false); const [status, setStatus] = useState("尚未同步");
  async function sync() { setBusy(true); try { const result = await syncHealthKit(); const text = `睡眠 ${result.sleepImported} 条 · 恢复 ${result.recoveryImported} 条`; setStatus(text); Alert.alert("HealthKit 同步完成", text); } catch (error) { Alert.alert("无法同步", error instanceof Error ? error.message : "请稍后重试。"); } finally { setBusy(false); } }
  return <Screen><PageHeader title="Apple 健康" subtitle="只读取你明确授权的数据，最近 14 天数据会同步到个人健康空间。" />
    <Card style={{ gap: spacing.md }}><Text size="xl" weight="strong">HealthKit</Text><Text style={{ color: tokens.muted }}>{status}</Text><Text size="sm" style={{ color: tokens.muted }}>读取：身高、体重、体脂、静息心率、HRV 和睡眠。不会向 Apple 健康写入数据。</Text></Card>
    <Button title={busy ? "同步中…" : "授权并同步"} disabled={busy} onPress={sync} />
  </Screen>;
}
