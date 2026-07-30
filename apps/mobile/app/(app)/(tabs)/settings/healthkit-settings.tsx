import { useState } from "react";
import { Screen } from "../../../../src/components/Screen";
import { Button } from "../../../../src/components/Button";
import { useFeedback } from "../../../../src/components/Feedback";
import { InsetGroup } from "../../../../src/components/InsetGroup";
import { Row } from "../../../../src/components/Row";

import { syncHealthKit } from "../../../../src/healthKit";
import { spacing } from "../../../../src/theme/tokens";

export default function HealthKitSettingsScreen() {
  const { notify } = useFeedback();
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
    <Screen contentContainerStyle={{ paddingTop: spacing.lg }}>
      <InsetGroup header="上次同步" footer="只读取你明确授权的数据，最近 14 天数据会同步到个人健康空间。">
        <Row title="睡眠记录" value={imported ? `${imported.sleep} 条` : "尚未同步"} />
        <Row title="恢复记录" value={imported ? `${imported.recovery} 条` : "尚未同步"} />
      </InsetGroup>

      <InsetGroup header="读取范围" footer="不会向 Apple 健康写入任何数据。">
        <Row title="身体数据" value="身高 体重 体脂" />
        <Row title="心脏与睡眠" value="静息心率 HRV 睡眠" />
      </InsetGroup>

      <Button title={busy ? "同步中…" : "授权并同步"} disabled={busy} onPress={sync} />
    </Screen>
  );
}
