import { Redirect, Stack } from "expo-router";
import { useAuth } from "../../src/auth/AuthContext";
import { OnboardingGate } from "../../src/auth/OnboardingGate";
import { useTheme } from "../../src/theme/tokens";

export default function AppLayout() {
  const { status } = useAuth();
  const { tokens } = useTheme();
  if (status !== "authed") return <Redirect href="/(auth)/login" />;

  return (
    <OnboardingGate>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: tokens.bg } }}>
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </OnboardingGate>
  );
}
