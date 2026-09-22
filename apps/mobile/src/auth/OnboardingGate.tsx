import { useEffect, useState, type ReactNode } from "react";
import { router } from "expo-router";
import { getOnboardingState } from "../api/onboarding";
import type { OnboardingStateResponse } from "@hbm/contracts";

// Module-level so it survives remounts of the (app) layout within one session
// (a cold start re-runs the check because the module state resets).
let sessionOnboardingChecked = false;

/**
 * Marks onboarding as resolved for the rest of this session. Called by the
 * onboarding screen when the user skips or finishes, so a remount of the
 * (app) layout does not redirect them back to /onboarding again.
 */
export function markOnboardingBypassed() {
  sessionOnboardingChecked = true;
}

/**
 * Wraps the authenticated app so that a user who has not finished onboarding is
 * sent to /onboarding at most once per session. We fetch the state after auth
 * succeeds and redirect if `onboardingCompleted` is false. Once the check has
 * run (or the user has skipped onboarding via markOnboardingBypassed), remounts
 * of this gate within the same session do not re-check or redirect again.
 *
 * A transient fetch failure leaves the user in the app rather than blocking
 * them: the standing banner and the plan-page checklist remain as reminders.
 */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const [checked, setChecked] = useState(sessionOnboardingChecked);

  useEffect(() => {
    if (sessionOnboardingChecked) return;
    let cancelled = false;
    (async () => {
      try {
        const state: OnboardingStateResponse = await getOnboardingState();
        if (state.onboardingCompleted) {
          sessionOnboardingChecked = true;
        } else if (!cancelled) {
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
