import { useEffect, useState, type ReactNode } from "react";
import { router } from "expo-router";
import { getOnboardingState } from "../api/onboarding";
import type { OnboardingStateResponse } from "@hbm/contracts";

/**
 * Wraps the authenticated app so that a user who has not finished onboarding is
 * sent to /onboarding exactly once per session. We fetch the state after auth
 * succeeds and redirect if `onboardingCompleted` is false. The onboarding
 * screen itself does not render under (app), so there is no loop.
 *
 * A transient fetch failure leaves the user in the app rather than blocking
 * them: the standing banner and the plan-page checklist remain as reminders.
 */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const state: OnboardingStateResponse = await getOnboardingState();
        if (!cancelled && !state.onboardingCompleted) {
          router.replace("/onboarding");
        }
      } catch {
        // best-effort: see header comment
      } finally {
        if (!cancelled) setChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!checked) return null;
  return <>{children}</>;
}
