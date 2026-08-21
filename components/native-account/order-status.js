import { nativeAccountStyles as styles } from "./native-account.styles";

const STATUS_META = {
  pending: {
    label: "Pending",
    badgeStyle: styles.orderStatusBadgeWarning,
    textStyle: styles.orderStatusTextWarning,
  },
  confirmed: {
    label: "Confirmed",
    badgeStyle: styles.orderStatusBadgeInfo,
    textStyle: styles.orderStatusTextInfo,
  },
  processing: {
    label: "Processing",
    badgeStyle: styles.orderStatusBadgeWarning,
    textStyle: styles.orderStatusTextWarning,
  },
  shipped: {
    label: "Shipped",
    badgeStyle: styles.orderStatusBadgeSuccess,
    textStyle: styles.orderStatusTextSuccess,
  },
  delivered: {
    label: "Delivered",
    badgeStyle: styles.orderStatusBadgeNeutral,
    textStyle: styles.orderStatusTextNeutral,
  },
  completed: {
    label: "Delivered",
    badgeStyle: styles.orderStatusBadgeNeutral,
    textStyle: styles.orderStatusTextNeutral,
  },
  cancelled: {
    label: "Cancelled",
    badgeStyle: styles.orderStatusBadgeDanger,
    textStyle: styles.orderStatusTextDanger,
  },
};

export function getOrderStatusMeta(status, t) {
  const value = String(status || "pending").toLowerCase();
  const fallback = STATUS_META[value] || STATUS_META.pending;

  return {
    ...fallback,
    label: t(`ordersHistory.statuses.${value}`, fallback.label),
  };
}
