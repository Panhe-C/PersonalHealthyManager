import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/src/db/client", () => ({
  prisma: {
    user: {
      findUniqueOrThrow: vi.fn(),
      update: vi.fn()
    },
    bodyProfile: { findUnique: vi.fn() },
    goal: { count: vi.fn() },
    calendarSnapshot: { findFirst: vi.fn() },
    plan: { findFirst: vi.fn() }
  }
}));

import { prisma } from "@/src/db/client";
import {
  acknowledgeHealthDisclaimer,
  completeOnboarding,
  getOnboardingState,
  healthDisclaimerAcknowledged,
  onboardingIsComplete
} from "@/src/services/onboardingService";

describe("getOnboardingState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.bodyProfile.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.goal.count).mockResolvedValue(0 as never);
    vi.mocked(prisma.calendarSnapshot.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.plan.findFirst).mockResolvedValue(null as never);
  });

  it("reports every step as incomplete for a fresh account", async () => {
    vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValue({
      onboardingCompletedAt: null,
      healthDisclaimerAcknowledgedAt: null
    } as never);

    const state = await getOnboardingState("user-1");

    expect(state).toEqual({
      onboardingCompletedAt: null,
      healthDisclaimerAcknowledgedAt: null,
      steps: {
        bodyProfile: false,
        goal: false,
        calendarSnapshot: false,
        plan: false
      }
    });
    expect(onboardingIsComplete(state)).toBe(false);
    expect(healthDisclaimerAcknowledged(state)).toBe(false);
  });

  it("marks a step done when its underlying data exists", async () => {
    vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValue({
      onboardingCompletedAt: new Date("2026-08-01"),
      healthDisclaimerAcknowledgedAt: new Date("2026-08-01")
    } as never);
    vi.mocked(prisma.bodyProfile.findUnique).mockResolvedValue({ id: "bp-1" } as never);
    vi.mocked(prisma.goal.count).mockResolvedValue(2 as never);
    vi.mocked(prisma.calendarSnapshot.findFirst).mockResolvedValue({ id: "cs-1" } as never);
    vi.mocked(prisma.plan.findFirst).mockResolvedValue({ id: "plan-1" } as never);

    const state = await getOnboardingState("user-1");

    expect(state.steps).toEqual({
      bodyProfile: true,
      goal: true,
      calendarSnapshot: true,
      plan: true
    });
    expect(onboardingIsComplete(state)).toBe(true);
    expect(healthDisclaimerAcknowledged(state)).toBe(true);
  });

  it("treats an archived goal as not counting toward the goal step", async () => {
    vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValue({
      onboardingCompletedAt: null,
      healthDisclaimerAcknowledgedAt: null
    } as never);
    vi.mocked(prisma.goal.count).mockResolvedValue(0 as never);

    const state = await getOnboardingState("user-1");

    expect(state.steps.goal).toBe(false);
    // count is filtered to active goals only
    expect(prisma.goal.count).toHaveBeenCalledWith({ where: { userId: "user-1", status: "active" } });
  });
});

describe("completeOnboarding", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stamps onboardingCompletedAt with the current time", async () => {
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);

    await completeOnboarding("user-1");

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { onboardingCompletedAt: expect.any(Date) }
    });
  });
});

describe("acknowledgeHealthDisclaimer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stamps healthDisclaimerAcknowledgedAt with the current time", async () => {
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);

    await acknowledgeHealthDisclaimer("user-1");

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { healthDisclaimerAcknowledgedAt: expect.any(Date) }
    });
  });
});
