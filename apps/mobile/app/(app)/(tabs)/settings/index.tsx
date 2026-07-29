import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Bell, Brain, CalendarDays, ChevronDown, ChevronUp, Cloud, Download, HeartPulse, KeyRound, Link, LogOut, Ruler, Shield, Target, UserRound, Utensils, Watch } from "lucide-react-native";
import { Screen } from "../../../../src/components/Screen";
import { Text } from "../../../../src/components/Text";
import { useFeedback } from "../../../../src/components/Feedback";
import { Section } from "../../../../src/components/Section";
import { EmptyState, Spinner } from "../../../../src/components/States";
import { HairlineRow } from "../../../../src/components/QuietHealth";
import { useAccountQuery, useAutomationStatesQuery, useGoalsQuery, useProfileQuery, useSettingsQuery } from "../../../../src/api/hooks";
import { useAuth } from "../../../../src/auth/AuthContext";
import { mcpConnectionStatus } from "../../../../src/settingsStatus";
import { spacing, useTheme } from "../../../../src/theme/tokens";

export default function SettingsTab() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { confirm } = useFeedback();
  const goals = useGoalsQuery();
  const profile = useProfileQuery();
  const account = useAccountQuery();
  const settings = useSettingsQuery();
  const automations = useAutomationStatesQuery();
  const { tokens } = useTheme();
  const [showAutomations, setShowAutomations] = useState(false);
  const iconProps = { color: tokens.ink, size: 21, strokeWidth: 1.5 } as const;
  const accountEmail = account.data?.email ?? "正在读取账户…";
  const initials = account.data?.email.slice(0, 2).toUpperCase() ?? "HB";
  const connection = (id: "coros" | "calendar" | "meal_menu") =>
    settings.data?.dataMcpConnections.find((item) => item.id === id);
  const automationSummary = automations.data?.some((item) => item.status === "failed")
    ? "需检查"
    : automations.data?.length
      ? "运行中"
      : "未运行";

  async function requestSignOut() {
    const confirmed = await confirm({
      title: "退出当前账号？",
      description: "会清空本机保存的 access 和 refresh token，下次需要重新登录。",
      confirmLabel: "退出",
      destructive: true
    });
    if (confirmed) await signOut();
  }

  return (
    <Screen>
      <View style={[styles.identityRow, { borderBottomColor: tokens.line }]}>
        <View style={[styles.avatar, { backgroundColor: tokens.sage }]}><Text size="xl" weight="medium" style={{ color: "#fff" }}>{initials}</Text></View>
        <View style={styles.identityCopy}>
          <Text size="xl" weight="strong" style={{ color: tokens.inkStrong }}>个人健康空间</Text>
          <Text style={{ color: account.error ? tokens.danger : tokens.muted }}>{account.error ? "账户信息加载失败" : accountEmail}</Text>
        </View>
      </View>

      <View style={styles.settingsList}>
        <Section title="账户">
          <View>
            <HairlineRow icon={<UserRound {...iconProps} />} title="个人资料" subtitle="身体数据、限制和偏好" onPress={() => router.push("/(app)/(tabs)/settings/profile-settings")} />
            <HairlineRow icon={<Shield {...iconProps} />} title="账户安全" subtitle="修改密码会退出所有设备" onPress={() => router.push("/(app)/(tabs)/settings/account-security")} />
          </View>
        </Section>

        <Section title="数据与连接">
          <View>
            <HairlineRow icon={<HeartPulse {...iconProps} />} title="Apple 健康" subtitle="授权并同步 HealthKit" onPress={() => router.push("/(app)/(tabs)/settings/healthkit-settings")} />
            <HairlineRow
              icon={<Cloud {...iconProps} />}
              title="自动同步"
              subtitle={automations.data?.length ? `${automations.data.length} 个后台任务` : "后台任务尚未运行"}
              value={automationSummary}
              trailing={showAutomations
                ? <ChevronUp color={tokens.muted} size={18} strokeWidth={1.6} />
                : <ChevronDown color={tokens.muted} size={18} strokeWidth={1.6} />}
              onPress={() => setShowAutomations((value) => !value)}
            />
            {showAutomations ? (
              <View style={styles.nested}>
                {automations.data?.length ? automations.data.map((item) => (
                  <HairlineRow
                    key={item.kind}
                    title={item.kind}
                    subtitle={item.lastError ?? undefined}
                    value={item.status}
                    danger={item.status === "failed"}
                  />
                )) : <Text size="sm" style={{ color: tokens.muted }}>还没有自动任务运行记录。</Text>}
              </View>
            ) : null}
            <HairlineRow icon={<KeyRound {...iconProps} />} title="模型运行时" value={settings.data?.hasApiKey ? settings.data.modelProvider : "未配置密钥"} onPress={() => router.push("/(app)/(tabs)/settings/model-settings")} />
            <HairlineRow icon={<Link {...iconProps} />} title="连接配置" subtitle="维护 Endpoint、开关和访问令牌" onPress={() => router.push("/(app)/(tabs)/settings/connection-settings")} />
            <HairlineRow icon={<Watch {...iconProps} />} title="COROS" subtitle="浏览器登录授权" value={mcpConnectionStatus(connection("coros"))} onPress={() => router.push("/(app)/(tabs)/settings/connection-settings")} />
            <HairlineRow icon={<CalendarDays {...iconProps} />} title="日历" value={mcpConnectionStatus(connection("calendar"))} onPress={() => router.push("/(app)/(tabs)/settings/connection-settings")} />
            <HairlineRow icon={<Utensils {...iconProps} />} title="餐食菜单" value={mcpConnectionStatus(connection("meal_menu"))} onPress={() => router.push("/(app)/(tabs)/settings/connection-settings")} />
          </View>
        </Section>

        <Section title="偏好">
          <View>
            <HairlineRow icon={<Cloud {...iconProps} />} title="外观" subtitle="跟随系统的浅色与深色模式" value="跟随系统" />
            <HairlineRow icon={<Ruler {...iconProps} />} title="单位" subtitle="距离用公里，体重用公斤" value="公制" />
            <HairlineRow icon={<Bell {...iconProps} />} title="通知与提醒" subtitle="训练开始前 30 分钟提醒" onPress={() => router.push("/(app)/(tabs)/settings/notification-settings")} />
          </View>
        </Section>

        <Section title="目标">
          <View>
            <HairlineRow icon={<Target {...iconProps} />} title="管理目标" subtitle="新建、编辑或暂停目标" onPress={() => router.push("/(app)/(tabs)/settings/goal-settings")} />
            {goals.isLoading ? <Spinner /> : goals.error ? <EmptyState title="目标加载失败" description="请确认后端服务。" /> : goals.data?.length ? goals.data.slice(0, 4).map((goal) => (
              <HairlineRow
                key={goal.id}
                icon={<Target {...iconProps} />}
                title={goal.title}
                subtitle={`${goal.status} · 优先级 ${goal.priority}`}
                onPress={() => router.push("/(app)/(tabs)/settings/goal-settings")}
              />
            )) : <HairlineRow icon={<Target {...iconProps} />} title="暂无目标" subtitle="目标会影响计划和教练建议" />}
          </View>
        </Section>

        <Section title="隐私">
          <View>
            <HairlineRow icon={<Brain {...iconProps} />} title="Agent 记忆" subtitle="在教练页的记忆面板中管理" value={profile.data ? "可用" : "同步中"} />
            <HairlineRow icon={<Download {...iconProps} />} title="导出数据" subtitle="生成脱敏 JSON 文件" onPress={() => router.push("/(app)/(tabs)/settings/data-export")} />
          </View>
        </Section>

        <HairlineRow
          icon={<LogOut color={tokens.danger} size={21} strokeWidth={1.5} />}
          title="退出登录"
          danger
          onPress={requestSignOut}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: "center", borderRadius: 36, height: 72, justifyContent: "center", width: 72 },
  identityCopy: { flex: 1, gap: spacing.xs },
  identityRow: { alignItems: "center", borderBottomWidth: 1, flexDirection: "row", gap: spacing.lg, paddingBottom: spacing.xl },
  nested: { paddingLeft: spacing.xl },
  settingsList: { gap: spacing.xl }
});
