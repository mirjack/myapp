import * as SecureStore from "expo-secure-store";

const AUTH_TOKENS_KEY = "authTokens";

export async function getStoredAuthTokens() {
  try {
    return await SecureStore.getItemAsync(AUTH_TOKENS_KEY);
  } catch {
    return null;
  }
}

export async function setStoredAuthTokens(tokensString) {
  try {
    if (!tokensString) {
      await SecureStore.deleteItemAsync(AUTH_TOKENS_KEY);
      return;
    }
    await SecureStore.setItemAsync(AUTH_TOKENS_KEY, tokensString);
  } catch {
    // no-op
  }
}

export async function clearStoredAuthTokens() {
  try {
    await SecureStore.deleteItemAsync(AUTH_TOKENS_KEY);
  } catch {
    // no-op
  }
}
