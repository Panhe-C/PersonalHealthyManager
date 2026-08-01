import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Screen } from "../../../../src/components/Screen";
import { Text } from "../../../../src/components/Text";
import { Button } from "../../../../src/components/Button";
import { ChoiceGroup } from "../../../../src/components/ChoiceGroup";
import { useFeedback } from "../../../../src/components/Feedback";
import { InsetGroup } from "../../../../src/components/InsetGroup";
import { Row } from "../../../../src/components/Row";
import { TextField } from "../../../../src/components/TextField";

import { useSettingsQuery } from "../../../../src/api/hooks";
import {
  modelProviderOptions,
  providerCredentialSource,
  providerModelDefaults,
  providerNeedsManualModel,
  saveSettings,
  type MobileSettings
} from "../../../../src/api/settings";
import { spacing, useTheme } from "../../../../src/theme/tokens";

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
      <Screen contentContainerStyle={{ paddingTop: spacing.lg }}>
        <Text style={{ color: tokens.labelSecondary }}>{query.error ? "配置加载失败" : "正在读取服务器配置…"}</Text>
      </Screen>
    );
  }

  return (
    <Screen contentContainerStyle={{ paddingTop: spacing.lg }}>
      <InsetGroup header="模型提供方">
        <ChoiceGroup options={modelProviderOptions} value={draft.modelProvider} onChange={selectProvider} />
      </InsetGroup>

      <InsetGroup header="模型">
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
          <Row title={draft.modelName} subtitle={draft.modelBaseUrl} />
        )}
      </InsetGroup>

      <InsetGroup
        header="凭据"
        footer={[
          providerCredentialSource(draft.modelProvider),
          "密钥由服务端加密保存，留空会保留现有密钥；模型与地址会随提供方自动匹配。"
        ]
          .filter(Boolean)
          .join("\n\n")}
      >
        <TextField
          label="API Key"
          value={apiKey}
          onChange={setApiKey}
          secure
          placeholder={draft.hasApiKey ? `已配置 ${draft.apiKeyHint ?? ""}` : "输入 API Key"}
        />
      </InsetGroup>

      <Button title={busy ? "保存中…" : "保存模型配置"} disabled={busy} onPress={save} />
    </Screen>
  );
}
