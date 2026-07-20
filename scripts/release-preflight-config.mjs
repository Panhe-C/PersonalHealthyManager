const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BUNDLE_PATTERN = /^[A-Za-z][A-Za-z0-9]*(?:[.-][A-Za-z0-9]+){2,}$/;
const TEAM_PATTERN = /^[A-Z0-9]{10}$/;

function productionApiUrl(value) {
  try {
    const url = new URL(value);
    const localHost = url.hostname === "localhost"
      || url.hostname === "127.0.0.1"
      || url.hostname === "0.0.0.0"
      || url.hostname.endsWith(".local");
    return url.protocol === "https:" && !localHost;
  } catch {
    return false;
  }
}

export function releaseChecks(env, privacyPolicy) {
  const projectId = env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() || "";
  const apiBaseUrl = env.EXPO_PUBLIC_API_BASE_URL?.trim() || "";
  const bundleIdentifier = env.EXPO_IOS_BUNDLE_IDENTIFIER?.trim() || "";
  const appleTeamId = env.EXPO_APPLE_TEAM_ID?.trim() || "";

  return [
    {
      id: "eas-project",
      ok: UUID_PATTERN.test(projectId),
      message: "EXPO_PUBLIC_EAS_PROJECT_ID is a valid EAS UUID",
    },
    {
      id: "production-api",
      ok: productionApiUrl(apiBaseUrl),
      message: "EXPO_PUBLIC_API_BASE_URL is a non-local HTTPS origin",
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
      id: "privacy-metadata",
      ok: !privacyPolicy.includes("待填写"),
      message: "privacy notice has no release placeholders",
    },
  ];
}
