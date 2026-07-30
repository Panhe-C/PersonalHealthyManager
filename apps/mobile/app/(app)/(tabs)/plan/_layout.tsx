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
      {/* The schedule opens as a modal sheet over the plan page (expand to
          full screen, swipe down to dismiss) instead of a side push, so the
          plan page visibly stays where it was. */}
      <Stack.Screen
        name="schedule"
        options={{ title: "日程", headerLargeTitleEnabled: false, presentation: "modal" }}
      />
    </Stack>
  );
}
