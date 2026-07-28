import { Stack } from "expo-router";

// Without this the group has no layout route, so the root stack's
// `<Stack.Screen name="(auth)" />` matches nothing and login/register are
// hoisted into the root navigator instead of forming their own stack.
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
