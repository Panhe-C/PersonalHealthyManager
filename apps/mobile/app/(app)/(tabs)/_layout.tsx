import { Tabs } from "expo-router";
import { CalendarDays, Dumbbell, LineChart, MessageCircle, Settings as SettingsIcon } from "lucide-react-native";
import { useTheme } from "../../../src/theme/tokens";

export default function TabsLayout() {
  const { tokens } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: tokens.sage,
        tabBarStyle: { backgroundColor: tokens.panel, borderTopColor: tokens.line }
      }}
    >
      <Tabs.Screen name="today" options={{ title: "今日", tabBarIcon: ({ color }) => <CalendarDays color={color} size={22} /> }} />
      <Tabs.Screen name="plan" options={{ title: "计划", tabBarIcon: ({ color }) => <Dumbbell color={color} size={22} /> }} />
      <Tabs.Screen name="insights" options={{ title: "数据", tabBarIcon: ({ color }) => <LineChart color={color} size={22} /> }} />
      <Tabs.Screen name="coach" options={{ title: "教练", tabBarIcon: ({ color }) => <MessageCircle color={color} size={22} /> }} />
      <Tabs.Screen name="settings" options={{ title: "我的", tabBarIcon: ({ color }) => <SettingsIcon color={color} size={22} /> }} />
    </Tabs>
  );
}
