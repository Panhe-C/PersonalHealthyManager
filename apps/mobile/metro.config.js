// Learn more: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// Force a single copy of React / React DOM. The repo root installs React 19 for
// the Next.js web app, but this Expo app pins React 18.3.1 (required by RN 0.76).
// Without this, packages hoisted to the root node_modules resolve the root's
// React 19 and we hit "Invalid hook call / more than one copy of React".
//
// We redirect react/react-dom resolution to start from this project's
// node_modules by overriding originModulePath, then delegate to Metro's own
// (cached, fast) resolver — far cheaper than calling require.resolve per import.
const anchor = path.join(projectRoot, "node_modules", "react", "index.js");
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const delegate = originalResolveRequest ?? context.resolveRequest;
  if (
    moduleName === "react" ||
    moduleName.startsWith("react/") ||
    moduleName === "react-dom" ||
    moduleName.startsWith("react-dom/")
  ) {
    return delegate({ ...context, originModulePath: anchor }, moduleName, platform);
  }
  return delegate(context, moduleName, platform);
};

module.exports = config;
