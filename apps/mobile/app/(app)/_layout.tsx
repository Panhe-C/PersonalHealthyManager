import { Redirect, Stack } from "expo-router";
import { useAuth } from "../../src/auth/AuthContext";
import { useTheme } from "../../src/theme/tokens";

const detailScreens = [
  { name: "profile-settings", title: "个人资料" },
  { name: "account-security", title: "账户安全" },
  { name: "healthkit-settings", title: "Apple 健康" },
  { name: "model-settings", title: "模型运行时" },
  { name: "connection-settings", title: "连接配置" },
  { name: "notification-settings", title: "通知与提醒" },
  { name: "goal-settings", title: "管理目标" },
  { name: "data-export", title: "导出数据" }
];

export default function AppLayout() {
  const { status } = useAuth();
  const { tokens } = useTheme();
  if (status !== "authed") return <Redirect href="/(auth)/login" />;
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: tokens.bg },
        headerStyle: { backgroundColor: tokens.bg },
        headerShadowVisible: false,
        headerTintColor: tokens.sage,
        headerTitleStyle: { color: tokens.inkStrong, fontSize: 17, fontWeight: "600" }
      }}
    >
      <Stack.Screen name="(tabs)" />
      {detailScreens.map((screen) => (
        <Stack.Screen key={screen.name} name={screen.name} options={{ headerShown: true, title: screen.title }} />
      ))}
    </Stack>
  );
}
