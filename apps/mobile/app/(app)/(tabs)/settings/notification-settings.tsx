import { useState } from "react";
import { Screen } from "../../../../src/components/Screen";
import { Button } from "../../../../src/components/Button";
import { useFeedback } from "../../../../src/components/Feedback";
import { InsetGroup } from "../../../../src/components/InsetGroup";
import { Row } from "../../../../src/components/Row";

import { useActivePlanQuery } from "../../../../src/api/hooks";
import { enableTrainingNotifications } from "../../../../src/notifications";
import { spacing } from "../../../../src/theme/tokens";

export default function NotificationSettingsScreen() {
  const plan = useActivePlanQuery();
  const { notify } = useFeedback();
  const [busy, setBusy] = useState(false);
  const [reminders, setReminders] = useState<number | null>(null);
  const [remoteStatus, setRemoteStatus] = useState<string | null>(null);

  async function enable() {
    setBusy(true);
    try {
      const result = await enableTrainingNotifications(plan.data?.trainingTasks ?? []);
      const remote = result.remoteRegistered ? "远程推送已注册" : result.remoteReason;
      setReminders(result.localReminders);
      setRemoteStatus(remote);
      notify({ title: "提醒已更新", description: `已安排 ${result.localReminders} 条未来七天训练提醒。` });
    } catch (error) {
      notify({ tone: "danger", title: "启用失败", description: error instanceof Error ? error.message : "无法配置通知。" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen contentContainerStyle={{ paddingTop: spacing.lg }}>
      <InsetGroup header="训练提醒" footer="训练开始前 30 分钟提醒；每次更新会与当前计划重新对齐。">
        <Row title="本地提醒" subtitle="无需服务器即可工作" value={reminders === null ? "尚未启用" : `${reminders} 条`} />
        <Row title="远程推送" subtitle="配置 EAS Project ID 后可用" value={remoteStatus ?? "尚未启用"} />
      </InsetGroup>

      <Button title={busy ? "配置中…" : "启用并同步提醒"} disabled={busy || plan.isLoading} onPress={enable} />
    </Screen>
  );
}
