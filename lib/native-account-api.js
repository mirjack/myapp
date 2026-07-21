import { WEBVIEW_BASE_URL } from "@/lib/runtime-config";
import { getStoredAuthTokens } from "@/lib/auth-storage";
import { getStoredLanguageCode } from "@/lib/app-preferences";
import {
  isNativeProfileCacheFresh,
  readCachedNativeProfile,
  writeCachedNativeProfile,
} from "@/lib/native-profile-cache";

const DEFAULT_API_BASE_URL = "https://stg-api.cmfrt.uz";
const TENANT_HEADER_NAME = "X-Tenant-Domain";
let currentUserProfileRequest = null;

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

function parseTokensString(tokensString) {
  if (!tokensString) return null;
  try {
    return JSON.parse(tokensString);
  } catch {
    return null;
  }
}

async function getAccessToken() {
  const tokensString = await getStoredAuthTokens();
  return parseTokensString(tokensString)?.access || null;
}

function authHeaders(accessToken) {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

async function baseHeaders({ accessToken, isTenantScoped = true } = {}) {
  const languageCode = await getStoredLanguageCode();
  const headers = {
    "Content-Type": "application/json",
    "X-Language": languageCode || "ru",
    ...authHeaders(accessToken),
  };
  const tenantDomain = resolveTenantDomainHeaderValue();
  if (isTenantScoped && tenantDomain) {
    headers[TENANT_HEADER_NAME] = tenantDomain;
  }
  return headers;
}

async function requestJson(path, options = {}) {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    const error = new Error("Authentication required");
    error.status = 401;
    throw error;
  }

  const {
    headers: incomingHeaders,
    isTenantScoped,
    ...fetchOptions
  } = options;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...fetchOptions,
    headers: {
      ...(await baseHeaders({
        accessToken,
        isTenantScoped:
          isTenantScoped ??
          (path.startsWith("/api/v1/public/") ||
            path.startsWith("/api/v1/client/")),
      })),
      ...(incomingHeaders || {}),
    },
  });

  if (!response.ok) {
    const error = new Error(`Request failed with ${response.status}`);
    error.status = response.status;
    try {
      error.data = await response.json();
    } catch {
      error.data = null;
    }
    throw error;
  }

  if (response.status === 204) return null;
  return response.json();
}

function parseNumber(value) {
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
}

function unwrapResults(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function resolveImageUrl(path) {
  if (!path) return null;
  const value = String(path);
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }
  if (value.startsWith("//")) return `https:${value}`;
  const normalized = value.startsWith("/") ? value : `/${value}`;
  return new URL(normalized, API_BASE_URL).toString();
}

function mapOrderItem(item = {}, index = 0) {
  const product = item.product ?? item.product_snapshot ?? item.productSnapshot ?? {};
  const quantityRaw = Number(item.quantity ?? item.qty ?? item.count ?? 1);
  const quantity = Number.isFinite(quantityRaw) && quantityRaw > 0 ? quantityRaw : 1;
  const price =
    item.price ??
    item.unit_price ??
    item.price_at_purchase ??
    item.total_price ??
    product.price ??
    product.unit_price ??
    0;

  const imagePath =
    item.product_image ??
    item.productImage ??
    item.image ??
    item.image_url ??
    product.product_image ??
    product.productImage ??
    product.image ??
    product.thumbnail ??
    product.image_url ??
    null;

  const name =
    item.title ??
    item.name ??
    product.title ??
    product.name ??
    product.product_title ??
    `Item ${index + 1}`;

  const idValue =
    product.id ?? product.uuid ?? item.product_id ?? item.productId ?? item.id ?? `order-item-${index}`;

  return {
    id: String(idValue),
    name,
    image: resolveImageUrl(imagePath),
    quantity,
    price: parseNumber(price),
  };
}

function normalizeAddress(order = {}) {
  if (order.address) return order.address;
  const snapshot = order.address_snapshot ?? order.addressSnapshot;
  if (!snapshot) return "";
  return (
    snapshot.formatted ||
    snapshot.full_address ||
    snapshot.address ||
    snapshot.street ||
    snapshot.title ||
    ""
  );
}

