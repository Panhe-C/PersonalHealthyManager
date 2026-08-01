import { redirect } from "next/navigation";
import { getCurrentUser } from "@/src/auth/session";
import { getOnboardingState, onboardingIsComplete } from "@/src/services/onboardingService";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const state = await getOnboardingState(user.id);
  if (!onboardingIsComplete(state)) redirect("/onboarding");

  redirect("/plan");
}
