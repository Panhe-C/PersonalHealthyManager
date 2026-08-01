import { z } from "zod";

export const onboardingStateResponseSchema = z.object({
  onboardingCompleted: z.boolean(),
  healthDisclaimerAcknowledged: z.boolean(),
  steps: z.object({
    bodyProfile: z.boolean(),
    goal: z.boolean(),
    calendarSnapshot: z.boolean(),
    plan: z.boolean()
  })
});

export type OnboardingStateResponse = z.infer<typeof onboardingStateResponseSchema>;
