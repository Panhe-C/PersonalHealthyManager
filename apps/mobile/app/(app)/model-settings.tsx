import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Screen } from "../../src/components/Screen";
import { Text } from "../../src/components/Text";
import { Button } from "../../src/components/Button";
import { PageHeader } from "../../src/components/QuietHealth";
import { useSettingsQuery } from "../../src/api/hooks";
import { saveSettings, type MobileSettings } from "../../src/api/settings";
import { radius, spacing, useTheme } from "../../src/theme/tokens";

const providers: Array<{ value: MobileSettings["modelProvider"]; label: string }> = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "minimax", label: "MiniMax" },
  { value: "kimi", label: "Kimi" },
  { value: "glm", label: "GLM" },
  { value: "custom", label: "自定义" }
];

export default function ModelSettingsScreen() {
  const query = useSettingsQuery();
  const queryClient = useQueryClient();
  const { tokens } = useTheme();
  const [draft, setDraft] = useState<MobileSettings | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (query.data) setDraft(query.data); }, [query.data]);

  async function save() {
    if (!draft?.modelName.trim()) return Alert.alert("缺少模型名", "请输入模型名称。");
    setBusy(true);
    try {
      const saved = await saveSettings(draft, apiKey);
      setDraft(saved);
      setApiKey("");
      queryClient.setQueryData(["settings"], saved);
      Alert.alert("已保存", "模型运行时配置已更新。");
    } catch (error) {
      Alert.alert("保存失败", error instanceof Error ? error.message : "请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  if (!draft) return <Screen><PageHeader title="模型运行时" subtitle={query.error ? "配置加载失败" : "正在读取服务器配置…"} /></Screen>;
  const inputStyle = [styles.input, { backgroundColor: tokens.panel, borderColor: tokens.line, color: tokens.inkStrong }];

  return (
    <Screen>
      <PageHeader title="模型运行时" subtitle="密钥由服务端加密保存；留空会保留现有密钥。" />
      <View style={styles.providers}>
        {providers.map((provider) => (
          <Pressable key={provider.value} accessibilityRole="button" onPress={() => setDraft({ ...draft, modelProvider: provider.value })}
            style={[styles.provider, { borderColor: draft.modelProvider === provider.value ? tokens.sage : tokens.line, backgroundColor: draft.modelProvider === provider.value ? tokens.sageSoft : tokens.panel }]}>
            <Text weight="medium">{provider.label}</Text>
          </Pressable>
        ))}
      </View>
      <Field label="模型名" value={draft.modelName} onChange={(modelName) => setDraft({ ...draft, modelName })} style={inputStyle} />
      <Field label="Base URL" value={draft.modelBaseUrl} onChange={(modelBaseUrl) => setDraft({ ...draft, modelBaseUrl })} style={inputStyle} autoCapitalize="none" />
      <Field label="API Key" value={apiKey} onChange={setApiKey} style={inputStyle} secure placeholder={draft.hasApiKey ? `已配置 ${draft.apiKeyHint ?? ""}；留空保持不变` : "输入 API Key"} />
      <Button title={busy ? "保存中…" : "保存模型配置"} disabled={busy} onPress={save} />
    </Screen>
  );
}

function Field({ label, value, onChange, style, secure, placeholder, autoCapitalize = "sentences" }: {
  label: string; value: string; onChange: (value: string) => void; style: object[]; secure?: boolean; placeholder?: string; autoCapitalize?: "none" | "sentences";
}) {
  return <View style={styles.field}><Text weight="medium">{label}</Text><TextInput accessibilityLabel={label} autoCapitalize={autoCapitalize} autoCorrect={false} secureTextEntry={secure} placeholder={placeholder} value={value} onChangeText={onChange} style={style} /></View>;
}

const styles = StyleSheet.create({
  field: { gap: spacing.sm },
  input: { borderRadius: radius.md, borderWidth: 1, fontSize: 16, minHeight: 52, paddingHorizontal: spacing.md },
  provider: { borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  providers: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }
});
