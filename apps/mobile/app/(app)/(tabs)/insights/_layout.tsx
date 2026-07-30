import { Stack } from "expo-router";
import { useNativeHeaderOptions } from "../../../../src/navigation/headerOptions";

export default function InsightsLayout() {
  const screenOptions = useNativeHeaderOptions();

  return (
    <Stack screenOptions={screenOptions}>
      {/* Insights draws the shared warm in-page header, so the native large
          title is hidden. Warm headers are static by design — the loss of
          collapse-on-scroll here is intended, not a bug to fix later. */}
      <Stack.Screen name="index" options={{ title: "数据", headerShown: false }} />
    </Stack>
  );
}
