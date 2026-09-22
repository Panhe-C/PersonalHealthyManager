const { withPodfile } = require("@expo/config-plugins");

const MARKER = "# Keep every pod target aligned with the app's iOS 16 minimum.";

module.exports = function withIos16Pods(config) {
  return withPodfile(config, (podfileConfig) => {
    if (podfileConfig.modResults.contents.includes(MARKER)) {
      return podfileConfig;
    }

    const insertionPoint = "    # This is necessary for Xcode 14";
    const deploymentTargetOverride = `    ${MARKER}
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_config|
        build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '16.0'
      end
    end

`;

    if (!podfileConfig.modResults.contents.includes(insertionPoint)) {
      throw new Error("Unable to locate the Expo Podfile post_install block.");
    }

    podfileConfig.modResults.contents = podfileConfig.modResults.contents.replace(
      insertionPoint,
      `${deploymentTargetOverride}${insertionPoint}`,
    );

    return podfileConfig;
  });
};
