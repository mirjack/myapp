import Constants from "expo-constants";

const PROD_FALLBACK_STOREFRONT_DOMAIN = "mirjeck.cmfrt.uz";

function normalizeTenantDomain(rawValue) {
  const trimmed = String(rawValue || "").trim();
  if (!trimmed) return "";
  try {
    return new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`)
      .hostname.toLowerCase();
  } catch {
    return trimmed
      .replace(/^https?:\/\//i, "")
      .replace(/\/.*$/, "")
      .replace(/:\d+$/, "")
      .toLowerCase();
  }
}

export const TENANT_DOMAIN = normalizeTenantDomain(
  process.env.EXPO_PUBLIC_TENANT_DOMAIN ||
    process.env.EXPO_PUBLIC_STOREFRONT_DOMAIN ||
    Constants?.expoConfig?.extra?.tenantDomain ||
    Constants?.manifest2?.extra?.expoClient?.extra?.tenantDomain ||
    PROD_FALLBACK_STOREFRONT_DOMAIN,
);

export const STOREFRONT_ORIGIN = TENANT_DOMAIN
  ? `https://${TENANT_DOMAIN}`
  : `https://${PROD_FALLBACK_STOREFRONT_DOMAIN}`;

export const YANDEX_MAPS_API_KEY =
  process.env.EXPO_PUBLIC_YANDEX_MAPS_API_KEY ||
  Constants?.expoConfig?.extra?.yandexMapsApiKey ||
  Constants?.manifest2?.extra?.expoClient?.extra?.yandexMapsApiKey ||
  "";

export const APP_METRICA_API_KEY =
  process.env.EXPO_PUBLIC_APP_METRICA_API_KEY ||
  Constants?.expoConfig?.extra?.appMetricaApiKey ||
  Constants?.manifest2?.extra?.expoClient?.extra?.appMetricaApiKey ||
  "";

export const GOOGLE_MAPS_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
  process.env.GOOGLE_MAPS_API_KEY ||
  Constants?.expoConfig?.extra?.googleMapsApiKey ||
  Constants?.manifest2?.extra?.expoClient?.extra?.googleMapsApiKey ||
  "";

export function getRuntimeConfig() {
  return {
    appMetricaApiKey: APP_METRICA_API_KEY,
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    storefrontOrigin: STOREFRONT_ORIGIN,
    tenantDomain: TENANT_DOMAIN,
    yandexMapsApiKey: YANDEX_MAPS_API_KEY,
  };
}
