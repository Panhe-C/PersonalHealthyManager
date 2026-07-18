import type { ReactNode } from "react";
import { useRouter } from "expo-router";
import { Alert, StyleSheet, View } from "react-native";
import { Bell, Brain, CalendarDays, Cloud, Download, KeyRound, Link, LogOut, Ruler, Shield, Target, Utensils, Watch } from "lucide-react-native";
import { Screen } from "../../../src/components/Screen";
import { Text } from "../../../src/components/Text";
import { EmptyState, Spinner } from "../../../src/components/States";
import { HairlineRow, PageHeader } from "../../../src/components/QuietHealth";
import { useAccountQuery, useGoalsQuery, useProfileQuery, useSettingsQuery } from "../../../src/api/hooks";
import { useAuth } from "../../../src/auth/AuthContext";
import { mcpConnectionStatus } from "../../../src/settingsStatus";
import { spacing, useTheme } from "../../../src/theme/tokens";

export default function SettingsTab() {
  const router = useRouter();
  const { signOut } = useAuth();
  const goals = useGoalsQuery();
  const profile = useProfileQuery();
  const account = useAccountQuery();
  const settings = useSettingsQuery();
  const { tokens } = useTheme();
  const iconProps = { color: tokens.ink, size: 21, strokeWidth: 1.5 } as const;
  const accountEmail = account.data?.email ?? "正在读取账户…";
  const initials = account.data?.email.slice(0, 2).toUpperCase() ?? "HB";
  const connection = (id: "coros" | "calendar" | "meal_menu") =>
    settings.data?.dataMcpConnections.find((item) => item.id === id);

  return (
    <Screen>
      <PageHeader title="设置" />

      <View style={[styles.identityRow, { borderBottomColor: tokens.line }]}>
        <View style={[styles.avatar, { backgroundColor: tokens.sage }]}><Text size="xl" weight="medium" style={{ color: "#fff" }}>{initials}</Text></View>
        <View style={styles.identityCopy}>
          <Text size="xl" weight="strong" style={{ color: tokens.inkStrong }}>个人健康空间</Text>
          <Text style={{ color: account.error ? tokens.danger : tokens.muted }}>{account.error ? "账户信息加载失败" : accountEmail}</Text>
        </View>
      </View>

      <View style={styles.settingsList}>
        <SettingsGroup title="账户">
          <HairlineRow icon={<Shield {...iconProps} />} title="账户安全" subtitle="修改密码会退出所有设备" onPress={() => router.push("../account-security")} />
        </SettingsGroup>

        <SettingsGroup title="数据与连接">
          <HairlineRow icon={<KeyRound {...iconProps} />} title="模型运行时" value={settings.data?.hasApiKey ? settings.data.modelProvider : "未配置密钥"} onPress={() => router.push("../model-settings")} />
          <HairlineRow icon={<Link {...iconProps} />} title="连接配置" subtitle="维护 Endpoint、开关和访问令牌" onPress={() => router.push("../connection-settings")} />
          <HairlineRow icon={<Watch {...iconProps} />} title="COROS" value={mcpConnectionStatus(connection("coros"))} onPress={() => Alert.alert("COROS", "连接状态来自服务器设置。")}/>
          <HairlineRow icon={<CalendarDays {...iconProps} />} title="日历" value={mcpConnectionStatus(connection("calendar"))} onPress={() => Alert.alert("日历", "连接状态来自服务器设置。")}/>
          <HairlineRow icon={<Utensils {...iconProps} />} title="餐食菜单" value={mcpConnectionStatus(connection("meal_menu"))} onPress={() => Alert.alert("餐食菜单", "连接状态来自服务器设置。")}/>
        </SettingsGroup>

        <SettingsGroup title="偏好">
          <HairlineRow icon={<Cloud {...iconProps} />} title="外观" value="跟随系统" onPress={() => Alert.alert("外观", "当前跟随系统浅色或深色模式。")}/>
          <HairlineRow icon={<Ruler {...iconProps} />} title="单位" value="公制" onPress={() => Alert.alert("单位", "距离使用公里，体重使用公斤。")}/>
          <HairlineRow icon={<Bell {...iconProps} />} title="通知" value="未配置" onPress={() => Alert.alert("通知", "推送通知尚未配置，不会显示虚假的开启状态。")}/>
        </SettingsGroup>

        <SettingsGroup title="目标">
          {goals.isLoading ? <Spinner /> : goals.error ? <EmptyState title="目标加载失败" description="请确认后端服务。" /> : goals.data?.length ? goals.data.slice(0, 4).map((goal) => (
            <HairlineRow
              key={goal.id}
              icon={<Target {...iconProps} />}
              title={goal.title}
              subtitle={`${goal.status} · 优先级 ${goal.priority}`}
              onPress={() => Alert.alert(goal.title, `${goal.status} · 优先级 ${goal.priority}`)}
            />
          )) : <HairlineRow icon={<Target {...iconProps} />} title="暂无目标" subtitle="目标会影响计划和教练建议" />}
        </SettingsGroup>

        <SettingsGroup title="隐私">
          <HairlineRow icon={<Brain {...iconProps} />} title="Agent 记忆" value={profile.data ? "可用" : "同步中"} onPress={() => Alert.alert("Agent 记忆", "可在教练页面管理已保存的偏好和约束。")}/>
          <HairlineRow icon={<Download {...iconProps} />} title="导出数据" onPress={() => Alert.alert("导出数据", "数据导出功能将在后续版本开放。")}/>
        </SettingsGroup>

        <HairlineRow
          icon={<LogOut color={tokens.danger} size={21} strokeWidth={1.5} />}
          title="退出登录"
          danger
          onPress={() => Alert.alert("退出当前账号", "会清空本机保存的 access / refresh token。", [
            { text: "取消", style: "cancel" },
            { text: "退出", style: "destructive", onPress: signOut }
          ])}
        />
      </View>
    </Screen>
  );
}

function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  const { tokens } = useTheme();
  return (
    <View style={styles.group}>
      <Text size="xs" weight="strong" style={{ color: tokens.sage, letterSpacing: 0.8 }}>{title.toUpperCase()}</Text>
      <View>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: "center", borderRadius: 36, height: 72, justifyContent: "center", width: 72 },
  group: { gap: spacing.sm },
  identityCopy: { flex: 1, gap: spacing.xs },
  identityRow: { alignItems: "center", borderBottomWidth: 1, flexDirection: "row", gap: spacing.lg, paddingBottom: spacing.xl },
  settingsList: { gap: spacing.xl }
});
