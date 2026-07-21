import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { NativeBottomSheet } from "@/components/native-bottom-sheet";
import { getStoredAuthTokens } from "@/lib/auth-storage";
import { listNativeOrders } from "@/lib/native-account-api";
import {
  adjustCartItemByProduct,
  fetchProductById,
  getCartItems,
  mapProduct,
} from "@/lib/native-market-api";

import { NativeAccountScreenShell } from "./account-screen-shell";
import { nativeAccountStyles as styles } from "./native-account.styles";

const ACTIVE_STATUSES = new Set(["pending", "confirmed", "processing", "shipped"]);
const STATUS_META = {
  pending: {
    label: "Оформляется",
    badgeStyle: styles.orderStatusBadgeWarning,
    textStyle: styles.orderStatusTextWarning,
  },
  confirmed: {
    label: "Подтвержден",
    badgeStyle: styles.orderStatusBadgeInfo,
    textStyle: styles.orderStatusTextInfo,
  },
  processing: {
    label: "Собирается",
    badgeStyle: styles.orderStatusBadgeWarning,
    textStyle: styles.orderStatusTextWarning,
  },
  shipped: {
    label: "Доставляется",
    badgeStyle: styles.orderStatusBadgeSuccess,
    textStyle: styles.orderStatusTextSuccess,
  },
  delivered: {
    label: "Выдано покупателю",
    badgeStyle: styles.orderStatusBadgeNeutral,
    textStyle: styles.orderStatusTextNeutral,
  },
  completed: {
    label: "Выдано покупателю",
    badgeStyle: styles.orderStatusBadgeNeutral,
    textStyle: styles.orderStatusTextNeutral,
  },
  cancelled: {
    label: "Отменен",
    badgeStyle: styles.orderStatusBadgeDanger,
    textStyle: styles.orderStatusTextDanger,
  },
};

function parseTokensString(tokensString) {
  if (!tokensString) return null;
  try {
    return JSON.parse(tokensString);
  } catch {
    return null;
  }
}

