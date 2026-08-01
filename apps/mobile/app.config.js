/**
 * Expo config that prefers release env vars so `release:check` and EAS builds
 * share one source of truth. Falls back to the committed app.json values for
 * local development.
 */
const appJson = require("./app.json");

module.exports = () => {
  const expo = { ...appJson.expo };
  const bundleId = process.env.EXPO_IOS_BUNDLE_IDENTIFIER?.trim();
  const androidPackage = process.env.EXPO_ANDROID_PACKAGE?.trim();
  const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim();
  const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

  if (bundleId) {
    expo.ios = { ...expo.ios, bundleIdentifier: bundleId };
  }
  if (androidPackage) {
    expo.android = { ...expo.android, package: androidPackage };
  }
  expo.extra = {
    ...expo.extra,
    apiBaseUrl: apiBaseUrl || expo.extra?.apiBaseUrl || "http://localhost:3000",
    eas: {
      ...(expo.extra?.eas || {}),
      ...(easProjectId ? { projectId: easProjectId } : {})
    }
  };

  return { expo };
};
