import { useState } from "react";
import { Screen } from "../../src/components/Screen";
import { Button } from "../../src/components/Button";
import { useFeedback } from "../../src/components/Feedback";
import { HairlineRow } from "../../src/components/QuietHealth";
import { Section } from "../../src/components/Section";
import { Text } from "../../src/components/Text";

import { syncHealthKit } from "../../src/healthKit";
import { useTheme } from "../../src/theme/tokens";

export default function HealthKitSettingsScreen() {
  const { notify } = useFeedback();
  const { tokens } = useTheme();
  const [busy, setBusy] = useState(false);
  const [imported, setImported] = useState<{ sleep: number; recovery: number } | null>(null);

  async function sync() {
    setBusy(true);
    try {
      const result = await syncHealthKit();
      setImported({ sleep: result.sleepImported, recovery: result.recoveryImported });
      notify({ title: "HealthKit 同步完成", description: `睡眠 ${result.sleepImported} 条 · 恢复 ${result.recoveryImported} 条` });
    } catch (error) {
      notify({ tone: "danger", title: "无法同步", description: error instanceof Error ? error.message : "请稍后重试。" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Text style={{ color: tokens.muted }}>只读取你明确授权的数据，最近 14 天数据会同步到个人健康空间。</Text>

      <Section title="上次同步">
        <HairlineRow title="睡眠记录" value={imported ? `${imported.sleep} 条` : "尚未同步"} />
        <HairlineRow title="恢复记录" value={imported ? `${imported.recovery} 条` : "尚未同步"} />
      </Section>

      <Section title="读取范围">
        <Text style={{ color: tokens.muted }}>身高、体重、体脂、静息心率、HRV 和睡眠。</Text>
        <Text size="sm" style={{ color: tokens.muted }}>不会向 Apple 健康写入任何数据。</Text>
      </Section>

      <Button title={busy ? "同步中…" : "授权并同步"} disabled={busy} onPress={sync} />
    </Screen>
  );
}
