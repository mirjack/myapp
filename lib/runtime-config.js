import Constants from "expo-constants";

const PROD_FALLBACK_WEB_URL = "https://mirjeck.cmfrt.uz/";

function resolveDevFallbackUrl() {
  const hostUri =
    Constants?.expoConfig?.hostUri ||
    Constants?.manifest2?.extra?.expoClient?.hostUri ||
    "";
  const host = String(hostUri).split(":")[0];
  if (!host) return PROD_FALLBACK_WEB_URL;
  return `http://${host}:80/`;
}

const FALLBACK_WEB_URL = __DEV__
  ? resolveDevFallbackUrl()
  : PROD_FALLBACK_WEB_URL;

function normalizeWebBaseUrl(rawValue) {
  const input = String(rawValue || "").trim();
  const candidate = input || FALLBACK_WEB_URL;

  try {
    return new URL(candidate).toString();
  } catch {
    return FALLBACK_WEB_URL;
  }
}

export const WEBVIEW_BASE_URL = normalizeWebBaseUrl(process.env.EXPO_PUBLIC_WEB_URL);

export const WEBVIEW_ORIGIN = (() => {
  try {
    return new URL(WEBVIEW_BASE_URL).origin;
  } catch {
    return null;
  }
})();

export function toWebViewUrl(pathname = "/") {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  try {
    return new URL(path, WEBVIEW_BASE_URL).toString();
  } catch {
    return WEBVIEW_BASE_URL;
  }
}

export function isWebViewInternalUrl(url) {
  if (!url) return false;
  if (url === "about:blank") return true;

  try {
    if (!WEBVIEW_ORIGIN) return true;
    return new URL(url).origin === WEBVIEW_ORIGIN;
  } catch {
    if (!WEBVIEW_ORIGIN) return true;
    return String(url).startsWith(WEBVIEW_ORIGIN);
  }
}
