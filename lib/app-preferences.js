import * as SecureStore from "expo-secure-store";

import { detectDeviceLanguageCode, normalizeLanguageCode } from "@/lib/language";

const LANGUAGE_CODE_KEY = "languageCode";
const SECURE_STORE_WRITE_OPTIONS = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export async function getStoredLanguageCode() {
  try {
    const storedValue = await SecureStore.getItemAsync(LANGUAGE_CODE_KEY);
    if (storedValue) {
      return normalizeLanguageCode(storedValue);
    }

    const detectedLanguageCode = detectDeviceLanguageCode();
    await SecureStore.setItemAsync(
      LANGUAGE_CODE_KEY,
      detectedLanguageCode,
      SECURE_STORE_WRITE_OPTIONS,
    );
    return detectedLanguageCode;
  } catch {
    return detectDeviceLanguageCode();
  }
}

export async function setStoredLanguageCode(code) {
  try {
    const normalized = normalizeLanguageCode(code);
    await SecureStore.setItemAsync(
      LANGUAGE_CODE_KEY,
      normalized,
      SECURE_STORE_WRITE_OPTIONS,
    );
  } catch {
    // no-op
  }
}
