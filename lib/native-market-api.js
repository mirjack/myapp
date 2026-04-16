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

function resolveTenantDomainHeaderValue() {
  const explicit = normalizeTenantDomain(
    process.env.EXPO_PUBLIC_TENANT_DOMAIN ||
      process.env.EXPO_PUBLIC_STOREFRONT_DOMAIN,
  );
  if (explicit) return explicit;

  const webHost = normalizeTenantDomain(WEBVIEW_BASE_URL);
  if (
    webHost &&
    webHost !== "localhost" &&
    webHost !== "127.0.0.1" &&
    webHost !== "0.0.0.0" &&
    !webHost.startsWith("api.")
  ) {
    return webHost;
  }
  return "";
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

function normalizeProductImages(product = {}) {
  const urls = [
    product.image_url ?? product.image,
    ...(Array.isArray(product.images) ? product.images : []).map((entry) =>
      typeof entry === "string" ? entry : entry?.image_url ?? entry?.image,
    ),
    ...(Array.isArray(product.raw?.images) ? product.raw.images : []).map(
      (entry) =>
        typeof entry === "string" ? entry : entry?.image_url ?? entry?.image,
    ),
  ]
    .map(resolveImageUrl)
    .filter(Boolean);

  return Array.from(new Set(urls));
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

function normalizeProductId(productId) {
  const raw = String(productId ?? "");
  return /^[0-9]+$/.test(raw) ? Number(raw) : raw;
}

function authHeaders(accessToken) {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

function baseHeaders({ accessToken, isTenantScoped = true } = {}) {
  const headers = {
    "Content-Type": "application/json",
    "X-Language": "ru",
    ...authHeaders(accessToken),
  };
  const tenantDomain = resolveTenantDomainHeaderValue();
  if (isTenantScoped && tenantDomain) {
    headers[TENANT_HEADER_NAME] = tenantDomain;
  }
  return headers;
}

async function requestJson(path, options = {}) {
  const {
    accessToken,
    headers: incomingHeaders,
    isTenantScoped,
    ...fetchOptions
  } = options;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...fetchOptions,
    headers: {
      ...baseHeaders({
        accessToken,
        isTenantScoped:
          isTenantScoped ??
          (path.startsWith("/api/v1/public/") ||
            path.startsWith("/api/v1/client/")),
      }),
      ...(incomingHeaders || {}),
    },
  });
  if (!response.ok) {
    const error = new Error(`Request failed with ${response.status}`);
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) return null;
  return response.json();
}

export function mapProduct(product = {}) {
  const price = product.price ?? product.list_price ?? "0";
  const images = normalizeProductImages(product);
  const discountedPrice =
    product.discounted_price ??
    product.price_after_discount ??
    product.final_price ??
    product.price ??
    price;
  const numericPrice = parseNumber(price);
  const numericDiscountedPrice = parseNumber(discountedPrice);
  const fallbackPrice = Number.isFinite(numericPrice)
    ? numericPrice
    : numericDiscountedPrice;
  const preferredDiscount = Number.isFinite(numericDiscountedPrice)
    ? numericDiscountedPrice
    : fallbackPrice;
  const finalPrice =
    Number.isFinite(preferredDiscount) && preferredDiscount < fallbackPrice
      ? preferredDiscount
      : fallbackPrice;

  return {
    id: String(product.id ?? product.uuid ?? ""),
    name: product.name ?? "",
    description: product.description ?? "",
    price,
    discount_percent: product.discount_percent ?? "0",
    discounted_price: finalPrice,
    final_price: finalPrice,
    image: images[0] ?? null,
    image_url: images[0] ?? null,
    images,
    raw: product,
  };
}

function mapCartItem(item = {}) {
  return {
    id: item.id,
    quantity: item.quantity,
    product: mapProduct(item.product ?? {}),
  };
}

export async function fetchProductById(productId) {
  const path = `/api/v1/public/catalog/products/${encodeURIComponent(
    String(productId),
  )}/`;
  const data = await requestJson(path);
  if (!data?.id) {
    const error = new Error("Product detail response is empty.");
    error.status = 404;
    throw error;
  }
  return mapProduct(data);
}

export async function getCartItems(accessToken) {
  const data = await requestJson("/api/v1/client/cart/items/", {
    accessToken,
  });
  return {
    items: unwrapResults(data).map(mapCartItem),
    summary: data?.summary ?? data?.cart_summary ?? null,
  };
}

export async function adjustCartItemByProduct(accessToken, productId, delta) {
  const encodedId = encodeURIComponent(String(productId));
  try {
    const data = await requestJson(
      `/api/v1/client/cart/items/by-product/${encodedId}/`,
      {
        method: "PATCH",
        accessToken,
        body: JSON.stringify({ delta }),
      },
    );
    return data ? mapCartItem(data) : null;
  } catch (error) {
    if (error.status !== 404 && error.status !== 405) throw error;
  }

  const { items } = await getCartItems(accessToken);
  const cartItem =
    items.find((item) => String(item?.product?.id) === String(productId)) ||
    null;

  if (!cartItem) {
    if (delta < 0) return null;
    const data = await requestJson("/api/v1/client/cart/items/", {
      method: "POST",
      accessToken,
      body: JSON.stringify({
        product_id: normalizeProductId(productId),
        quantity: Math.max(1, Number(delta) || 1),
      }),
    });
    return data ? mapCartItem(data) : null;
  }

  const nextQuantity = (Number(cartItem.quantity) || 0) + (Number(delta) || 0);
  if (nextQuantity <= 0) {
    await requestJson(`/api/v1/client/cart/items/${cartItem.id}/`, {
      method: "DELETE",
      accessToken,
    });
    return null;
  }

  const data = await requestJson(`/api/v1/client/cart/items/${cartItem.id}/`, {
    method: "PATCH",
    accessToken,
    body: JSON.stringify({ quantity: nextQuantity }),
  });
  return data ? mapCartItem(data) : null;
}

export async function addFavorite(accessToken, productId) {
  const data = await requestJson("/api/v1/favorites/", {
    method: "POST",
    accessToken,
    isTenantScoped: false,
    body: JSON.stringify({ product_id: normalizeProductId(productId) }),
  });
  return data;
}
