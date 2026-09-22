export const CANONICAL_PRODUCTION_ORIGIN = "https://www.cbhdev.xyz";

function trimmed(env, name) {
  return env[name]?.trim() || "";
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function fromAddressIsValid(value) {
  const match = value.match(/<([^<>]+)>$/);
  return isEmail(match ? match[1] : value) && !value.toLowerCase().includes("localhost");
}

function isRealDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return new Date(`${value}T00:00:00.000Z`).toISOString().startsWith(value);
}

export function webReleaseChecks(env, privacyPolicy) {
  const appBaseUrl = trimmed(env, "HBM_APP_BASE_URL");
  const publicBaseUrl = trimmed(env, "HBM_PUBLIC_BASE_URL");
  const operatorName = trimmed(env, "HBM_OPERATOR_NAME");
  const privacyEmail = trimmed(env, "HBM_PRIVACY_EMAIL");
  const policyDate = trimmed(env, "HBM_POLICY_EFFECTIVE_DATE");
  const deploymentRegion = trimmed(env, "HBM_DEPLOYMENT_REGION");
  const registrationSetting = trimmed(env, "HBM_REGISTRATION_ENABLED").toLowerCase();
  const emailTransport = trimmed(env, "HBM_EMAIL_TRANSPORT").toLowerCase();
  const smtpHost = trimmed(env, "HBM_SMTP_HOST");
  const smtpPort = Number(trimmed(env, "HBM_SMTP_PORT") || "587");
  const smtpSecure = trimmed(env, "HBM_SMTP_SECURE").toLowerCase();
  const emailFrom = trimmed(env, "HBM_EMAIL_FROM");
  const smtpUser = trimmed(env, "HBM_SMTP_USER");
  const smtpPassword = trimmed(env, "HBM_SMTP_PASSWORD");
  const smtpRequired = emailTransport === "smtp";

  return [
    {
      id: "canonical-app-origin",
      ok: appBaseUrl === CANONICAL_PRODUCTION_ORIGIN,
      message: `HBM_APP_BASE_URL is exactly ${CANONICAL_PRODUCTION_ORIGIN}`,
    },
    {
      id: "canonical-public-origin",
      ok: publicBaseUrl === CANONICAL_PRODUCTION_ORIGIN,
      message: `HBM_PUBLIC_BASE_URL is exactly ${CANONICAL_PRODUCTION_ORIGIN}`,
    },
    {
      id: "origin-match",
      ok: Boolean(appBaseUrl) && appBaseUrl === publicBaseUrl,
      message: "HBM_APP_BASE_URL and HBM_PUBLIC_BASE_URL match",
    },
    {
      id: "privacy-operator",
      ok: Boolean(operatorName),
      message: "HBM_OPERATOR_NAME is set by the deployer",
    },
    {
      id: "privacy-email",
      ok: isEmail(privacyEmail),
      message: "HBM_PRIVACY_EMAIL is a valid address",
    },
    {
      id: "privacy-date",
      ok: isRealDate(policyDate),
      message: "HBM_POLICY_EFFECTIVE_DATE is a real YYYY-MM-DD date",
    },
    {
      id: "privacy-region",
      ok: Boolean(deploymentRegion),
      message: "HBM_DEPLOYMENT_REGION is set",
    },
    {
      id: "privacy-placeholders",
      ok: !privacyPolicy.includes("待填写（"),
      message: "privacy notice markdown has no runtime placeholder values",
    },
    {
      id: "registration-setting",
      ok: registrationSetting === "true" || registrationSetting === "false",
      message: "HBM_REGISTRATION_ENABLED is explicitly true or false",
    },
    {
      id: "email-policy",
      ok: emailTransport === "console" || emailTransport === "smtp",
      message: "email transport is explicitly console or smtp",
    },
    {
      id: "smtp-host",
      ok: !smtpRequired || Boolean(smtpHost),
      message: "HBM_SMTP_HOST is set when SMTP transport is selected",
    },
    {
      id: "smtp-port",
      ok: !smtpRequired || (Number.isInteger(smtpPort) && smtpPort > 0 && smtpPort <= 65535),
      message: "HBM_SMTP_PORT is valid when SMTP transport is selected",
    },
    {
      id: "smtp-secure",
      ok: !smtpRequired || smtpSecure === "true" || smtpSecure === "false",
      message: "HBM_SMTP_SECURE is explicitly true or false when SMTP transport is selected",
    },
    {
      id: "smtp-from",
      ok: !smtpRequired || fromAddressIsValid(emailFrom),
      message: "HBM_EMAIL_FROM is a non-local sender when SMTP transport is selected",
    },
    {
      id: "smtp-auth",
      ok: !smtpRequired || (Boolean(smtpUser) && Boolean(smtpPassword)),
      message: "HBM_SMTP_USER and HBM_SMTP_PASSWORD are both set when SMTP transport is selected",
    },
  ];
}
