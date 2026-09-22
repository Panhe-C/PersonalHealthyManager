import { CANONICAL_PRODUCTION_ORIGIN } from "./release-web-config.mjs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BUNDLE_PATTERN = /^[A-Za-z][A-Za-z0-9]*(?:[.-][A-Za-z0-9]+){2,}$/;
const TEAM_PATTERN = /^[A-Z0-9]{10}$/;

export function mobileReleaseChecks(env) {
  const projectId = env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() || "";
  const apiBaseUrl = env.EXPO_PUBLIC_API_BASE_URL?.trim() || "";
  const bundleIdentifier = env.EXPO_IOS_BUNDLE_IDENTIFIER?.trim() || "";
  const appleTeamId = env.EXPO_APPLE_TEAM_ID?.trim() || "";
  const registrationSetting = env.EXPO_PUBLIC_REGISTRATION_ENABLED?.trim().toLowerCase() || "";

  return [
    {
      id: "eas-project",
      ok: UUID_PATTERN.test(projectId),
      message: "EXPO_PUBLIC_EAS_PROJECT_ID is a valid EAS UUID",
    },
    {
      id: "production-api",
      ok: apiBaseUrl === CANONICAL_PRODUCTION_ORIGIN,
      message: `EXPO_PUBLIC_API_BASE_URL is exactly ${CANONICAL_PRODUCTION_ORIGIN}`,
    },
    {
      id: "ios-identifier",
      ok: BUNDLE_PATTERN.test(bundleIdentifier),
      message: "EXPO_IOS_BUNDLE_IDENTIFIER is an explicit reverse-DNS identifier",
    },
    {
      id: "apple-team",
      ok: TEAM_PATTERN.test(appleTeamId),
      message: "EXPO_APPLE_TEAM_ID is a 10-character Apple Team ID",
    },
    {
      id: "registration-setting",
      ok: registrationSetting === "true" || registrationSetting === "false",
      message: "EXPO_PUBLIC_REGISTRATION_ENABLED is explicitly true or false",
    },
  ];
}
