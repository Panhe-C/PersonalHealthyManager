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
  const operatorName = env.HBM_OPERATOR_NAME?.trim() || "";
  const privacyEmail = env.HBM_PRIVACY_EMAIL?.trim() || "";
  const policyDate = env.HBM_POLICY_EFFECTIVE_DATE?.trim() || "";
  const deploymentRegion = env.HBM_DEPLOYMENT_REGION?.trim() || "";

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
      id: "privacy-operator",
      ok: Boolean(operatorName),
      message: "HBM_OPERATOR_NAME is set (shown on /privacy and /terms)",
    },
    {
      id: "privacy-email",
      ok: Boolean(privacyEmail) && /.+@.+\..+/.test(privacyEmail),
      message: "HBM_PRIVACY_EMAIL is a valid address",
    },
    {
      id: "privacy-date",
      ok: /^\d{4}-\d{2}-\d{2}$/.test(policyDate),
      message: "HBM_POLICY_EFFECTIVE_DATE is a YYYY-MM-DD date",
    },
    {
      id: "privacy-region",
      ok: Boolean(deploymentRegion),
      message: "HBM_DEPLOYMENT_REGION is set",
    },
    {
      id: "privacy-placeholders",
      ok: !privacyPolicy.includes("待填写"),
      message: "privacy notice markdown has no leftover placeholders",
    },
  ];
}
