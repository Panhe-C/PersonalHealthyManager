import { Redirect } from "expo-router";
import { useAuth } from "../src/auth/AuthContext";

// Root entry: resolve `/` to the right place. Native stacks pick a default
// screen automatically, but URL-based (web / deep link) entry at `/` needs an
// explicit redirect based on auth status.
export default function Index() {
  const { status } = useAuth();
  if (status === "loading") return null;
  return <Redirect href={status === "authed" ? "/(app)/(tabs)/today" : "/(auth)/login"} />;
}
