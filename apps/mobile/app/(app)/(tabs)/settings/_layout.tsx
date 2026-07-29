import { Stack } from "expo-router";
import { useNativeHeaderOptions } from "../../../../src/navigation/headerOptions";

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

export default function SettingsLayout() {
  const screenOptions = useNativeHeaderOptions();

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ title: "我的" }} />
      {detailScreens.map((screen) => (
        <Stack.Screen
          key={screen.name}
          name={screen.name}
          options={{ title: screen.title, headerLargeTitleEnabled: false }}
        />
      ))}
    </Stack>
  );
}
