import { Tabs } from "expo-router";
import { CalendarDays, ChartNoAxesColumnIncreasing, MessageCircle, Settings as SettingsIcon, Sun } from "lucide-react-native";
import { useTheme } from "../../../src/theme/tokens";

export default function TabsLayout() {
  const { tokens } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tokens.sage,
        tabBarInactiveTintColor: tokens.ink,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "500", marginTop: 2 },
        tabBarStyle: {
          backgroundColor: tokens.bg,
          borderTopColor: tokens.line,
          height: 68,
          paddingBottom: 8,
          paddingTop: 7
        }
      }}
    >
      <Tabs.Screen name="today" options={{ title: "今日", tabBarIcon: ({ color }) => <Sun color={color} size={22} strokeWidth={1.7} /> }} />
      <Tabs.Screen name="plan" options={{ title: "计划", tabBarIcon: ({ color }) => <CalendarDays color={color} size={22} strokeWidth={1.7} /> }} />
      <Tabs.Screen name="coach" options={{ title: "教练", tabBarIcon: ({ color }) => <MessageCircle color={color} size={22} /> }} />
      <Tabs.Screen name="insights" options={{ title: "数据", tabBarIcon: ({ color }) => <ChartNoAxesColumnIncreasing color={color} size={22} strokeWidth={1.7} /> }} />
      <Tabs.Screen name="settings" options={{ title: "我的", tabBarIcon: ({ color }) => <SettingsIcon color={color} size={22} /> }} />
    </Tabs>
  );
}
