const { withAppDelegate } = require("expo/config-plugins");

const appMetricaApiKey =
  process.env.EXPO_PUBLIC_APP_METRICA_API_KEY ||
  process.env.APP_METRICA_API_KEY ||
  "";
const yandexMapsApiKey =
  process.env.EXPO_PUBLIC_YANDEX_MAPS_API_KEY ||
  process.env.YANDEX_MAPS_API_KEY ||
  "";

function addOnce(contents, needle, replacement) {
  return contents.includes(needle)
    ? contents
    : contents.replace(replacement.from, replacement.to);
}

function withYandexMaps(config) {
  if (!yandexMapsApiKey) return config;

  return withAppDelegate(config, (nextConfig) => {
    const appDelegate = nextConfig.modResults;
    const escapedApiKey = JSON.stringify(yandexMapsApiKey);
    const objcApiKey = `@"${yandexMapsApiKey
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')}"`;

    if (appDelegate.language === "swift") {
      appDelegate.contents = addOnce(
        appDelegate.contents,
        "import YandexMapsMobile",
        {
          from: /import Expo\s*\n/,
          to: "import Expo\nimport YandexMapsMobile\n",
        },
      );
      appDelegate.contents = addOnce(
        appDelegate.contents,
        "YMKMapKit.sharedInstance()",
        {
          from: /\s+return super\.application\(application, didFinishLaunchingWithOptions: launchOptions\)/,
          to: `\n    YMKMapKit.setApiKey(${escapedApiKey})\n    YMKMapKit.setLocale("ru_RU")\n    _ = YMKMapKit.sharedInstance()\n\n    return super.application(application, didFinishLaunchingWithOptions: launchOptions)`,
        },
      );
    } else {
      appDelegate.contents = addOnce(
        appDelegate.contents,
        "#import <YandexMapsMobile/YMKMapKitFactory.h>",
        {
          from: /#import "AppDelegate.h"/,
          to: '#import "AppDelegate.h"\n#import <YandexMapsMobile/YMKMapKitFactory.h>',
        },
      );
      appDelegate.contents = addOnce(
        appDelegate.contents,
        "[YMKMapKit mapKit];",
        {
          from: /\s+return YES;/,
          to: `\n\n\t[YMKMapKit setApiKey:${objcApiKey}];\n\t[YMKMapKit setLocale:@"ru_RU"];\n\t[YMKMapKit mapKit];\n\n\treturn YES;`,
        },
      );
    }

    return nextConfig;
  });
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
    (ios.bundleIdentifier || "uz.miobeauty.app") + variantSuffix;
  const androidPackage =
    (android.package || "uz.miobeauty.app") + variantSuffix;
  const tenantDomain =
    process.env.EXPO_PUBLIC_TENANT_DOMAIN ||
    process.env.EXPO_PUBLIC_STOREFRONT_DOMAIN ||
    extra.tenantDomain ||
    "";
  const allowCleartextTraffic = false;
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

  const nextConfig = {
    ...resolvedConfig,
    name: `${resolvedConfig.name || "Mio Beauty"}${appNameSuffix}`,
    newArchEnabled: false,
    platforms: ["ios", "android"],
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
    },
    android: {
      ...android,
      package: androidPackage,
    },
    extra: {
      ...extra,
      appMetricaApiKey,
      yandexMapsApiKey,
      tenantDomain,
      allowCleartextTraffic,
    },
  };

  return withYandexMaps(nextConfig);
};
