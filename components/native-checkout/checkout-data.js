import checkoutContent from "@/components/native-checkout/checkout-content.json";

const currencyFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
});

export const PAYMENT_METHODS = checkoutContent.paymentMethods;

export function parseNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function formatCurrency(value, suffix = " сум") {
  return `${currencyFormatter.format(Math.round(parseNumber(value)))}${suffix}`;
}

export function sanitizeBonusInput(value) {
  return String(value ?? "").replace(/[^\d]/g, "");
}

export function getColorLabel(product) {
  return (
    product?.color_name ||
    product?.color?.name ||
    product?.raw?.color_name ||
    product?.raw?.color?.name ||
    product?.raw?.variant?.color?.name ||
    product?.raw?.shade ||
    product?.raw?.variant_name ||
    "Не указан"
  );
}

export function getColorHex(product) {
  return (
    product?.color_hex ||
    product?.color?.hex ||
    product?.raw?.color_hex ||
    product?.raw?.color?.hex ||
    product?.raw?.variant?.color?.hex ||
    "#D7FF00"
  );
}

export function getItemUnitFinalPrice(item) {
  return parseNumber(
    item?.product?.final_price ??
      item?.product?.discounted_price ??
      item?.product?.price ??
      0,
  );
}
