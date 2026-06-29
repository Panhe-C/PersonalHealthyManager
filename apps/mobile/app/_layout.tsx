import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useState } from "react";
import { AuthProvider, useAuth } from "../src/auth/AuthContext";
import { useTheme } from "../src/theme/tokens";

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
        <RootStack />
      </AuthProvider>
    </QueryClientProvider>
  );
}
