import * as SecureStore from "expo-secure-store";

const LOYALTY_CACHE_PREFIX = "nativeLoyaltyProfile:v1";
const SECURE_STORE_WRITE_OPTIONS = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};
const loyaltyMemoryCache = new Map();

function scopeFromToken(accessToken) {
  if (!accessToken) return null;
  return String(accessToken).slice(-24);
}

function cacheKey(accessToken) {
  const scope = scopeFromToken(accessToken);
  if (!scope) return null;
  return `${LOYALTY_CACHE_PREFIX}:${scope}`;
}

export async function readCachedNativeLoyaltyProfile(accessToken) {
  const key = cacheKey(accessToken);
  if (!key) return null;

  const memoryValue = loyaltyMemoryCache.get(key);
  if (memoryValue) return memoryValue;

  try {
    const raw = await SecureStore.getItemAsync(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.profile || typeof parsed.cachedAt !== "number") return null;
    loyaltyMemoryCache.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function readCachedNativeLoyaltyProfileSync(accessToken) {
  const key = cacheKey(accessToken);
  if (!key) return null;
  return loyaltyMemoryCache.get(key) || null;
}

export async function writeCachedNativeLoyaltyProfile(accessToken, profile) {
  const key = cacheKey(accessToken);
  if (!key || !profile) return;

  try {
    const nextValue = {
      profile,
      cachedAt: Date.now(),
    };
    loyaltyMemoryCache.set(key, nextValue);
    await SecureStore.setItemAsync(
      key,
      JSON.stringify(nextValue),
      SECURE_STORE_WRITE_OPTIONS,
    );
  } catch {
    // no-op
  }
}
