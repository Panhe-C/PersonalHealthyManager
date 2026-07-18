import { useEffect, useState } from "react";
import { Alert, StyleSheet, Switch, TextInput, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Screen } from "../../src/components/Screen";
import { Text } from "../../src/components/Text";
import { Button } from "../../src/components/Button";
import { Card } from "../../src/components/Card";
import { PageHeader } from "../../src/components/QuietHealth";
import { useSettingsQuery } from "../../src/api/hooks";
import { saveSettings, type MobileMcpConnection, type MobileSettings } from "../../src/api/settings";
import { radius, spacing, useTheme } from "../../src/theme/tokens";

export default function ConnectionSettingsScreen() {
  const query = useSettingsQuery();
  const queryClient = useQueryClient();
  const { tokens } = useTheme();
  const [draft, setDraft] = useState<MobileSettings | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (query.data) setDraft(query.data); }, [query.data]);

  function update(id: MobileMcpConnection["id"], changes: Partial<MobileMcpConnection>) {
    if (!draft) return;
    setDraft({ ...draft, dataMcpConnections: draft.dataMcpConnections.map((item) => item.id === id ? { ...item, ...changes } : item) });
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    try {
      const saved = await saveSettings(draft);
      setDraft(saved);
      queryClient.setQueryData(["settings"], saved);
      Alert.alert("已保存", "数据连接配置已更新。");
    } catch (error) {
      Alert.alert("保存失败", error instanceof Error ? error.message : "请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  if (!draft) return <Screen><PageHeader title="连接配置" subtitle={query.error ? "配置加载失败" : "正在读取服务器配置…"} /></Screen>;
  const inputStyle = [styles.input, { backgroundColor: tokens.panelSoft, borderColor: tokens.line, color: tokens.inkStrong }];

  return (
    <Screen>
      <PageHeader title="连接配置" subtitle="令牌只会提交到服务端加密保存；留空保持现有令牌。" />
      {draft.dataMcpConnections.map((connection) => (
        <Card key={connection.id} style={styles.card}>
          <View style={styles.heading}>
            <View><Text size="xl" weight="strong">{connection.label}</Text><Text size="sm" style={{ color: tokens.muted }}>{connection.id}</Text></View>
            <Switch value={connection.enabled} onValueChange={(enabled) => update(connection.id, { enabled })} trackColor={{ true: tokens.sage }} />
          </View>
          <Field label={`${connection.label} Endpoint`} value={connection.endpoint} onChange={(endpoint) => update(connection.id, { endpoint })} style={inputStyle} />
          <Field label={`${connection.label} Bearer Token`} value={typeof connection.auth.token === "string" ? connection.auth.token : ""} onChange={(token) => update(connection.id, { auth: { ...connection.auth, type: "bearer", token } })} style={inputStyle} secure placeholder={connection.auth.tokenHint ? `已配置 ${connection.auth.tokenHint}；留空保持不变` : "可选 Bearer Token"} />
        </Card>
      ))}
      <Button title={busy ? "保存中…" : "保存连接配置"} disabled={busy} onPress={save} />
    </Screen>
  );
}

function Field({ label, value, onChange, style, secure, placeholder }: { label: string; value: string; onChange: (value: string) => void; style: object[]; secure?: boolean; placeholder?: string }) {
  return <View style={styles.field}><Text weight="medium">{label}</Text><TextInput accessibilityLabel={label} autoCapitalize="none" autoCorrect={false} secureTextEntry={secure} placeholder={placeholder} value={value} onChangeText={onChange} style={style} /></View>;
}

const styles = StyleSheet.create({
  card: { gap: spacing.lg },
  field: { gap: spacing.sm },
  heading: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  input: { borderRadius: radius.md, borderWidth: 1, fontSize: 16, minHeight: 52, paddingHorizontal: spacing.md }
});
