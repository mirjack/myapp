import { getStoredAuthTokens } from "@/lib/auth-storage";
import {
  normalizeMessageEntity,
  normalizeChatEntity,
  normalizeRequestEntity,
} from "@/lib/support-chat-state";
import { WEBVIEW_BASE_URL } from "@/lib/runtime-config";

const DEFAULT_API_BASE_URL = "https://stg-api.cmfrt.uz";
const TENANT_HEADER_NAME = "X-Tenant-Domain";

const API_BASE_URL = String(
  process.env.EXPO_PUBLIC_API_BASE_URL ||
    process.env.API_BASE_URL ||
    DEFAULT_API_BASE_URL,
).replace(/\/$/, "");

function normalizeTenantDomain(rawValue) {
  const trimmed = String(rawValue || "").trim();
  if (!trimmed) return "";

  try {
    return new URL(trimmed).hostname.toLowerCase();
  } catch {
    return trimmed
      .replace(/^https?:\/\//i, "")
      .replace(/\/.*$/, "")
      .replace(/:\d+$/, "")
      .toLowerCase();
  }
}

function isInvalidTenantHost(host) {
  return (
    !host ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    /^(\d{1,3}\.){3}\d{1,3}$/.test(host) ||
    !/[a-z]/i.test(host) ||
    host.startsWith("api.")
  );
}

function buildStorefrontOrigin(host) {
  if (isInvalidTenantHost(host)) return "";
  return `https://${host}`;
}

function resolveTenantDomainHeaderValue() {
  const explicit = normalizeTenantDomain(
    process.env.EXPO_PUBLIC_TENANT_DOMAIN ||
      process.env.EXPO_PUBLIC_STOREFRONT_DOMAIN,
  );
  if (explicit && !isInvalidTenantHost(explicit)) return explicit;

  const webHost = normalizeTenantDomain(WEBVIEW_BASE_URL);
  if (!isInvalidTenantHost(webHost)) {
    return webHost;
  }

  return "";
}

export function resolveSupportRequestContext() {
  const tenantDomain = resolveTenantDomainHeaderValue();
  const origin =
    buildStorefrontOrigin(
      normalizeTenantDomain(
        process.env.EXPO_PUBLIC_STOREFRONT_DOMAIN ||
          process.env.EXPO_PUBLIC_TENANT_DOMAIN,
      ),
    ) || "";

  const fallbackOrigin = buildStorefrontOrigin(tenantDomain);
  const resolvedOrigin = origin || fallbackOrigin;

  return {
    tenantDomain,
    origin: resolvedOrigin,
    referer: resolvedOrigin ? `${resolvedOrigin}/` : "",
  };
}

function normalizeSupportPrefix(rawPrefix) {
  if (rawPrefix === undefined) return "/support";

  const trimmed = String(rawPrefix).trim();
  if (!trimmed) return "";

  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeadingSlash.replace(/\/$/, "");
}

const explicitSupportBaseUrl = String(
  process.env.EXPO_PUBLIC_SUPPORT_BASE_URL || "",
).trim();
const supportPrefix = normalizeSupportPrefix(
  process.env.EXPO_PUBLIC_SUPPORT_API_PREFIX,
);

function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}

function resolveSupportBaseUrl() {
  return explicitSupportBaseUrl || API_BASE_URL;
}

export function resolveSupportUrl(path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (explicitSupportBaseUrl) {
    return new URL(
      normalizedPath.slice(1),
      ensureTrailingSlash(resolveSupportBaseUrl()),
    ).toString();
  }

  return new URL(
    `${supportPrefix}${normalizedPath}`,
    resolveSupportBaseUrl(),
  ).toString();
}

export function resolveSupportTransport() {
  return String(process.env.EXPO_PUBLIC_SUPPORT_WS_TRANSPORT || "http")
    .trim()
    .toLowerCase();
}

async function getAccessToken() {
  const tokensString = await getStoredAuthTokens();
  if (!tokensString) return null;

  try {
    return JSON.parse(tokensString)?.access ?? null;
  } catch {
    return null;
  }
}

async function buildHeaders() {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new Error("Support requires a customer access token");
  }

  const headers = {
    "Content-Type": "application/json",
    "X-Language": "ru",
    Authorization: `Bearer ${accessToken}`,
  };

  const { tenantDomain, origin, referer } = resolveSupportRequestContext();
  if (tenantDomain) {
    headers[TENANT_HEADER_NAME] = tenantDomain;
  }
  if (origin) {
    headers.Origin = origin;
  }
  if (referer) {
    headers.Referer = referer;
  }

  return headers;
}

async function parseResponseError(response) {
  try {
    const data = await response.json();
    if (typeof data?.message === "string" && data.message.trim()) {
      return data.message;
    }
    if (typeof data?.error === "string" && data.error.trim()) {
      return data.error;
    }
    if (typeof data?.detail === "string" && data.detail.trim()) {
      return data.detail;
    }
  } catch {
    // ignore parse error
  }

  return `Support request failed with ${response.status}`;
}

async function requestJson(path, options = {}) {
  const response = await fetch(resolveSupportUrl(path), {
    ...options,
    headers: {
      ...(await buildHeaders()),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(await parseResponseError(response));
  }

  if (response.status === 204) return null;
  return response.json();
}

export async function closeSupportRequest({ requestId, resolved }) {
  const data = await requestJson(
    `/api/v1/customer-support/requests/${requestId}/close`,
    {
      method: "POST",
      body: JSON.stringify({ resolved }),
    },
  );
  return normalizeRequestEntity(data);
}

export async function rateSupportRequest({ requestId, rating, text }) {
  const data = await requestJson(
    `/api/v1/customer-support/requests/${requestId}/rate`,
    {
      method: "POST",
      body: JSON.stringify({
        rating,
        text: text ?? null,
      }),
    },
  );
  return normalizeRequestEntity(data);
}

export async function bootstrapSupportChatHttp() {
  const data = await requestJson("/api/v1/customer-support/bootstrap");
  return {
    ...data,
    chat: normalizeChatEntity(data?.chat),
    requestTypes: Array.isArray(data?.requestTypes) ? data.requestTypes : [],
    problemTypes: Array.isArray(data?.problemTypes) ? data.problemTypes : [],
    activeRequestId: data?.activeRequestId ?? null,
  };
}

export async function createSupportRequestHttp({
  requestType,
  problemTypeId,
  text,
}) {
  const data = await requestJson("/api/v1/customer-support/requests", {
    method: "POST",
    body: JSON.stringify({
      requestType,
      problemTypeId: problemTypeId ?? null,
      text,
    }),
  });
  return normalizeRequestEntity(data);
}

export async function sendSupportMessageHttp({ requestId, text }) {
  const data = await requestJson("/api/v1/customer-support/messages", {
    method: "POST",
    body: JSON.stringify({
      requestId: requestId ?? null,
      text,
    }),
  });
  return normalizeMessageEntity(data);
}
