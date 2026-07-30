import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell, Brain, CalendarDays, ChevronDown, ChevronRight, ChevronUp, Cloud, Download, HeartPulse, KeyRound, Link, Ruler, Shield, Target, UserRound, Utensils, Watch } from "lucide-react-native";
import { Screen } from "../../../../src/components/Screen";
import { Text } from "../../../../src/components/Text";
import { useFeedback } from "../../../../src/components/Feedback";
import { InsetGroup } from "../../../../src/components/InsetGroup";
import { Row } from "../../../../src/components/Row";
import { WarmHeader } from "../../../../src/components/WarmHeader";
import { useAccountQuery, useAutomationStatesQuery, useGoalsQuery, useProfileQuery, useSettingsQuery } from "../../../../src/api/hooks";
import { useAuth } from "../../../../src/auth/AuthContext";
import { mcpConnectionStatus } from "../../../../src/settingsStatus";
import { cardShadow, radius, spacing, useTheme } from "../../../../src/theme/tokens";

export default function SettingsTab() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { confirm } = useFeedback();
  const goals = useGoalsQuery();
  const profile = useProfileQuery();
  const account = useAccountQuery();
  const settings = useSettingsQuery();
  const automations = useAutomationStatesQuery();
  const { tokens, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const shadow = cardShadow(isDark ? "dark" : "light");
  const [showAutomations, setShowAutomations] = useState(false);
  const iconProps = { color: tokens.tint, size: 20, strokeWidth: 1.8 } as const;
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
    <Screen contentContainerStyle={{ paddingTop: insets.top + spacing.lg }}>
      {/* In-page header: the native header is hidden for this tab, so the
          safe-area top inset is applied manually via contentContainerStyle. */}
      <WarmHeader overline="账户与偏好" title="我的" />

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/(app)/(tabs)/settings/profile-settings")}
        style={[styles.profileCard, { backgroundColor: tokens.surface }, shadow]}
      >
        <View style={[styles.profileAvatar, { backgroundColor: tokens.controlFill }]}>
          <Text size="headline" color={tokens.controlLabel}>
            {initials}
          </Text>
        </View>
        <View style={styles.profileCopy}>
          <Text size="headline">个人健康空间</Text>
          <Text size="footnote" color={tokens.labelSecondary}>
            {account.error ? "账户信息加载失败" : accountEmail}
          </Text>
        </View>
        <ChevronRight color={tokens.labelTertiary} size={18} strokeWidth={2.2} />
      </Pressable>

      <InsetGroup header="账户" insetSeparators>
        <Row icon={<UserRound {...iconProps} />} title="个人资料" subtitle="身体数据、限制和偏好" onPress={() => router.push("/(app)/(tabs)/settings/profile-settings")} />
        <Row icon={<Shield {...iconProps} />} title="账户安全" subtitle="修改密码会退出所有设备" onPress={() => router.push("/(app)/(tabs)/settings/account-security")} />
      </InsetGroup>

      <InsetGroup header="数据与连接" insetSeparators>
        <Row icon={<HeartPulse {...iconProps} />} title="Apple 健康" subtitle="授权并同步 HealthKit" onPress={() => router.push("/(app)/(tabs)/settings/healthkit-settings")} />
        <Row
          icon={<Cloud {...iconProps} />}
          title="自动同步"
          subtitle={automations.data?.length ? `${automations.data.length} 个后台任务` : "后台任务尚未运行"}
          value={automationSummary}
          trailing={showAutomations
            ? <ChevronUp color={tokens.labelTertiary} size={18} strokeWidth={2.2} />
            : <ChevronDown color={tokens.labelTertiary} size={18} strokeWidth={2.2} />}
          onPress={() => setShowAutomations((value) => !value)}
        />
        {showAutomations
          ? automations.data?.length
            ? automations.data.map((item) => (
              <Row key={item.kind} title={item.kind} subtitle={item.lastError ?? undefined} value={item.status} destructive={item.status === "failed"} />
            ))
            : [<Row key="no-automations" title="还没有自动任务运行记录" />]
          : []}
        <Row icon={<KeyRound {...iconProps} />} title="模型运行时" value={settings.data?.hasApiKey ? settings.data.modelProvider : "未配置密钥"} onPress={() => router.push("/(app)/(tabs)/settings/model-settings")} />
        <Row icon={<Link {...iconProps} />} title="连接配置" subtitle="维护 Endpoint、开关和访问令牌" onPress={() => router.push("/(app)/(tabs)/settings/connection-settings")} />
        <Row icon={<Watch {...iconProps} />} title="COROS" subtitle="浏览器登录授权" value={mcpConnectionStatus(connection("coros"))} onPress={() => router.push("/(app)/(tabs)/settings/connection-settings")} />
        <Row icon={<CalendarDays {...iconProps} />} title="日历" value={mcpConnectionStatus(connection("calendar"))} onPress={() => router.push("/(app)/(tabs)/settings/connection-settings")} />
        <Row icon={<Utensils {...iconProps} />} title="餐食菜单" value={mcpConnectionStatus(connection("meal_menu"))} onPress={() => router.push("/(app)/(tabs)/settings/connection-settings")} />
      </InsetGroup>

      <InsetGroup header="偏好" insetSeparators>
        <Row icon={<Cloud {...iconProps} />} title="外观" subtitle="跟随系统的浅色与深色模式" value="跟随系统" />
        <Row icon={<Ruler {...iconProps} />} title="单位" subtitle="距离用公里，体重用公斤" value="公制" />
        <Row icon={<Bell {...iconProps} />} title="通知与提醒" subtitle="训练开始前 30 分钟提醒" onPress={() => router.push("/(app)/(tabs)/settings/notification-settings")} />
      </InsetGroup>

      <InsetGroup header="目标" insetSeparators>
        <Row icon={<Target {...iconProps} />} title="管理目标" subtitle="新建、编辑或暂停目标" onPress={() => router.push("/(app)/(tabs)/settings/goal-settings")} />
        {goals.isLoading
          ? [<Row key="goals-loading" title="正在读取目标…" />]
          : goals.error
            ? [<Row key="goals-error" title="目标加载失败" subtitle="请确认后端服务" destructive />]
            : goals.data?.length
              ? goals.data.slice(0, 4).map((goal) => (
                <Row key={goal.id} icon={<Target {...iconProps} />} title={goal.title} subtitle={`${goal.status} · 优先级 ${goal.priority}`} onPress={() => router.push("/(app)/(tabs)/settings/goal-settings")} />
              ))
              : [<Row key="goals-empty" icon={<Target {...iconProps} />} title="暂无目标" subtitle="目标会影响计划和教练建议" />]}
      </InsetGroup>

      <InsetGroup header="隐私" insetSeparators>
        <Row icon={<Brain {...iconProps} />} title="Agent 记忆" subtitle="在教练页的记忆面板中管理" value={profile.data ? "可用" : "同步中"} />
        <Row icon={<Download {...iconProps} />} title="导出数据" subtitle="生成脱敏 JSON 文件" onPress={() => router.push("/(app)/(tabs)/settings/data-export")} />
      </InsetGroup>

      <InsetGroup>
        <Row title="退出登录" destructive onPress={requestSignOut} />
      </InsetGroup>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profileAvatar: {
    alignItems: "center",
    borderRadius: radius.pill,
    height: 48,
    justifyContent: "center",
    width: 48
  },
  profileCard: {
    alignItems: "center",
    borderRadius: radius.card,
    flexDirection: "row",
    gap: spacing.md,
    marginHorizontal: 20,
    padding: 18
  },
  profileCopy: { flex: 1, gap: 2 }
});
