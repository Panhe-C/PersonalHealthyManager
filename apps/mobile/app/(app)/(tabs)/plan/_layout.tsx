import { Stack } from "expo-router";
import { useNativeHeaderOptions } from "../../../../src/navigation/headerOptions";

export default function PlanLayout() {
  const screenOptions = useNativeHeaderOptions();

  return (
    <Stack screenOptions={screenOptions}>
      {/* Plan draws the shared warm in-page header, so the native large title
          is hidden; the 生成/调整 action lives on the in-page header's
          circular Sparkles button instead of a native headerRight. */}
      <Stack.Screen name="index" options={{ title: "计划", headerShown: false }} />
      {/* Pushed full-screen schedule: keeps the native inline header with a
          back button, like the settings detail pages. */}
      <Stack.Screen name="schedule" options={{ title: "日程", headerLargeTitleEnabled: false }} />
    </Stack>
  );
}
