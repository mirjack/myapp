import * as SecureStore from "expo-secure-store";

const AUTH_TOKENS_KEY = "authTokens";
const PENDING_AUTH_ACTION_KEY = "pendingAuthAction";
const SECURE_STORE_WRITE_OPTIONS = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};
let authTokensMemory = null;
let authTokensRevision = 0;

export function parseAuthTokens(value) {
  if (!value) return null;
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function getStoredAuthTokensSync() {
  return authTokensMemory;
}

export async function getStoredAuthTokens() {
  const revisionAtStart = authTokensRevision;
  try {
    const value = await SecureStore.getItemAsync(AUTH_TOKENS_KEY);
    if (revisionAtStart === authTokensRevision) {
      authTokensMemory = value;
      return value;
    }
    return authTokensMemory;
  } catch {
    return authTokensMemory;
  }
}

export async function setStoredAuthTokens(tokensString) {
  try {
    if (!tokensString) {
      authTokensRevision += 1;
      authTokensMemory = null;
      await SecureStore.deleteItemAsync(AUTH_TOKENS_KEY);
      return;
    }
    authTokensRevision += 1;
    authTokensMemory = tokensString;
    await SecureStore.setItemAsync(
      AUTH_TOKENS_KEY,
      tokensString,
      SECURE_STORE_WRITE_OPTIONS,
    );
  } catch {
    // no-op
  }
}

export async function clearStoredAuthTokens() {
  try {
    authTokensRevision += 1;
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
      SECURE_STORE_WRITE_OPTIONS,
    );
  } catch {
    // no-op
  }
}
