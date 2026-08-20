// Compatibility export for integrations that imported the old aggregate helper.
import { mobileReleaseChecks } from "./release-mobile-config.mjs";
import { webReleaseChecks } from "./release-web-config.mjs";

export function releaseChecks(env, privacyPolicy) {
  return [...webReleaseChecks(env, privacyPolicy), ...mobileReleaseChecks(env)];
}
