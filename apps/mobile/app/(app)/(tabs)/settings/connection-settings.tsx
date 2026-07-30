import { useEffect, useState } from "react";
import { StyleSheet, Switch, View } from "react-native";
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
import { corosRegions, regionEndpoint, saveSettings, type CorosRegion, type MobileMcpConnection, type MobileSettings } from "../../../../src/api/settings";
import { runCorosOAuth } from "../../../../src/corosOAuthSession";
import { oauthConnectionDetail } from "../../../../src/settingsStatus";
import { spacing, useTheme } from "../../../../src/theme/tokens";

export default function ConnectionSettingsScreen() {
  const query = useSettingsQuery();
  const queryClient = useQueryClient();
  const { notify } = useFeedback();
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
      notify({ title: "连接配置已保存", description: "数据同步会使用新的 Endpoint 和凭据。" });
    } catch (error) {
      notify({ tone: "danger", title: "保存失败", description: error instanceof Error ? error.message : "请稍后重试。" });
    } finally {
      setBusy(false);
    }
  }

  /** OAuth writes the new tokens server-side, so the local draft has to be re-read. */
  async function reloadSettings() {
    await queryClient.invalidateQueries({ queryKey: ["settings"] });
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
      {draft.dataMcpConnections.map((connection) => (
        <InsetGroup
          key={connection.id}
          header={connection.label}
          footer={connection.id === "coros"
            ? "COROS 使用 OAuth，点击授权会打开浏览器登录。"
            : "令牌只会提交到服务端加密保存；留空保持现有令牌。"}
        >
          <Row
            title="启用连接"
            trailing={
            <Switch
              value={connection.enabled}
              onValueChange={(enabled) => update(connection.id, { enabled })}
              trackColor={{ true: tokens.tint, false: tokens.separator }}
            />
          }
          />
          {connection.id === "coros" ? (
            <CorosAuthSection connection={connection} onAuthorized={reloadSettings} />
          ) : (
            <>
              <TextField
                label="Endpoint"
                value={connection.endpoint}
                onChange={(endpoint) => update(connection.id, { endpoint })}
                placeholder="https://"
              />
              <CredentialField connection={connection} onChange={(auth) => update(connection.id, { auth })} />
            </>
          )}
        </InsetGroup>
      ))}

      <Button title={busy ? "保存中…" : "保存连接配置"} disabled={busy} onPress={save} />
    </Screen>
  );
}

/**
 * COROS authenticates over OAuth, so there is no secret to type here. The region
 * decides which COROS MCP host the client registers against, which is why it has
 * to be pinned before the browser leg starts.
 */
function CorosAuthSection({ connection, onAuthorized }: { connection: MobileMcpConnection; onAuthorized: () => Promise<void> }) {
  const { notify } = useFeedback();
  const { tokens } = useTheme();
  const [region, setRegion] = useState<CorosRegion>(connection.corosRegion ?? "china");
  const [busy, setBusy] = useState(false);

  const authorized = connection.auth.type === "oauth2" && Boolean(connection.auth.accessTokenHint);

  async function authorize() {
    setBusy(true);
    try {
      const outcome = await runCorosOAuth(region);
      if (outcome.status === "connected") {
        await onAuthorized();
        notify({ title: "COROS 已授权", description: "运动、睡眠和恢复数据现在可以同步了。" });
      } else if (outcome.status === "failed") {
        notify({ tone: "danger", title: "授权失败", description: outcome.message });
      }
    } catch (error) {
      notify({ tone: "danger", title: "授权失败", description: error instanceof Error ? error.message : "请稍后重试。" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.block}>
      <Text size="subheadline" style={{ color: tokens.labelSecondary }}>
        {authorized ? oauthConnectionDetail(connection) : "尚未授权。选择账号所在区域后开始授权。"}
      </Text>
      <ChoiceGroup label="区域" options={corosRegions} value={region} onChange={setRegion} disabled={busy} />
      <Text size="subheadline" style={{ color: tokens.labelSecondary }}>{regionEndpoint(region)}</Text>
      <Button title={busy ? "授权中…" : authorized ? "重新授权" : "授权"} disabled={busy} onPress={authorize} />
    </View>
  );
}

/**
 * Renders only the credential the connection actually uses. Writing a bearer
 * token into an OAuth2 connection would rewrite auth.type on the server and
 * discard the stored authorize/token URLs, client registration, and refresh
 * token, so OAuth2 stays read-only here and points at the web flow instead.
 */
function CredentialField({ connection, onChange }: { connection: MobileMcpConnection; onChange: (auth: MobileMcpConnection["auth"]) => void }) {
  const { tokens } = useTheme();
  const { auth } = connection;

  if (auth.type === "oauth2") {
    return (
      <View style={styles.block}>
        <Text size="subheadline" style={{ color: tokens.labelSecondary }}>{oauthConnectionDetail(connection)}</Text>
        <Text size="subheadline" style={{ color: tokens.labelSecondary }}>OAuth 授权需要在网页端完成，这里只显示状态。</Text>
      </View>
    );
  }

  if (auth.type === "api_key") {
    return (
      <TextField
        label="API Key"
        value={typeof auth.apiKey === "string" ? auth.apiKey : ""}
        onChange={(apiKey) => onChange({ ...auth, type: "api_key", apiKey })}
        secure
        placeholder={auth.apiKeyHint ? `已配置 ${auth.apiKeyHint}；留空保持不变` : "输入 API Key"}
      />
    );
  }

  if (auth.type === "basic") {
    return (
      <TextField
        label="密码"
        value={typeof auth.password === "string" ? auth.password : ""}
        onChange={(password) => onChange({ ...auth, type: "basic", password })}
        secure
        placeholder={auth.passwordHint ? `已配置 ${auth.passwordHint}；留空保持不变` : "输入密码"}
      />
    );
  }

  return (
    <TextField
      label="Bearer Token"
      value={typeof auth.token === "string" ? auth.token : ""}
      onChange={(token) => onChange({ ...auth, type: "bearer", token })}
      secure
      placeholder={auth.tokenHint ? `已配置 ${auth.tokenHint}；留空保持不变` : "可选 Bearer Token"}
    />
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm }
});
