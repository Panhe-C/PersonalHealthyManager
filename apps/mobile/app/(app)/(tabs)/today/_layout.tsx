import { Stack } from "expo-router";
import { useNativeHeaderOptions } from "../../../../src/navigation/headerOptions";

export default function TodayLayout() {
  const screenOptions = useNativeHeaderOptions();

  return (
    <Stack screenOptions={screenOptions}>
      {/* Today draws the shared warm in-page header (WarmHeader), so the
          native large title is hidden, same as Plan, Insights, and 我的.
          Coach and the settings detail pages keep their native headers. */}
      <Stack.Screen name="index" options={{ title: "今日", headerShown: false }} />
    </Stack>
  );
}
