const googleMapsApiKey =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
  process.env.GOOGLE_MAPS_API_KEY ||
  "";

module.exports = ({ config }) => {
  const resolvedConfig = config || require("./app.json").expo || {};
  const ios = resolvedConfig.ios || {};
  const android = resolvedConfig.android || {};
  const extra = resolvedConfig.extra || {};
  const appVariant =
    process.env.APP_VARIANT || process.env.EAS_BUILD_PROFILE || "production";
  const isDevelopmentVariant = appVariant === "development";
  const isPreviewVariant = appVariant === "preview";
  const variantSuffix = isDevelopmentVariant
    ? ".dev"
    : isPreviewVariant
      ? ".preview"
      : "";
  const appNameSuffix = isDevelopmentVariant
    ? " Dev"
    : isPreviewVariant
      ? " Preview"
      : "";
  const schemeSuffix = isDevelopmentVariant
    ? "-dev"
    : isPreviewVariant
      ? "-preview"
      : "";
  const baseScheme = resolvedConfig.scheme || "myapp";
  const iosBundleIdentifier =
    (ios.bundleIdentifier || "uz.miobeauty.webview") + variantSuffix;
  const androidPackage =
    (android.package || "uz.miobeauty.webview") + variantSuffix;

  return {
    ...resolvedConfig,
    name: `${resolvedConfig.name || "Mio Beauty"}${appNameSuffix}`,
    scheme: `${baseScheme}${schemeSuffix}`,
    ios: {
      ...ios,
      bundleIdentifier: iosBundleIdentifier,
      config: {
        ...(ios.config || {}),
        googleMapsApiKey,
      },
    },
    android: {
      ...android,
      package: androidPackage,
      config: {
        ...(android.config || {}),
        googleMaps: {
          ...((android.config && android.config.googleMaps) || {}),
          apiKey: googleMapsApiKey,
        },
      },
    },
    extra: {
      ...extra,
      googleMapsApiKey,
    },
  };
};
