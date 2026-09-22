import { prisma } from "@/src/db/client";

export interface OnboardingState {
  onboardingCompletedAt: Date | null;
  healthDisclaimerAcknowledgedAt: Date | null;
  steps: {
    bodyProfile: boolean;
    goal: boolean;
    calendarSnapshot: boolean;
    plan: boolean;
  };
}

/**
 * The four steps the planner needs before it can produce anything, in the order
 * the README walks through. Each is skippable; this just reports whether the
 * underlying data exists so the onboarding screen can show a check.
 */
export async function getOnboardingState(userId: string): Promise<OnboardingState> {
  const [user, bodyProfile, goalCount, calendarSnapshot, plan] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { onboardingCompletedAt: true, healthDisclaimerAcknowledgedAt: true }
    }),
    prisma.bodyProfile.findUnique({ where: { userId }, select: { id: true } }),
    prisma.goal.count({ where: { userId, status: "active" } }),
    prisma.calendarSnapshot.findFirst({ where: { userId }, select: { id: true } }),
    prisma.plan.findFirst({ where: { userId }, select: { id: true }, orderBy: { createdAt: "desc" } })
  ]);

  return {
    onboardingCompletedAt: user.onboardingCompletedAt,
    healthDisclaimerAcknowledgedAt: user.healthDisclaimerAcknowledgedAt,
    steps: {
      bodyProfile: Boolean(bodyProfile),
      goal: goalCount > 0,
      calendarSnapshot: Boolean(calendarSnapshot),
      plan: Boolean(plan)
    }
  };
}

export function onboardingIsComplete(state: OnboardingState): boolean {
  return state.onboardingCompletedAt !== null;
}

export function healthDisclaimerAcknowledged(state: OnboardingState): boolean {
  return state.healthDisclaimerAcknowledgedAt !== null;
}

/**
 * Marks onboarding done without requiring every step to be filled in. The
 * screen lets the user skip; we record that they have seen the path so we do
 * not keep redirecting them, and the in-app banner is the standing reminder.
 */
export async function completeOnboarding(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { onboardingCompletedAt: new Date() }
  });
}

export async function acknowledgeHealthDisclaimer(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { healthDisclaimerAcknowledgedAt: new Date() }
  });
}
