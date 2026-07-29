import { Stack } from "expo-router";
import { useNativeHeaderOptions } from "../../../../src/navigation/headerOptions";

export default function TodayLayout() {
  const screenOptions = useNativeHeaderOptions();

  return (
    <Stack screenOptions={screenOptions}>
      {/* Today draws its own in-page header (date overline + 今日 title), so
          the native large title is hidden here and only here. The other four
          tabs keep theirs until phase 2. */}
      <Stack.Screen name="index" options={{ title: "今日", headerShown: false }} />
    </Stack>
  );
}
