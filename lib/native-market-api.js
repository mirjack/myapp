import { TENANT_DOMAIN } from "@/lib/runtime-config";
import i18n from "@/lib/i18n";
import { normalizeLanguageCode } from "@/lib/language";
import { refreshAccessToken } from "@/lib/auth-session";

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

function resolveTenantDomainHeaderValue() {
  const explicit = normalizeTenantDomain(
    process.env.EXPO_PUBLIC_TENANT_DOMAIN ||
      process.env.EXPO_PUBLIC_STOREFRONT_DOMAIN,
  );
  if (explicit && !isInvalidTenantHost(explicit)) return explicit;

  const tenantHost = normalizeTenantDomain(TENANT_DOMAIN);
  if (!isInvalidTenantHost(tenantHost)) {
    return tenantHost;
  }
  return "";
}

function resolveTenantOriginHeaderValue(tenantDomain) {
  const domain = normalizeTenantDomain(tenantDomain);
  if (isInvalidTenantHost(domain)) return "";
  return `https://${domain}`;
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

function resolveLocalizedValue(entity = {}, keys = []) {
  const languageCode = normalizeLanguageCode(
    i18n?.resolvedLanguage ?? i18n?.language ?? "ru",
  );
  const suffixes = [languageCode, "ru", "uz", "en"];

  for (const key of keys) {
    for (const suffix of suffixes) {
      const localizedValue = entity?.[`${key}_${suffix}`];
      if (localizedValue != null && String(localizedValue).trim() !== "") {
        return localizedValue;
      }
    }

    const value = entity?.[key];
    if (value != null && String(value).trim() !== "") {
      return value;
    }
  }

  return "";
}

function unwrapResults(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function mapCategory(category = {}) {
  return {
    id: String(category.id ?? category.uuid ?? ""),
    name: resolveLocalizedValue(category, ["name", "title", "label"]),
    image: resolveImageUrl(
      category.image_url ?? category.image ?? category.preview_image_url,
    ),
    productsCount: Number(category.products_count ?? category.productsCount ?? 0),
    isActive: category.is_active !== false && category.isActive !== false,
    sortOrder: Number(category.sort_order ?? category.sort_ortder ?? 0),
    raw: category,
  };
}

function normalizeProductId(productId) {
  const raw = String(productId ?? "");
  return /^[0-9]+$/.test(raw) ? Number(raw) : raw;
}

function authHeaders(accessToken) {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

function baseHeaders({ accessToken, isTenantScoped = true } = {}) {
  const tenantDomain = resolveTenantDomainHeaderValue();
  const tenantOrigin = resolveTenantOriginHeaderValue(tenantDomain);
  const headers = {
    "Content-Type": "application/json",
    "X-Language": normalizeLanguageCode(i18n?.language ?? "ru"),
    ...authHeaders(accessToken),
  };
  if (isTenantScoped && tenantDomain) {
    headers[TENANT_HEADER_NAME] = tenantDomain;
    if (tenantOrigin) {
      headers.Origin = tenantOrigin;
      headers.Referer = `${tenantOrigin}/`;
    }
  }
  return headers;
}

async function requestJson(path, options = {}) {
  let {
    accessToken,
    headers: incomingHeaders,
    isTenantScoped,
    ...fetchOptions
  } = options;
  const makeRequest = (token) => fetch(`${API_BASE_URL}${path}`, {
    ...fetchOptions,
    headers: {
      ...baseHeaders({
        accessToken: token,
        isTenantScoped:
          isTenantScoped ??
          (path.startsWith("/api/v1/public/") ||
            path.startsWith("/api/v1/client/")),
      }),
      ...(incomingHeaders || {}),
    },
  });
  let response = await makeRequest(accessToken);
  if (response.status === 401 && accessToken) {
    const refreshedAccess = await refreshAccessToken(accessToken);
    if (refreshedAccess) {
      accessToken = refreshedAccess;
      response = await makeRequest(accessToken);
    }
  }
  if (!response.ok) {
    const error = new Error(`Request failed with ${response.status}`);
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) return null;
  return response.json();
}

function mapProduct(product = {}) {
  const price = product.price ?? product.list_price ?? "0";
  const images = normalizeProductImages(product);
  const categoryId =
    product.category_id ??
    product.category?.id ??
    product.category ??
    null;
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
  const availableQuantity = Math.max(
    0,
    Math.floor(
      parseNumber(
        product.available_quantity ??
          product.stock_qty ??
          product.quantity ??
          product.inventory_quantity ??
          0,
      ),
    ),
  );

  return {
    id: String(product.id ?? product.uuid ?? ""),
    name: resolveLocalizedValue(product, [
      "name",
      "title",
      "product_title",
      "product_name",
    ]),
    description: resolveLocalizedValue(product, [
      "description",
      "subtitle",
      "summary",
      "short_description",
    ]),
    price,
    discount_percent: product.discount_percent ?? "0",
    discounted_price: finalPrice,
    final_price: finalPrice,
    category_id:
      categoryId !== undefined && categoryId !== null ? String(categoryId) : null,
    available_quantity: availableQuantity,
    in_stock: product.in_stock ?? availableQuantity > 0,
    image: images[0] ?? null,
    image_url: images[0] ?? null,
    images,
    raw: product,
  };
}

function buildProductQuery({ pageSize = 100, categoryId, search } = {}) {
  const params = new URLSearchParams();
  params.set("page_size", String(pageSize));
  params.set("ordering", "sort_order");
  if (categoryId !== undefined && categoryId !== null && categoryId !== "") {
    params.set("category_id", String(categoryId));
  }
  if (search) params.set("search", String(search).trim());
  return params.toString();
}

export async function fetchProductList(options = {}) {
  const query = buildProductQuery(options);
  const data = await requestJson(`/api/v1/public/catalog/products/?${query}`);
  return unwrapResults(data)
    .map(mapProduct)
    .sort(
      (first, second) =>
        Number(first.raw?.sort_order ?? first.raw?.sort_ortder ?? 0) -
        Number(second.raw?.sort_order ?? second.raw?.sort_ortder ?? 0),
    );
}

export async function getCategories(pageSize = 100) {
  const data = await requestJson(
    `/api/v1/public/catalog/categories/?page_size=${pageSize}&ordering=sort_order`,
  );
  return unwrapResults(data)
    .map(mapCategory)
    .sort((first, second) => first.sortOrder - second.sortOrder);
}

const PRODUCT_API_PATH_PATTERN =
  /\/api\/v\d+\/public\/catalog\/products\/([^/?#]+)\/?$/i;

function normalizeColor(value) {
  if (typeof value !== "string") return "";
  const color = value.trim();
  if (!color) return "";
  if (
    color.startsWith("#") ||
    color.startsWith("rgb") ||
    color.startsWith("hsl")
  ) {
    return color;
  }
  if (/^[0-9a-f]{3}$/i.test(color) || /^[0-9a-f]{6}$/i.test(color)) {
    return `#${color}`;
  }
  return color;
}

function normalizeBannerActionUrl(banner = {}) {
  const linkType = String(
    banner.link_type ?? banner.linkType ?? "",
  ).toLowerCase();
  const rawProductId =
    banner.product_id ??
    banner.productId ??
    banner.product?.id ??
    banner.product?.uuid ??
    null;
  const productId =
    rawProductId != null && String(rawProductId).trim() !== ""
      ? String(rawProductId).trim()
      : null;

  if (linkType === "product" && productId) {
    return `/products/${encodeURIComponent(productId)}`;
  }

  const candidates = [
    banner.url,
    banner.action_url,
    banner.actionUrl,
    banner.link,
    banner.resolved_url,
    banner.resolvedUrl,
  ];

  for (const candidate of candidates) {
    if (candidate == null || String(candidate).trim() === "") continue;
    const value = String(candidate).trim();
    if (value.startsWith("/")) return value;

    const productMatch = value.match(PRODUCT_API_PATH_PATTERN);
    if (productMatch?.[1]) {
      return `/products/${encodeURIComponent(productMatch[1])}`;
    }

    return value;
  }

  return "";
}

function mapBanner(banner = {}) {
  return {
    id: banner.id ?? banner.pk ?? banner.uuid ?? null,
    title: resolveLocalizedValue(banner, ["title", "name", "label"]),
    imageUrl: resolveImageUrl(
      banner.image_url ??
        banner.image ??
        banner.banner_image_url ??
        banner.banner_image ??
        banner.imageUrl,
    ),
    actionUrl: normalizeBannerActionUrl(banner),
    linkType: String(banner.link_type ?? banner.linkType ?? "").toLowerCase(),
  };
}

function mapStory(story = {}) {
  const previewUrl = resolveImageUrl(
    story.previewUrl ??
      story.preview_url ??
      story.preview_image_url ??
      story.preview_image,
  );
  const mediaUrl =
    resolveImageUrl(
      story.mediaUrl ??
        story.media_url ??
        story.background_image_url ??
        story.background_image ??
        story.image,
    ) || previewUrl;

  return {
    id: story.id ?? story.pk ?? story.uuid ?? null,
    title: resolveLocalizedValue(story, ["title", "name", "label"]),
    subTitle: resolveLocalizedValue(story, [
      "subTitle",
      "subtitle",
      "description",
    ]),
    previewUrl,
    mediaUrl,
    mediaName: resolveLocalizedValue(story, [
      "mediaName",
      "media_name",
      "title",
      "name",
    ]),
    isActive: Boolean(story.isActive ?? story.is_active ?? true),
    action: story.action ?? story.button_text ?? "",
    actionUrl: story.actionUrl ?? story.action_url ?? story.link ?? "",
    borderColor: normalizeColor(
      story.borderColor ??
        story.border_color ??
        story.previewBorderColor ??
        story.preview_border_color ??
        story.ringColor ??
        story.ring_color,
    ),
  };
}

export async function fetchMarketingBanners() {
  const data = await requestJson("/api/v1/public/marketing/banners/");
  return unwrapResults(data).map(mapBanner).filter((banner) => banner.imageUrl);
}

export async function fetchStories() {
  const data = await requestJson("/api/v1/public/marketing/stories/");
  return unwrapResults(data).map(mapStory);
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
  try {
    const data = await requestJson(path);
    if (!data?.id) {
      const error = new Error("Product detail response is empty.");
      error.status = 404;
      throw error;
    }
    return mapProduct(data);
  } catch (error) {
    if (error?.status !== 404) throw error;
  }

  const listData = await requestJson(
    "/api/v1/public/catalog/products/?page_size=100&ordering=sort_order",
  );
  const product = unwrapResults(listData).find(
    (entry) => String(entry?.id ?? entry?.uuid ?? "") === String(productId),
  );
  if (!product) {
    const error = new Error("Product not found.");
    error.status = 404;
    throw error;
  }
  return mapProduct(product);
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

export async function removeFavoriteByProduct(accessToken, productId) {
  const encodedId = encodeURIComponent(String(productId));
  try {
    await requestJson(`/api/v1/favorites/by-product/${encodedId}/`, {
      method: "DELETE",
      accessToken,
      isTenantScoped: false,
    });
    return;
  } catch (error) {
    if (error?.status !== 404) throw error;
  }

  const favorites = unwrapResults(
    await requestJson("/api/v1/favorites/", {
      accessToken,
      isTenantScoped: false,
    }),
  );
  const favorite = favorites.find(
    (entry) => String(entry?.product?.id) === String(productId),
  );
  if (!favorite?.id) return;

  await requestJson(
    `/api/v1/favorites/${encodeURIComponent(String(favorite.id))}/`,
    {
      method: "DELETE",
      accessToken,
      isTenantScoped: false,
    },
  );
}

export async function fetchFavorites(accessToken) {
  const data = await requestJson("/api/v1/favorites/", {
    accessToken,
    isTenantScoped: false,
  });
  const favorites = unwrapResults(data);
  return favorites.map((entry) => ({
    ...entry,
    product: mapProduct(entry?.product ?? {}),
  }));
}

export async function createOrder(accessToken, payload) {
  return requestJson("/api/v1/client/orders/", {
    method: "POST",
    accessToken,
    body: JSON.stringify(payload),
  });
}

export async function getPaymentOptions(accessToken) {
  const data = await requestJson("/api/v1/client/payments/options/", {
    accessToken,
  });
  return Array.isArray(data?.options) ? data.options : [];
}

export async function initPaycomPayment(accessToken, payload = {}) {
  return requestJson("/api/v1/client/payments/paycom/init/", {
    method: "POST",
    accessToken,
    body: JSON.stringify(payload),
  });
}
