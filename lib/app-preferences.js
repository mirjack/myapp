import * as SecureStore from "expo-secure-store";

import { detectDeviceLanguageCode, normalizeLanguageCode } from "@/lib/language";

const LANGUAGE_CODE_KEY = "languageCode";

export async function getStoredLanguageCode() {
  try {
    const storedValue = await SecureStore.getItemAsync(LANGUAGE_CODE_KEY);
    if (storedValue) {
      return normalizeLanguageCode(storedValue);
    }

    const detectedLanguageCode = detectDeviceLanguageCode();
    await SecureStore.setItemAsync(LANGUAGE_CODE_KEY, detectedLanguageCode);
    return detectedLanguageCode;
  } catch {
    return detectDeviceLanguageCode();
  }
}

export async function setStoredLanguageCode(code) {
  try {
    const normalized = normalizeLanguageCode(code);
    await SecureStore.setItemAsync(LANGUAGE_CODE_KEY, normalized);
  } catch {
    // no-op
  }
}
