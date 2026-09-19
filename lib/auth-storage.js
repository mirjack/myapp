import * as SecureStore from "expo-secure-store";

const AUTH_TOKENS_KEY = "authTokens";
const PENDING_AUTH_ACTION_KEY = "pendingAuthAction";
const SECURE_STORE_WRITE_OPTIONS = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};
let authTokensMemory = null;
let authTokensRevision = 0;
let authSessionVersion = 0;
let initialized = false;
let hydration = null;
let writes = Promise.resolve();
const listeners = new Set();

export function parseAuthTokens(value) {
  if (!value) return null;
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const access = parsed.access ?? parsed.access_token;
    if (typeof access !== "string" || !access.trim()) return null;
    return { ...parsed, access, refresh: parsed.refresh ?? parsed.refresh_token ?? null };
  } catch {
    return null;
  }
}

export function getAuthSessionVersion() { return authSessionVersion; }
export function getAuthTokensRevision() { return authTokensRevision; }
export function subscribeAuthTokens(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function emit() {
  listeners.forEach((listener) => {
    try { listener(); } catch { /* Observers must not roll back a persisted session. */ }
  });
}
export function getStoredAuthTokensSync() { return authTokensMemory; }

export async function getStoredAuthTokens() {
  await writes;
  if (initialized) return authTokensMemory;
  if (!hydration) {
    const revision = authTokensRevision;
    hydration = SecureStore.getItemAsync(AUTH_TOKENS_KEY).then((value) => {
      if (revision === authTokensRevision) {
        authTokensMemory = parseAuthTokens(value) ? value : null;
        initialized = true;
        emit();
      }
      return authTokensMemory;
    }).finally(() => { hydration = null; });
  }
  return hydration;
}

// Serialize disk mutations. Refresh may only commit to the session it started in.
export async function setStoredAuthTokens(value, expectedRevision) {
  if (expectedRevision !== undefined && expectedRevision !== authTokensRevision) return false;
  const tokens = value ? parseAuthTokens(value) : null;
  if (value && !tokens) throw new Error("Invalid authentication tokens");
  const previous = authTokensMemory;
  const revision = ++authTokensRevision;
  if (expectedRevision === undefined) authSessionVersion += 1;
  const next = tokens ? JSON.stringify(tokens) : null;
  // Invalidate outstanding work immediately on logout.
  if (!next) { authTokensMemory = null; initialized = true; emit(); }
  const operation = writes.then(async () => {
    if (next) {
      await SecureStore.setItemAsync(AUTH_TOKENS_KEY, next, SECURE_STORE_WRITE_OPTIONS);
    } else {
      await SecureStore.deleteItemAsync(AUTH_TOKENS_KEY);
    }
    if (revision === authTokensRevision) {
      authTokensMemory = next;
      initialized = true;
      emit();
    }
    return revision === authTokensRevision;
  });
  writes = operation.catch(() => {});
  try { return await operation; }
  catch (error) {
    if (revision === authTokensRevision) { authTokensMemory = previous; emit(); }
    throw error;
  }
}

export function clearStoredAuthTokens() {
  return setStoredAuthTokens(null);
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
