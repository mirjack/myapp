import * as SecureStore from "expo-secure-store";

const AUTH_TOKENS_KEY = "authTokens";
const PENDING_AUTH_ACTION_KEY = "pendingAuthAction";

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

export async function getPendingAuthAction() {
  try {
    const raw = await SecureStore.getItemAsync(PENDING_AUTH_ACTION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.type || parsed.productId == null) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function setPendingAuthAction(action) {
  try {
    if (!action) {
      await SecureStore.deleteItemAsync(PENDING_AUTH_ACTION_KEY);
      return;
    }
    await SecureStore.setItemAsync(
      PENDING_AUTH_ACTION_KEY,
      JSON.stringify(action),
    );
  } catch {
    // no-op
  }
}
