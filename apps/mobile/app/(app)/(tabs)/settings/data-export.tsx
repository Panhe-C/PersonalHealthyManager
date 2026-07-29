import { useState } from "react";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Screen } from "../../../../src/components/Screen";
import { Button } from "../../../../src/components/Button";
import { useFeedback } from "../../../../src/components/Feedback";
import { Section } from "../../../../src/components/Section";
import { Text } from "../../../../src/components/Text";

import { exportAccountData } from "../../../../src/api/export";
import { useTheme } from "../../../../src/theme/tokens";

export default function DataExportScreen() {
  const { notify } = useFeedback();
  const { tokens } = useTheme();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const data = await exportAccountData();
      const directory = FileSystem.documentDirectory;
      if (!directory) throw new Error("设备文档目录不可用。");
      const path = `${directory}healthy-body-manager-${new Date().toISOString().slice(0, 10)}.json`;
      await FileSystem.writeAsStringAsync(path, `${JSON.stringify(data, null, 2)}\n`, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: "application/json", dialogTitle: "导出 Healthy Body Manager 数据" });
      } else {
        notify({ title: "导出完成", description: path });
      }
    } catch (error) {
      notify({ tone: "danger", title: "导出失败", description: error instanceof Error ? error.message : "请稍后重试。" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Text style={{ color: tokens.muted }}>生成不含密码、会话 token 和明文密钥的 JSON 文件。</Text>

      <Section title="包含内容">
        <Text style={{ color: tokens.muted }}>
          账户资料、目标、健康记录、计划、日历草稿、教练对话与记忆、脱敏设置和自动同步状态。
        </Text>
      </Section>

      <Button title={busy ? "正在生成…" : "生成并分享数据文件"} disabled={busy} onPress={run} />
    </Screen>
  );
}
