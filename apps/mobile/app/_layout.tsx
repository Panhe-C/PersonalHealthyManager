import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import * as Notifications from "expo-notifications";
import { AuthProvider, useAuth } from "../src/auth/AuthContext";
import { useTheme } from "../src/theme/tokens";
import { configureNotificationPresentation } from "../src/notifications";

configureNotificationPresentation();

function RootStack() {
  const { status } = useAuth();
  const { tokens } = useTheme();

  if (status === "loading") return null; // splash guard

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: tokens.bg } }}>
      {status === "authed" ? (
        <Stack.Screen name="(app)" />
      ) : (
        <Stack.Screen name="(auth)" />
      )}
    </Stack>
  );
}

function NotificationNavigation() {
  const router = useRouter();
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const taskId = response.notification.request.content.data?.taskId;
      router.push(taskId ? "/(app)/(tabs)/today" : "/(app)/(tabs)/plan");
    });
    return () => subscription.remove();
  }, [router]);
  return null;
}

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, staleTime: 30_000 } }
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NotificationNavigation />
        <RootStack />
      </AuthProvider>
    </QueryClientProvider>
  );
}