function mapOrder(order = {}) {
  const itemsSource = Array.isArray(order.items)
    ? order.items
    : Array.isArray(order.order_items)
      ? order.order_items
      : Array.isArray(order.order_items_data)
        ? order.order_items_data
        : [];
  const items = itemsSource.map(mapOrderItem).filter(Boolean);
  const idValue = order.id ?? order.uuid ?? null;
  const numberValue =
    order.number ??
    order.order_number ??
    order.external_id ??
    order.reference ??
    (idValue ? `ORDER-${String(idValue).slice(0, 8).toUpperCase()}` : "");

  return {
    id: String(idValue ?? numberValue ?? ""),
    number: String(numberValue ?? ""),
    status: String(order.status ?? "pending").toLowerCase(),
    date: order.created_at ?? order.date ?? order.order_date ?? order.ordered_at ?? null,
    deliveryDate:
      order.delivery_date ??
      order.deliveryDate ??
      order.estimated_delivery_date ??
      order.estimatedDeliveryDate ??
      order.expected_delivery_date ??
      order.delivery_at ??
      null,
    subtotal: parseNumber(order.subtotal ?? order.sub_total ?? order.items_total ?? 0),
    total: parseNumber(order.total ?? order.grand_total ?? order.paid_total ?? 0),
    deliveryFee: parseNumber(order.delivery_fee ?? order.shipping ?? order.shipping_fee ?? 0),
    discount: parseNumber(order.discount ?? order.discount_amount ?? order.total_discount ?? 0),
    address: normalizeAddress(order),
    isPaid: Boolean(order.is_paid ?? order.paid ?? false),
    items,
  };
}

function mapUser(user = {}) {
  return {
    firstName: user.first_name || "",
    lastName: user.last_name || "",
    phoneNumber: user.phone_number || "",
    address: user.address || "",
    city: user.city || "",
  };
}

export async function fetchCurrentUserProfile() {
  if (currentUserProfileRequest) return currentUserProfileRequest;

  const accessToken = await getAccessToken();

  currentUserProfileRequest = (async () => {
    try {
      const data = await requestJson("/api/v1/client/users/user/");
      const mappedUser = mapUser(data);
      await writeCachedNativeProfile(accessToken, mappedUser);
      return mappedUser;
    } catch (primaryError) {
      if (primaryError?.status && primaryError.status !== 404) {
        throw primaryError;
      }
      const fallbackData = await requestJson("/api/v1/public/auth/me/");
      const mappedUser = mapUser(fallbackData);
      await writeCachedNativeProfile(accessToken, mappedUser);
      return mappedUser;
    } finally {
      currentUserProfileRequest = null;
    }
  })();

  return currentUserProfileRequest;
}

export async function prefetchCurrentUserProfile() {
  const accessToken = await getAccessToken();
  if (!accessToken) return null;

  const cached = await readCachedNativeProfile(accessToken);
  if (isNativeProfileCacheFresh(cached)) {
    return cached.profile;
  }

  try {
    return await fetchCurrentUserProfile();
  } catch {
    return cached?.profile || null;
  }
}

export async function saveCurrentUserProfile({
  firstName,
  lastName,
  phoneNumber,
  address,
  city,
}) {
  const payload = {
    first_name: String(firstName || "").trim(),
    last_name: String(lastName || "").trim(),
    phone_number: String(phoneNumber || "").trim(),
    address: String(address || "").trim(),
    city: String(city || "").trim(),
  };
  const data = await requestJson("/api/v1/client/users/user/", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  const mappedUser = mapUser(data);
  const accessToken = await getAccessToken();
  await writeCachedNativeProfile(accessToken, mappedUser);
  return mappedUser;
}

export async function listNativeOrders() {
  const data = await requestJson("/api/v1/client/orders/");
  return unwrapResults(data).map(mapOrder);
}

export async function listNativeAddresses(skipCache = false) {
  const data = await requestJson(`/api/v1/addresses/${skipCache ? "?refresh=1" : ""}`, {
    isTenantScoped: false,
  });
  return unwrapResults(data);
}

export async function createNativeAddress(payload) {
  return requestJson("/api/v1/addresses/", {
    method: "POST",
    body: JSON.stringify(payload),
    isTenantScoped: false,
  });
}

export async function updateNativeAddress(id, payload) {
  return requestJson(`/api/v1/addresses/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
    isTenantScoped: false,
  });
}

export async function deleteNativeAddress(id) {
  return requestJson(`/api/v1/addresses/${id}/`, {
    method: "DELETE",
    isTenantScoped: false,
  });
}

export async function setNativeDefaultAddress(id) {
  return requestJson(`/api/v1/addresses/${id}/`, {
    method: "PATCH",
    body: JSON.stringify({ is_default: true }),
    isTenantScoped: false,
  });
}
