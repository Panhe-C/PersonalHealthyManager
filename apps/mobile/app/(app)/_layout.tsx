import { Redirect, Slot } from "expo-router";
import { useAuth } from "../../src/auth/AuthContext";

export default function AppLayout() {
  const { status } = useAuth();
  if (status !== "authed") return <Redirect href="/(auth)/login" />;
  return <Slot />;
}
