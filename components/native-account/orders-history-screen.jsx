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
import { useTranslation } from "react-i18next";
import { useLocalSearchParams, useRouter, useSegments } from "expo-router";

import { listNativeOrders } from "@/lib/native-account-api";

import { NativeAccountScreenShell } from "./account-screen-shell";
import { nativeAccountStyles as styles } from "./native-account.styles";
import {
  formatOrderDate,
  formatOrderItemsLabel,
  formatOrderMoney,
} from "./order-formatters";
import { getOrderStatusMeta } from "./order-status";
import {
  setCurrentWebPath,
  setTabBarForcedHidden,
} from "@/lib/tab-bar-visibility";

const ACTIVE_STATUSES = new Set(["pending", "processing", "shipped"]);
function toTimestamp(value) {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function filterOrders(orders, tab) {
  if (tab === "active") {
    return orders.filter((order) =>
      ACTIVE_STATUSES.has(String(order.status || "").toLowerCase()),
    );
  }
  return orders;
}

export function OrdersHistoryScreen() {
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams();
  const router = useRouter();
  const segments = useSegments();
  const initialTab = params?.tab === "all" ? "all" : "active";
  const [tab, setTab] = useState(initialTab);
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadOrders = useCallback(async ({ silent = false } = {}) => {
    if (silent) setIsRefreshing(true);
    else setIsLoading(true);
    setError("");

    try {
      const nextOrders = await listNativeOrders();
      setOrders(nextOrders);
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
  }, [t]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const sortedOrders = useMemo(
    () =>
      [...orders].sort(
        (left, right) => toTimestamp(right.date) - toTimestamp(left.date),
      ),
    [orders],
  );

  const filteredOrders = useMemo(
    () => filterOrders(sortedOrders, tab),
    [sortedOrders, tab],
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

  const openOrder = (order) => {
    if (!order?.id) return;
    const isProfileStackRoute =
      segments[0] === "(tabs)" && segments[1] === "profile";
    router.push({
      pathname: isProfileStackRoute
        ? "/(tabs)/profile/orders/[id]"
        : "/account/orders/[id]",
      params: { id: order.id },
    });
  };

  return (
    <NativeAccountScreenShell
      forceBackToProfile={false}
      title={t("ordersHistory.title")}
    >
      {isLoading ? (
        <View style={styles.centeredState}>
          <ActivityIndicator color="#FE946E" size="small" />
          <Text style={styles.stateText}>{t("ordersHistory.loading")}</Text>
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={[styles.content, styles.ordersScreenContent]}
            refreshControl={
              <RefreshControl
                onRefresh={() => loadOrders({ silent: true })}
                refreshing={isRefreshing}
                tintColor="#FE946E"
              />
            }
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.segmented}>
              {["active", "all"].map((key) => {
                const isActive = key === tab;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setTab(key)}
                    style={[
                      styles.segmentedButton,
                      isActive && styles.segmentedButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentedButtonText,
                        isActive && styles.segmentedButtonTextActive,
                      ]}
                    >
                      {key === "active"
                        ? t("ordersHistory.tabs.active")
                        : t("ordersHistory.tabs.all")}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {error ? (
              <Text style={[styles.errorText, styles.ordersError]}>{error}</Text>
            ) : null}

            <View style={styles.listGap}>
              {filteredOrders.length === 0 ? (
                <View style={styles.card}>
                  <Text style={styles.stateText}>
                    {tab === "active"
                      ? t("ordersHistory.empty.active")
                      : t("ordersHistory.empty.all")}
                  </Text>
                </View>
              ) : (
                filteredOrders.map((order) => {
                  const statusMeta = getOrderStatusMeta(order.status, t);
                  const itemPreview = Array.isArray(order.items)
                    ? order.items.slice(0, 2)
                    : [];
                  const remainingItems = Math.max(
                    (order.items?.length || 0) - itemPreview.length,
                    0,
                  );

                  return (
                    <Pressable
                      key={order.id}
                      onPress={() => openOrder(order)}
                      style={({ pressed }) => [
                        styles.orderCard,
                        pressed ? styles.orderCardPressed : null,
                      ]}
                    >
                      <Text style={styles.orderNumber}>
                        {t("ordersHistory.orderNumber", {
                          number: order.number || order.id,
                        })}
                      </Text>

                      <View
                        style={[styles.orderStatusBadge, statusMeta.badgeStyle]}
                      >
                        <Text
                          style={[styles.orderStatusText, statusMeta.textStyle]}
                        >
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
                              ? formatOrderDate(order.deliveryDate, i18n.language)
                              : t("ordersHistory.notSpecified")}
                          </Text>
                        </View>

                        <View style={styles.orderInfoSection}>
                          <Text style={styles.orderSectionLabel}>
                            {t("ordersHistory.deliveryAddress")}
                          </Text>
                          <Text style={styles.orderSectionValue}>
                            {order.address ||
                              t("ordersHistory.addressNotSpecified")}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.orderTotals}>
                        <View style={styles.orderTotalsRow}>
                          <Text style={styles.mutedText}>
                            {formatOrderItemsLabel(order.items?.length || 0, t)}
                          </Text>
                          <Text style={styles.orderTotalsValue}>
                            {formatOrderMoney(order.subtotal || order.total)}{" "}
                            {t("ordersHistory.currency")}
                          </Text>
                        </View>

                        <View style={styles.orderTotalsRow}>
                          <Text style={styles.mutedText}>
                            {t("ordersHistory.deliveryFee")}
                          </Text>
                          <Text style={styles.orderTotalsValue}>
                            {order.deliveryFee
                              ? `${formatOrderMoney(order.deliveryFee)} ${t("ordersHistory.currency")}`
                              : t("ordersHistory.free")}
                          </Text>
                        </View>

                        <View style={styles.orderTotalsRow}>
                          <Text style={styles.orderTotalLabel}>
                            {t("ordersHistory.total")}
                          </Text>
                          <Text style={styles.orderTotalValue}>
                            {formatOrderMoney(order.total)} {t("ordersHistory.currency")}
                          </Text>
                        </View>
                      </View>

                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.previewItemsRow}
                        style={styles.previewScroller}
                      >
                        {itemPreview.length === 0 ? (
                          <View style={styles.previewFallback} />
                        ) : null}

                        {itemPreview.map((item, index) => (
                          <Pressable
                            key={`${order.id}-${item.id ?? index}`}
                            onPress={(event) => {
                              event.stopPropagation();
                              openProduct(item);
                            }}
                            style={styles.previewPressable}
                          >
                            <View style={styles.previewImageWrap}>
                              {item.image ? (
                                <Image
                                  resizeMode="cover"
                                  source={{ uri: item.image }}
                                  style={styles.previewImage}
                                />
                              ) : (
                                <View style={styles.previewFallback} />
                              )}

                              {item.quantity > 1 ? (
                                <View style={styles.previewQty}>
                                  <Text style={styles.previewQtyText}>
                                    x{item.quantity}
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                          </Pressable>
                        ))}

                        {remainingItems > 0 ? (
                          <View style={styles.previewMore}>
                            <Text style={styles.previewMoreText}>
                              +{remainingItems}
                            </Text>
                          </View>
                        ) : null}
                      </ScrollView>
                    </Pressable>
                  );
                })
              )}
            </View>
          </ScrollView>
        </>
      )}
    </NativeAccountScreenShell>
  );
}
