import { NativeModules, Platform } from "react-native";

export const DEFAULT_LANGUAGE_CODE = "ru";
export const SUPPORTED_LANGUAGE_CODES = ["ru", "uz", "en"];

export function normalizeLanguageCode(code) {
  const value = String(code || "").trim().toLowerCase();

  if (value.startsWith("uz")) return "uz";
  if (value.startsWith("en")) return "en";
  if (value.startsWith("ru")) return "ru";

  return DEFAULT_LANGUAGE_CODE;
}

function readNativeLocale() {
  try {
    if (Platform.OS === "ios") {
      const settings =
        NativeModules?.SettingsManager?.settings ||
        NativeModules?.SettingsManager?._settings ||
        {};
      return (
        settings.AppleLocale ||
        settings.AppleLanguages?.[0] ||
        ""
      );
    }

    if (Platform.OS === "android") {
      return (
        NativeModules?.I18nManager?.localeIdentifier ||
        NativeModules?.I18nManager?.locale ||
        ""
      );
    }
  } catch {
    // Continue to JS runtime fallbacks.
  }
  return "";
}

function readRuntimeLocale() {
  try {
    const nativeLocale = readNativeLocale();
    if (nativeLocale) return nativeLocale;
  } catch {
    // Continue to JS runtime fallbacks.
  }

  try {
    const intlLocale = Intl.DateTimeFormat().resolvedOptions().locale;
    if (intlLocale) return intlLocale;
  } catch {
    // ignore
  }

  try {
    if (typeof navigator !== "undefined") {
      return navigator.language || navigator.languages?.[0] || "";
    }
  } catch {
    // ignore
  }

  return "";
}

export function detectDeviceLanguageCode() {
  return normalizeLanguageCode(readRuntimeLocale());
}
