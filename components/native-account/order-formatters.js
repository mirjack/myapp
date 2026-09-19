const ORDER_DATE_LOCALES = {
  en: "en-US",
  ru: "ru-RU",
  uz: "uz-UZ",
};

export function formatOrderDate(value, language) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat(
    ORDER_DATE_LOCALES[language] || "ru-RU",
    {
      day: "numeric",
      month: "long",
      weekday: "long",
    },
  ).format(date);
}

export function formatOrderMoney(value) {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

export function formatOrderItemsLabel(count, t) {
  return t("ordersHistory.itemsCount", { count: Number(count) || 0 });
}
