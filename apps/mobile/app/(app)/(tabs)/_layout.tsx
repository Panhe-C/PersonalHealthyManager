import { Tabs } from "expo-router";
import {
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  MessageCircle,
  Settings as SettingsIcon,
  Sun
} from "lucide-react-native";
import { FloatingTabBar } from "../../../src/navigation/FloatingTabBar";

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // Detach the bar from the layout flow so screen content scrolls under
        // the floating capsule; FloatingTabBar positions itself above the home
        // indicator and Screen reserves the clearance.
        tabBarStyle: { position: "absolute" }
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: "今日",
          tabBarIcon: ({ color }) => <Sun color={color} size={24} strokeWidth={1.9} />
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: "计划",
          tabBarIcon: ({ color }) => <CalendarDays color={color} size={24} strokeWidth={1.9} />
        }}
      />
      <Tabs.Screen
        name="coach"
        options={{
          title: "教练",
          tabBarIcon: ({ color }) => <MessageCircle color={color} size={24} strokeWidth={1.9} />
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: "数据",
          tabBarIcon: ({ color }) => (
            <ChartNoAxesColumnIncreasing color={color} size={24} strokeWidth={1.9} />
          )
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "我的",
          tabBarIcon: ({ color }) => <SettingsIcon color={color} size={24} strokeWidth={1.9} />
        }}
      />
    </Tabs>
  );
}
