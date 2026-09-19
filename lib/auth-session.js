import { TENANT_DOMAIN, STOREFRONT_ORIGIN } from "@/lib/runtime-config";
import {
  getStoredAuthTokens,
  setStoredAuthTokens,
  getAuthTokensRevision,
  getAuthSessionVersion,
  clearStoredAuthTokens,
} from "@/lib/auth-storage";

const API_BASE_URL = String(
  process.env.EXPO_PUBLIC_API_BASE_URL ||
    process.env.API_BASE_URL ||
    "https://stg-api.cmfrt.uz",
).replace(/\/$/, "");
const REFRESH_PATHS = [
  process.env.EXPO_PUBLIC_AUTH_REFRESH_PATH,
  "/api/v1/public/auth/refresh/",
  "/api/v1/auth/refresh/",
  "/api/token/refresh/",
].filter(Boolean);

let refreshRequest = null;

function parseTokens(value) {
  if (!value) return null;
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function refreshHeaders() {
  return {
    "Content-Type": "application/json",
    "X-Tenant-Domain": TENANT_DOMAIN,
    Origin: STOREFRONT_ORIGIN,
    Referer: `${STOREFRONT_ORIGIN}/`,
  };
}

export async function refreshAccessToken(previousAccessToken = null) {
  const startingSession = getAuthSessionVersion();
  const stored = parseTokens(await getStoredAuthTokens());
  if (startingSession !== getAuthSessionVersion()) return null;
  const revision = getAuthTokensRevision();
  const session = getAuthSessionVersion();
  if (!stored) return null;
  if (previousAccessToken && stored.access !== previousAccessToken) return stored.access || null;
  if (!stored.refresh) {
    if (previousAccessToken) await clearStoredAuthTokens();
    return null;
  }
  if (refreshRequest?.revision === revision) return refreshRequest.promise;

  const request = { revision, promise: null };
  request.promise = (async () => {
    for (const path of REFRESH_PATHS) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(`${API_BASE_URL}${path}`, {
          method: "POST",
          headers: refreshHeaders(),
          body: JSON.stringify({ refresh: stored.refresh }),
          signal: controller.signal,
        });
        if (response.status === 404 || response.status === 405) continue;
        if (response.status === 401) {
          if (revision === getAuthTokensRevision()) await clearStoredAuthTokens();
          return null;
        }
        if (!response.ok) throw new Error("Session refresh temporarily unavailable");
        const data = await response.json();
        const access = data?.access ?? data?.access_token;
        if (typeof access !== "string" || !access) throw new Error("Invalid session refresh response");
        const committed = await setStoredAuthTokens(JSON.stringify({
          ...stored,
          access,
          refresh: data.refresh ?? data.refresh_token ?? stored.refresh,
        }), revision);
        return committed && session === getAuthSessionVersion() ? access : null;
      } finally {
        clearTimeout(timeout);
      }
    }
    throw new Error("Session refresh endpoint unavailable");
  })();
  refreshRequest = request;
  try { return await request.promise; }
  finally { if (refreshRequest === request) refreshRequest = null; }
}
