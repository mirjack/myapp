const googleMapsApiKey =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
  process.env.GOOGLE_MAPS_API_KEY ||
  "";
const yandexMapsApiKey =
  process.env.EXPO_PUBLIC_YANDEX_MAPS_API_KEY ||
  process.env.YANDEX_MAPS_API_KEY ||
  "";

function normalizeUrl(rawValue) {
  const input = String(rawValue || "").trim();
  if (!input) return "";

  try {
    return new URL(input).toString();
  } catch {
    return "";
  }
}

function requiresCleartextTraffic(rawValue) {
  const normalizedUrl = normalizeUrl(rawValue);
  if (!normalizedUrl) return false;

  try {
    return new URL(normalizedUrl).protocol === "http:";
  } catch {
    return false;
  }
}

module.exports = ({ config }) => {
  const resolvedConfig = config || require("./app.json").expo || {};
  const ios = resolvedConfig.ios || {};
  const android = resolvedConfig.android || {};
  const extra = resolvedConfig.extra || {};
  const plugins = Array.isArray(resolvedConfig.plugins) ? resolvedConfig.plugins : [];
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
  const webUrl =
    process.env.EXPO_PUBLIC_WEB_URL ||
    process.env.EXPO_WEB_URL ||
    extra.webUrl ||
    "";
  const allowCleartextTraffic = requiresCleartextTraffic(webUrl);
  const expoBuildPropertiesPlugin = plugins.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === "expo-build-properties",
  );
  const hasExpoAssetPlugin = plugins.some((plugin) =>
    plugin === "expo-asset" ||
    (Array.isArray(plugin) && plugin[0] === "expo-asset"),
  );
  const otherPlugins = plugins.filter(
    (plugin) =>
      !(Array.isArray(plugin) && plugin[0] === "expo-build-properties") &&
      plugin !== "expo-asset" &&
      !(Array.isArray(plugin) && plugin[0] === "expo-asset"),
  );

  return {
    ...resolvedConfig,
    name: `${resolvedConfig.name || "Mio Beauty"}${appNameSuffix}`,
    scheme: `${baseScheme}${schemeSuffix}`,
    plugins: [
      ...otherPlugins,
      ...(hasExpoAssetPlugin ? [] : ["expo-asset"]),
      [
        "expo-build-properties",
        {
          ...((expoBuildPropertiesPlugin && expoBuildPropertiesPlugin[1]) || {}),
          android: {
            ...(((expoBuildPropertiesPlugin && expoBuildPropertiesPlugin[1]) || {}).android || {}),
            usesCleartextTraffic: allowCleartextTraffic,
          },
        },
      ],
    ],
    ios: {
      ...ios,
      bundleIdentifier: iosBundleIdentifier,
      infoPlist: {
        ...(ios.infoPlist || {}),
        ...(allowCleartextTraffic
          ? {
              NSAppTransportSecurity: {
                ...((ios.infoPlist && ios.infoPlist.NSAppTransportSecurity) || {}),
                NSAllowsArbitraryLoads: true,
                NSAllowsLocalNetworking: true,
              },
            }
          : {
              NSAppTransportSecurity: undefined,
            }),
      },
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
      yandexMapsApiKey,
      webUrl,
      allowCleartextTraffic,
    },
  };
};
