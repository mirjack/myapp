import { TENANT_DOMAIN, STOREFRONT_ORIGIN } from "@/lib/runtime-config";
import {
  getStoredAuthTokens,
  setStoredAuthTokens,
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
  if (refreshRequest) return refreshRequest;

  refreshRequest = (async () => {
    const stored = parseTokens(await getStoredAuthTokens());
    if (!stored?.refresh) return null;
    if (previousAccessToken && stored.access !== previousAccessToken) {
      return stored.access || null;
    }

    try {
      let data = null;
      for (const path of REFRESH_PATHS) {
        const response = await fetch(`${API_BASE_URL}${path}`, {
          method: "POST",
          headers: refreshHeaders(),
          body: JSON.stringify({ refresh: stored.refresh }),
        });
        if (!response.ok) continue;
        try {
          data = await response.json();
        } catch {
          data = null;
        }
        if (data?.access || data?.access_token) break;
      }

      const access = data?.access ?? data?.access_token;
      if (!access) return null;

      const nextTokens = {
        ...stored,
        ...data,
        access,
        refresh: data?.refresh ?? stored.refresh,
      };
      await setStoredAuthTokens(JSON.stringify(nextTokens));
      return access;
    } catch {
      return null;
    } finally {
      refreshRequest = null;
    }
  })();

  return refreshRequest;
}
