import * as SecureStore from "expo-secure-store";

const LANGUAGE_CODE_KEY = "languageCode";

export async function getStoredLanguageCode() {
  try {
    return (await SecureStore.getItemAsync(LANGUAGE_CODE_KEY)) || "ru";
  } catch {
    return "ru";
  }
}

export async function setStoredLanguageCode(code) {
  try {
    const normalized = String(code || "ru").trim() || "ru";
    await SecureStore.setItemAsync(LANGUAGE_CODE_KEY, normalized);
  } catch {
    // no-op
  }
}