function toTimestamp(value) {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatDate(value) {
  if (!value) return "Не указана";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Не указана";
  return new Intl.DateTimeFormat("ru-RU", {
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

function filterOrders(orders, tab) {
  if (tab === "active") {
    return orders.filter((order) =>
      ACTIVE_STATUSES.has(String(order.status || "").toLowerCase()),
    );
  }
  return orders;
}

function getStatusMeta(status) {
  const value = String(status || "pending").toLowerCase();
  return STATUS_META[value] || STATUS_META.pending;
}

function formatItemsLabel(count) {
  const total = Number(count) || 0;
  if (total % 10 === 1 && total % 100 !== 11) return `${total} товар`;
  if ([2, 3, 4].includes(total % 10) && ![12, 13, 14].includes(total % 100)) {
    return `${total} товара`;
  }
  return `${total} товаров`;
}

function toSheetProduct(item) {
  return mapProduct({
    id: item?.id,
    name: item?.name || "Товар",
    price: item?.price ?? 0,
    image: item?.image || null,
    image_url: item?.image || null,
    images: item?.image ? [item.image] : [],
    description: "",
  });
}

export function OrdersHistoryScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const initialTab = params?.tab === "active" ? "active" : "all";
  const [tab, setTab] = useState(initialTab);
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [sheet, setSheet] = useState(null);
  const [isSheetVisible, setIsSheetVisible] = useState(false);

  const loadOrders = async ({ silent = false } = {}) => {
    if (silent) setIsRefreshing(true);
    else setIsLoading(true);
    setError("");

    try {
      const nextOrders = await listNativeOrders();
      setOrders(nextOrders);
    } catch (loadError) {
      setError(
        loadError?.status === 401
          ? "Войдите, чтобы посмотреть заказы."
          : "Не удалось загрузить заказы.",
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void loadOrders();
  }, []);

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

  const closeSheet = () => {
    setIsSheetVisible(false);
    setTimeout(() => {
      setSheet(null);
    }, 280);
  };

  const updateSheetPayload = (updater) => {
    setSheet((current) => {
      if (!current || current.sheetKey !== "product_detail") return current;
      const nextPayload =
        typeof updater === "function"
          ? updater(current.payload || {})
          : updater || {};
      return {
        ...current,
        payload: { ...(current.payload || {}), ...nextPayload },
      };
    });
  };

  const refreshProductQuantity = async (productId) => {
    const tokens = parseTokensString(await getStoredAuthTokens());
    if (!tokens?.access) {
      updateSheetPayload({ quantity: 0, isQuantityLoading: false });
      return;
    }

    try {
      const response = await getCartItems(tokens.access);
      const items = Array.isArray(response?.items) ? response.items : [];
      const found = items.find(
        (entry) => String(entry?.product?.id) === String(productId),
      );
      updateSheetPayload({
        quantity: found?.quantity ?? 0,
        isQuantityLoading: false,
      });
    } catch {
      updateSheetPayload({ quantity: 0, isQuantityLoading: false });
    }
  };

  const openProductSheet = async (item) => {
    const productId = item?.id;
    if (!productId) return;

    const fallbackProduct = toSheetProduct(item);
    setSheet({
      requestId: `order-product-${productId}-${Date.now()}`,
      sheetKey: "product_detail",
      payload: {
        productId: String(productId),
        product: fallbackProduct,
        fallbackProduct,
        quantity: 0,
        isLoading: true,
        isQuantityLoading: true,
        isCartPending: false,
        error: null,
      },
      options: {},
    });
    setIsSheetVisible(true);

    void refreshProductQuantity(productId);

    try {
      const product = await fetchProductById(productId);
      updateSheetPayload((current) => ({
        product: product || current.product || current.fallbackProduct,
        isLoading: false,
        error:
          product || current.product || current.fallbackProduct
            ? null
            : "Не удалось загрузить товар.",
      }));
    } catch {
      updateSheetPayload((current) => ({
        product: current.product || current.fallbackProduct,
        isLoading: false,
        error:
          current.product || current.fallbackProduct
            ? null
            : "Не удалось загрузить товар.",
      }));
    }
  };

  const handleSheetAction = async (actionId) => {
    const productId = sheet?.payload?.productId;
    if (!productId) return;

    if (actionId === "catalog") {
      closeSheet();
      setTimeout(() => {
        router.replace("/(tabs)/catalog");
      }, 280);
      return;
    }

    const delta =
      actionId === "add_to_cart" || actionId === "increment"
        ? 1
        : actionId === "decrement"
          ? -1
          : 0;
    if (!delta) return;

    const currentQuantity = Math.max(
      0,
      Number(sheet?.payload?.quantity || 0),
    );
    if (delta < 0 && currentQuantity <= 0) return;

    const tokens = parseTokensString(await getStoredAuthTokens());
    if (!tokens?.access) return;

    updateSheetPayload({ isCartPending: true });
    try {
      const updated = await adjustCartItemByProduct(
        tokens.access,
        productId,
        delta,
      );
      const nextQuantity = Math.max(
        0,
        Number(updated?.quantity ?? currentQuantity + delta),
      );
      updateSheetPayload({
        quantity: nextQuantity,
        isCartPending: false,
      });
    } catch {
      updateSheetPayload({ isCartPending: false });
    }
  };

  return (
    <NativeAccountScreenShell title="История заказов">
      {isLoading ? (
        <View style={styles.centeredState}>
          <ActivityIndicator color="#FE946E" size="small" />
          <Text style={styles.stateText}>Загружаем заказы...</Text>
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
                const active = key === tab;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setTab(key)}
                    style={[
                      styles.segmentedButton,
                      active && styles.segmentedButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentedButtonText,
                        active && styles.segmentedButtonTextActive,
                      ]}
                    >
                      {key === "active" ? "Активные" : "Все"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {error ? (
              <Text style={[styles.errorText, styles.ordersError]}>
                {error}
              </Text>
            ) : null}

            <View style={styles.listGap}>
              {filteredOrders.length === 0 ? (
                <View style={styles.card}>
                  <Text style={styles.stateText}>
                    {tab === "active"
                      ? "Активных заказов пока нет."
                      : "Заказов пока нет."}
                  </Text>
                </View>
              ) : (
                filteredOrders.map((order) => {
                  const statusMeta = getStatusMeta(order.status);
                  const itemPreview = Array.isArray(order.items)
                    ? order.items.slice(0, 2)
                    : [];
                  const remainingItems = Math.max(
                    (order.items?.length || 0) - itemPreview.length,
                    0,
                  );

                  return (
                    <View key={order.id} style={styles.orderCard}>
                      <Text style={styles.orderNumber}>
                        {`Заказ №${order.number || order.id}`}
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
                            Дата доставки
                          </Text>
                          <Text style={styles.orderSectionValue}>
                            {order.deliveryDate
                              ? formatDate(order.deliveryDate)
                              : "Не указана"}
                          </Text>
                        </View>

                        <View style={styles.orderInfoSection}>
                          <Text style={styles.orderSectionLabel}>
                            Адрес доставки
                          </Text>
                          <Text style={styles.orderSectionValue}>
                            {order.address || "Адрес не указан"}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.orderTotals}>
                        <View style={styles.orderTotalsRow}>
                          <Text style={styles.mutedText}>
                            {formatItemsLabel(order.items?.length || 0)}
                          </Text>
                          <Text style={styles.orderTotalsValue}>
                            {formatMoney(order.subtotal || order.total)} сум
                          </Text>
                        </View>

                        <View style={styles.orderTotalsRow}>
                          <Text style={styles.mutedText}>Доставка</Text>
                          <Text style={styles.orderTotalsValue}>
                            {order.deliveryFee
                              ? `${formatMoney(order.deliveryFee)} сум`
                              : "Бесплатно"}
                          </Text>
                        </View>

                        <View style={styles.orderTotalsRow}>
                          <Text style={styles.orderTotalLabel}>Итого</Text>
                          <Text style={styles.orderTotalValue}>
                            {formatMoney(order.total)} сум
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
                            onPress={() => openProductSheet(item)}
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
                    </View>
                  );
                })
              )}
            </View>
          </ScrollView>

          <NativeBottomSheet
            mounted={Boolean(sheet)}
            visible={isSheetVisible}
            sheet={sheet}
            onClose={closeSheet}
            onAction={handleSheetAction}
          />
        </>
      )}
    </NativeAccountScreenShell>
  );
}
