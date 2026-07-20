export default ({ config }) => {
  const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || config.extra?.apiBaseUrl || "http://localhost:3000";
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim();
  const iosBundleIdentifier = process.env.EXPO_IOS_BUNDLE_IDENTIFIER?.trim() || config.ios?.bundleIdentifier || "com.hbm.mobile";
  const androidPackage = process.env.EXPO_ANDROID_PACKAGE?.trim() || config.android?.package || "com.hbm.mobile";
  const appleTeamId = process.env.EXPO_APPLE_TEAM_ID?.trim();

  return {
    ...config,
    ios: {
      ...config.ios,
      bundleIdentifier: iosBundleIdentifier,
      ...(appleTeamId ? { appleTeamId } : {}),
    },
    android: {
      ...config.android,
      package: androidPackage,
    },
    extra: {
      ...config.extra,
      apiBaseUrl,
      ...(projectId ? { eas: { projectId }, easProjectId: projectId } : {}),
    },
  };
};
