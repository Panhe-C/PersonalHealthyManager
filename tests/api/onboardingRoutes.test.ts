import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/src/auth/session", () => ({
  requireUser: vi.fn(async () => ({ id: "user-1", email: "owner@example.test" }))
}));

vi.mock("@/src/services/onboardingService", () => ({
  getOnboardingState: vi.fn(),
  completeOnboarding: vi.fn(async () => {}),
  acknowledgeHealthDisclaimer: vi.fn(async () => {}),
  onboardingIsComplete: vi.fn((state: { onboardingCompletedAt: Date | null }) => state.onboardingCompletedAt !== null),
  healthDisclaimerAcknowledged: vi.fn(
    (state: { healthDisclaimerAcknowledgedAt: Date | null }) => state.healthDisclaimerAcknowledgedAt !== null
  )
}));

import { POST as onboardingPost, GET as onboardingGet } from "@/app/api/onboarding/route";
import { POST as ackPost } from "@/app/api/onboarding/acknowledge-disclaimer/route";
import { completeOnboarding, acknowledgeHealthDisclaimer, getOnboardingState } from "@/src/services/onboardingService";

const baseState = {
  onboardingCompletedAt: null as Date | null,
  healthDisclaimerAcknowledgedAt: null as Date | null,
  steps: { bodyProfile: false, goal: false, calendarSnapshot: false, plan: false }
};

describe("GET /api/onboarding", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the step flags and the two acknowledgment booleans", async () => {
    vi.mocked(getOnboardingState).mockResolvedValueOnce({
      ...baseState,
      steps: { bodyProfile: true, goal: false, calendarSnapshot: false, plan: false }
    });

    const response = await onboardingGet();
    const body = await response.json();

    expect(body).toEqual({
      onboardingCompleted: false,
      healthDisclaimerAcknowledged: false,
      steps: { bodyProfile: true, goal: false, calendarSnapshot: false, plan: false }
    });
  });
});

describe("POST /api/onboarding", () => {
  beforeEach(() => vi.clearAllMocks());

  it("completes onboarding and acknowledges the disclaimer when asked to", async () => {
    vi.mocked(getOnboardingState).mockResolvedValueOnce({
      onboardingCompletedAt: new Date("2026-08-01"),
      healthDisclaimerAcknowledgedAt: new Date("2026-08-01"),
      steps: { bodyProfile: true, goal: true, calendarSnapshot: true, plan: true }
    });

    const response = await onboardingPost(
      new Request("http://localhost/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acknowledgeDisclaimer: true })
      })
    );

    expect(completeOnboarding).toHaveBeenCalledWith("user-1");
    expect(acknowledgeHealthDisclaimer).toHaveBeenCalledWith("user-1");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.onboardingCompleted).toBe(true);
    expect(body.healthDisclaimerAcknowledged).toBe(true);
  });

  it("completes onboarding without acknowledging when the flag is absent", async () => {
    vi.mocked(getOnboardingState).mockResolvedValue(baseState);

    await onboardingPost(
      new Request("http://localhost/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      })
    );

    expect(completeOnboarding).toHaveBeenCalledWith("user-1");
    expect(acknowledgeHealthDisclaimer).not.toHaveBeenCalled();
  });

  it("tolerates a missing or non-JSON body", async () => {
    vi.mocked(getOnboardingState).mockResolvedValue(baseState);

    const response = await onboardingPost(
      new Request("http://localhost/api/onboarding", { method: "POST" })
    );

    expect(response.status).toBe(200);
    expect(completeOnboarding).toHaveBeenCalledWith("user-1");
    expect(acknowledgeHealthDisclaimer).not.toHaveBeenCalled();
  });
});

describe("POST /api/onboarding/acknowledge-disclaimer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("records the acknowledgment", async () => {
    const response = await ackPost(
      new Request("http://localhost/api/onboarding/acknowledge-disclaimer", { method: "POST" })
    );

    expect(acknowledgeHealthDisclaimer).toHaveBeenCalledWith("user-1");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
