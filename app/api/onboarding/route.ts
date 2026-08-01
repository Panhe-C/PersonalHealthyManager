import { NextResponse } from "next/server";
import { requireUser } from "@/src/auth/session";
import {
  acknowledgeHealthDisclaimer,
  completeOnboarding,
  getOnboardingState,
  healthDisclaimerAcknowledged,
  onboardingIsComplete
} from "@/src/services/onboardingService";

export async function GET() {
  const user = await requireUser();
  const state = await getOnboardingState(user.id);

  return NextResponse.json({
    onboardingCompleted: onboardingIsComplete(state),
    healthDisclaimerAcknowledged: healthDisclaimerAcknowledged(state),
    steps: state.steps
  });
}

export async function POST(request: Request) {
  const user = await requireUser();
  const body = (await request.json().catch(() => ({}))) as { acknowledgeDisclaimer?: boolean };

  await completeOnboarding(user.id);
  // The onboarding screen ends with the disclaimer, so acknowledging it here
  // keeps the two flags in step. A separate endpoint is unnecessary.
  if (body.acknowledgeDisclaimer) {
    await acknowledgeHealthDisclaimer(user.id);
  }

  const state = await getOnboardingState(user.id);
  return NextResponse.json({
    onboardingCompleted: onboardingIsComplete(state),
    healthDisclaimerAcknowledged: healthDisclaimerAcknowledged(state),
    steps: state.steps
  });
}
