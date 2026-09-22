import { onboardingStateResponseSchema, type OnboardingStateResponse } from "@hbm/contracts";
import { api } from "./client";

export function getOnboardingState() {
  return api.get<OnboardingStateResponse>("/onboarding", onboardingStateResponseSchema);
}

export function completeOnboarding(acknowledgeDisclaimer: boolean) {
  return api.post<OnboardingStateResponse>(
    "/onboarding",
    { acknowledgeDisclaimer },
    onboardingStateResponseSchema
  );
}

export function acknowledgeHealthDisclaimer() {
  return api.post<{ ok: true }>("/onboarding/acknowledge-disclaimer", {});
}
