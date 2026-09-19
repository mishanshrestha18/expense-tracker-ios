const { withXcodeProject } = require('expo/config-plugins');

/**
 * Weak links FoundationModels, which only exists from iOS 26. The app runs from
 * iOS 16.4, and without this an older iPhone crashes at launch because the
 * framework is missing. The Siri quick-add checks availability at runtime.
 */
module.exports = function withWeakFrameworks(config) {
  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const configurations = project.pbxXCBuildConfigurationSection();

    for (const key of Object.keys(configurations)) {
      const settings = configurations[key].buildSettings;
      // Skip the comment entries pbxproj keeps alongside each configuration.
      if (!settings || settings.PRODUCT_NAME === undefined) continue;

      const existing = settings.OTHER_LDFLAGS ?? ['"$(inherited)"'];
      const flags = Array.isArray(existing) ? existing : [existing];
      if (flags.includes('"FoundationModels"')) continue;
      settings.OTHER_LDFLAGS = [...flags, '"-weak_framework"', '"FoundationModels"'];
    }

    return config;
  });
};
