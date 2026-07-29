import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Screen } from "../../../../src/components/Screen";
import { Text } from "../../../../src/components/Text";
import { Button } from "../../../../src/components/Button";
import { ChoiceGroup } from "../../../../src/components/ChoiceGroup";
import { useFeedback } from "../../../../src/components/Feedback";
import { Section } from "../../../../src/components/Section";
import { TextField } from "../../../../src/components/TextField";

import { useSettingsQuery } from "../../../../src/api/hooks";
import {
  modelProviderOptions,
  providerModelDefaults,
  providerNeedsManualModel,
  saveSettings,
  type MobileSettings
} from "../../../../src/api/settings";
import { radius, spacing, useTheme } from "../../../../src/theme/tokens";

export default function ModelSettingsScreen() {
  const query = useSettingsQuery();
  const queryClient = useQueryClient();
  const { notify } = useFeedback();
  const { tokens } = useTheme();
  const [draft, setDraft] = useState<MobileSettings | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [errors, setErrors] = useState<{ modelName?: string; modelBaseUrl?: string }>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (query.data) setDraft(query.data); }, [query.data]);

  function selectProvider(value: MobileSettings["modelProvider"]) {
    if (!draft) return;
    const defaults = providerModelDefaults(value);
    setErrors({});
    setDraft({ ...draft, modelProvider: value, modelName: defaults.model, modelBaseUrl: defaults.baseUrl });
  }

  async function save() {
    if (!draft) return;
    if (providerNeedsManualModel(draft.modelProvider)) {
      const nextErrors = {
        modelName: draft.modelName.trim() ? undefined : "自定义服务商需要填写模型名",
        modelBaseUrl: draft.modelBaseUrl.trim() ? undefined : "自定义服务商需要填写 Base URL"
      };
      setErrors(nextErrors);
      if (nextErrors.modelName || nextErrors.modelBaseUrl) return;
    }

    setBusy(true);
    try {
      const saved = await saveSettings(draft, apiKey);
      setDraft(saved);
      setApiKey("");
      queryClient.setQueryData(["settings"], saved);
      notify({ title: "模型配置已保存", description: "教练会使用新的模型运行时。" });
    } catch (error) {
      notify({ tone: "danger", title: "保存失败", description: error instanceof Error ? error.message : "请稍后重试。" });
    } finally {
      setBusy(false);
    }
  }

  if (!draft) {
    return (
      <Screen>
        <Text style={{ color: tokens.muted }}>{query.error ? "配置加载失败" : "正在读取服务器配置…"}</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={{ color: tokens.muted }}>选择服务商并填入 API Key 即可；模型与地址自动匹配。密钥由服务端加密保存，留空会保留现有密钥。</Text>

      <Section title="服务商">
        <ChoiceGroup options={modelProviderOptions} value={draft.modelProvider} onChange={selectProvider} />
      </Section>

      <Section title="模型">
        {providerNeedsManualModel(draft.modelProvider) ? (
          <>
            <TextField
              label="模型名"
              value={draft.modelName}
              onChange={(modelName) => setDraft({ ...draft, modelName })}
              error={errors.modelName}
            />
            <TextField
              label="Base URL"
              value={draft.modelBaseUrl}
              onChange={(modelBaseUrl) => setDraft({ ...draft, modelBaseUrl })}
              error={errors.modelBaseUrl}
            />
          </>
        ) : (
          <View style={[styles.readOnly, { backgroundColor: tokens.panel, borderColor: tokens.line }]}>
            <Text weight="medium">{draft.modelName}</Text>
            <Text size="sm" style={{ color: tokens.muted }}>{draft.modelBaseUrl}</Text>
          </View>
        )}
      </Section>

      <Section title="凭据">
        <TextField
          label="API Key"
          value={apiKey}
          onChange={setApiKey}
          secure
          placeholder={draft.hasApiKey ? `已配置 ${draft.apiKeyHint ?? ""}；留空保持不变` : "输入 API Key"}
        />
      </Section>

      <Button title={busy ? "保存中…" : "保存模型配置"} disabled={busy} onPress={save} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  readOnly: {
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 2,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  }
});
