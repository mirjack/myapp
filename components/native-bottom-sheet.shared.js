import { Dimensions } from "react-native";

export const WINDOW_SIZE = Dimensions.get("window");
export const SHEET_CLOSED_Y = WINDOW_SIZE.height;
export const SHEET_OPEN_WIDTH = Math.max(100, WINDOW_SIZE.width - 32);
const SHEET_CLOSED_WIDTH = 100;
export const SHEET_CLOSED_SCALE = SHEET_CLOSED_WIDTH / SHEET_OPEN_WIDTH;
export const SHEET_DISMISS_DRAG_Y = 34;
export const SHEET_DISMISS_VELOCITY_Y = 0;
export const PRICE_FILTER_MIN = 0;
export const PRICE_FILTER_MAX = 10000000;
export const PRODUCT_IMAGE_HEIGHT = 358;

export const currencyFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
});

export function parseNumber(value) {
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
}

export function formatCurrency(value) {
  return `${currencyFormatter.format(Math.round(parseNumber(value)))} sum`;
}

export function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function parsePriceInput(value, fallback) {
  const normalized = String(value ?? "").replace(/[^\d]/g, "");
  if (!normalized) return fallback;
  const parsed = Number(normalized);
  return Number.isFinite(parsed)
    ? clampNumber(parsed, PRICE_FILTER_MIN, PRICE_FILTER_MAX)
    : fallback;
}

export function priceToInput(value) {
  return String(
    Math.round(
      clampNumber(Number(value) || 0, PRICE_FILTER_MIN, PRICE_FILTER_MAX),
    ),
  );
}

export function computePriceStats(product) {
  const price = parseNumber(product?.price ?? product?.raw?.price ?? 0);
  const rawFinalPrice =
    product?.final_price ??
    product?.discounted_price ??
    product?.raw?.final_price ??
    product?.raw?.discounted_price;
  const finalPrice =
    rawFinalPrice !== undefined && rawFinalPrice !== null
      ? parseNumber(rawFinalPrice)
      : price;
  const parsedDiscountPercent = parseNumber(
    product?.discount_percent ?? product?.raw?.discount_percent ?? 0,
  );
  const computedDiscountPercent = price
    ? Math.max(0, Math.round(((price - finalPrice) / price) * 100))
    : 0;
  const discountLabel =
    parsedDiscountPercent > 0
      ? Math.max(0, Math.round(parsedDiscountPercent))
      : computedDiscountPercent;
  return {
    price,
    finalPrice,
    discountLabel,
    hasDiscount: price > finalPrice && discountLabel > 0,
  };
}
