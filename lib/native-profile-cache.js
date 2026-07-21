import * as SecureStore from "expo-secure-store";

const PROFILE_CACHE_PREFIX = "nativeProfileSummary:v1";
export const NATIVE_PROFILE_CACHE_MAX_AGE_MS = 5 * 60 * 1000;
const profileMemoryCache = new Map();

function scopeFromToken(accessToken) {
  if (!accessToken) return null;
  return String(accessToken).slice(-24);
}

function cacheKey(accessToken) {
  const scope = scopeFromToken(accessToken);
  if (!scope) return null;
  return `${PROFILE_CACHE_PREFIX}:${scope}`;
}

export async function readCachedNativeProfile(accessToken) {
  const key = cacheKey(accessToken);
  if (!key) return null;

  const memoryValue = profileMemoryCache.get(key);
  if (memoryValue) return memoryValue;

  try {
    const raw = await SecureStore.getItemAsync(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.profile || typeof parsed.cachedAt !== "number") return null;
    profileMemoryCache.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function readCachedNativeProfileSync(accessToken) {
  const key = cacheKey(accessToken);
  if (!key) return null;
  return profileMemoryCache.get(key) || null;
}

export function isNativeProfileCacheFresh(
  cachedValue,
  maxAgeMs = NATIVE_PROFILE_CACHE_MAX_AGE_MS,
) {
  if (!cachedValue?.profile || typeof cachedValue.cachedAt !== "number") {
    return false;
  }
  return Date.now() - cachedValue.cachedAt <= maxAgeMs;
}

export async function writeCachedNativeProfile(accessToken, profile) {
  const key = cacheKey(accessToken);
  if (!key || !profile) return;

  const normalizedProfile = {
    firstName: profile.firstName || "",
    lastName: profile.lastName || "",
    phoneNumber: profile.phoneNumber || "",
    address: profile.address || "",
    city: profile.city || "",
  };

  try {
    const nextValue = {
      profile: normalizedProfile,
      cachedAt: Date.now(),
    };
    profileMemoryCache.set(key, nextValue);
    await SecureStore.setItemAsync(
      key,
      JSON.stringify(nextValue),
    );
  } catch {
    // no-op
  }
}

export async function clearCachedNativeProfile(accessToken) {
  const key = cacheKey(accessToken);
  if (!key) return;

  try {
    profileMemoryCache.delete(key);
    await SecureStore.deleteItemAsync(key);
  } catch {
    // no-op
  }
}
