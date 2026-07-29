import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { useEffect, useState } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import {
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  MessageCircle,
  Settings as SettingsIcon,
  Sun
} from "lucide-react-native";
import { useTheme } from "../../../src/theme/tokens";

export default function TabsLayout() {
  const { tokens, isDark } = useTheme();
  const [reduceTransparency, setReduceTransparency] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceTransparencyEnabled().then(setReduceTransparency);
    const subscription = AccessibilityInfo.addEventListener(
      "reduceTransparencyChanged",
      setReduceTransparency
    );
    return () => subscription.remove();
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tokens.tint,
        tabBarInactiveTintColor: tokens.labelSecondary,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "500" },
        tabBarStyle: {
          backgroundColor: "transparent",
          borderTopColor: tokens.separator,
          borderTopWidth: StyleSheet.hairlineWidth,
          position: "absolute"
        },
        tabBarBackground: () =>
          reduceTransparency ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: tokens.surface }]} />
          ) : (
            <BlurView
              intensity={100}
              tint={isDark ? "systemChromeMaterialDark" : "systemChromeMaterialLight"}
              style={StyleSheet.absoluteFill}
            />
          )
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
