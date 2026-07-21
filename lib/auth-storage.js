import * as SecureStore from "expo-secure-store";

const AUTH_TOKENS_KEY = "authTokens";
const PENDING_AUTH_ACTION_KEY = "pendingAuthAction";
let authTokensMemory = null;

export function getStoredAuthTokensSync() {
  return authTokensMemory;
}

export async function getStoredAuthTokens() {
  try {
    const value = await SecureStore.getItemAsync(AUTH_TOKENS_KEY);
    authTokensMemory = value;
    return value;
  } catch {
    return null;
  }
}

export async function setStoredAuthTokens(tokensString) {
  try {
    if (!tokensString) {
      authTokensMemory = null;
      await SecureStore.deleteItemAsync(AUTH_TOKENS_KEY);
      return;
    }
    authTokensMemory = tokensString;
    await SecureStore.setItemAsync(AUTH_TOKENS_KEY, tokensString);
  } catch {
    // no-op
  }
}

export async function clearStoredAuthTokens() {
  try {
    authTokensMemory = null;
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
