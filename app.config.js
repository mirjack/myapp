const appJson = require("./app.json");

const googleMapsApiKey =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
  process.env.GOOGLE_MAPS_API_KEY ||
  "";

module.exports = () => {
  const config = appJson.expo || {};
  const android = config.android || {};
  const extra = config.extra || {};

  return {
    ...config,
    android: {
      ...android,
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
