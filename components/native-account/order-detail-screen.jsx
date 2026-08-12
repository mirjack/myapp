import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { fetchNativeOrder } from "@/lib/native-account-api";
import {
  setCurrentWebPath,
  setTabBarForcedHidden,
} from "@/lib/tab-bar-visibility";

import { NativeAccountScreenShell } from "./account-screen-shell";
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

function formatDate(value, language) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const localeMap = {
    en: "en-US",
    ru: "ru-RU",
    uz: "uz-UZ",
  };

  return new Intl.DateTimeFormat(localeMap[language] || "ru-RU", {
    day: "numeric",
    month: "long",
    weekday: "long",
  }).format(date);
}

function formatMoney(value) {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function getStatusMeta(status, t) {
  const value = String(status || "pending").toLowerCase();
  const fallback = STATUS_META[value] || STATUS_META.pending;

  return {
    ...fallback,
    label: t(`ordersHistory.statuses.${value}`, fallback.label),
  };
}

function formatItemsLabel(count, t) {
  return t("ordersHistory.itemsCount", { count: Number(count) || 0 });
}

export function OrderDetailScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams();
  const orderId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadOrder = useCallback(async ({ silent = false } = {}) => {
    if (!orderId) {
      setError(t("ordersHistory.loadError"));
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    if (silent) setIsRefreshing(true);
    else setIsLoading(true);
    setError("");

    try {
      const nextOrder = await fetchNativeOrder(orderId);
      setOrder(nextOrder);
    } catch (loadError) {
      setError(
        loadError?.status === 401
          ? t("ordersHistory.loadErrorAuth")
          : t("ordersHistory.loadError"),
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [orderId, t]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  const statusMeta = useMemo(
    () => getStatusMeta(order?.status, t),
    [order?.status, t],
  );

  const openProduct = (item) => {
    const productId = item?.id;
    if (!productId) return;
    setCurrentWebPath(`/products/${productId}`);
    setTabBarForcedHidden(true);
    router.push({
      pathname: "/product",
      params: { productPath: `/products/${productId}` },
    });
  };

  return (
    <NativeAccountScreenShell
      forceBackToProfile={false}
      title={
        order?.number
          ? t("ordersHistory.orderNumber", { number: order.number })
          : t("ordersHistory.title")
      }
    >
      {isLoading ? (
        <View style={styles.centeredState}>
          <ActivityIndicator color="#FE946E" size="small" />
          <Text style={styles.stateText}>{t("ordersHistory.loading")}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, styles.orderDetailContent]}
          refreshControl={
            <RefreshControl
              onRefresh={() => loadOrder({ silent: true })}
              refreshing={isRefreshing}
              tintColor="#FE946E"
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {error ? (
            <Text style={[styles.errorText, styles.ordersError]}>{error}</Text>
          ) : null}

          {order ? (
            <>
              <View style={styles.orderCard}>
                <Text style={styles.orderNumber}>
                  {t("ordersHistory.orderNumber", {
                    number: order.number || order.id,
                  })}
                </Text>

                <View style={[styles.orderStatusBadge, statusMeta.badgeStyle]}>
                  <Text style={[styles.orderStatusText, statusMeta.textStyle]}>
                    {statusMeta.label}
                  </Text>
                </View>

                <View style={styles.orderInfoList}>
                  <View style={styles.orderInfoSection}>
                    <Text style={styles.orderSectionLabel}>
                      {t("ordersHistory.deliveryDate")}
                    </Text>
                    <Text style={styles.orderSectionValue}>
                      {order.deliveryDate
                        ? formatDate(order.deliveryDate, i18n.language)
                        : t("ordersHistory.notSpecified")}
                    </Text>
                  </View>

                  <View style={styles.orderInfoSection}>
                    <Text style={styles.orderSectionLabel}>
                      {t("ordersHistory.deliveryAddress")}
                    </Text>
                    <Text style={styles.orderSectionValue}>
                      {order.address || t("ordersHistory.addressNotSpecified")}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.orderCard}>
                <Text style={styles.orderDetailSectionTitle}>
                  {formatItemsLabel(order.items?.length || 0, t)}
                </Text>

                <View style={styles.orderItemsList}>
                  {(order.items || []).map((item, index) => {
                    const itemTotal = Number(item.price || 0) * Number(item.quantity || 1);
                    return (
                      <Pressable
                        key={`${item.id ?? "item"}-${index}`}
                        onPress={() => openProduct(item)}
                        style={({ pressed }) => [
                          styles.orderDetailItem,
                          index > 0 ? styles.orderDetailItemBorder : null,
                          pressed ? styles.orderDetailItemPressed : null,
                        ]}
                      >
                        <View style={styles.orderDetailImageWrap}>
                          {item.image ? (
                            <Image
                              resizeMode="cover"
                              source={{ uri: item.image }}
                              style={styles.orderDetailImage}
                            />
                          ) : (
                            <View style={styles.orderDetailImageFallback}>
                              <Ionicons color="#B8B8BE" name="image-outline" size={22} />
                            </View>
                          )}
                        </View>

                        <View style={styles.orderDetailItemBody}>
                          <Text numberOfLines={2} style={styles.orderDetailItemName}>
                            {item.name}
                          </Text>
                          <Text style={styles.orderDetailItemMeta}>
                            {formatMoney(item.price)} {t("ordersHistory.currency")} x {item.quantity}
                          </Text>
                        </View>

                        <View style={styles.orderDetailItemSide}>
                          <Text style={styles.orderDetailItemTotal}>
                            {formatMoney(itemTotal)} {t("ordersHistory.currency")}
                          </Text>
                          <Ionicons color="#7C7C7C" name="chevron-forward" size={16} />
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.orderCard}>
                <View style={styles.orderTotals}>
                  <View style={styles.orderTotalsRow}>
                    <Text style={styles.mutedText}>
                      {formatItemsLabel(order.items?.length || 0, t)}
                    </Text>
                    <Text style={styles.orderTotalsValue}>
                      {formatMoney(order.subtotal || order.total)}{" "}
                      {t("ordersHistory.currency")}
                    </Text>
                  </View>

                  {order.discount ? (
                    <View style={styles.orderTotalsRow}>
                      <Text style={styles.mutedText}>
                        {t("orderDetail.discount", "Discount")}
                      </Text>
                      <Text style={styles.orderTotalsValue}>
                        -{formatMoney(order.discount)} {t("ordersHistory.currency")}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.orderTotalsRow}>
                    <Text style={styles.mutedText}>
                      {t("ordersHistory.deliveryFee")}
                    </Text>
                    <Text style={styles.orderTotalsValue}>
                      {order.deliveryFee
                        ? `${formatMoney(order.deliveryFee)} ${t("ordersHistory.currency")}`
                        : t("ordersHistory.free")}
                    </Text>
                  </View>

                  <View style={styles.orderDetailTotalDivider} />

                  <View style={styles.orderTotalsRow}>
                    <Text style={styles.orderTotalLabel}>
                      {t("ordersHistory.total")}
                    </Text>
                    <Text style={styles.orderTotalValue}>
                      {formatMoney(order.total)} {t("ordersHistory.currency")}
                    </Text>
                  </View>
                </View>
              </View>
            </>
          ) : null}
        </ScrollView>
      )}
    </NativeAccountScreenShell>
  );
}
