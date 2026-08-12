import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Image as ExpoImage } from "expo-image";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { NativePageHeader } from "@/components/native-page-header";
import {
  computePriceStats,
  formatCurrency,
} from "@/components/native-bottom-sheet.shared";
import { ProductCard } from "@/components/product-card";
import { getHeaderCache } from "@/lib/native-header-cache";
import {
  adjustCartItemByProduct,
  fetchProductById,
  fetchProductList,
  getCartItems,
} from "@/lib/native-market-api";
import {
  getStoredAuthTokens,
  getStoredAuthTokensSync,
} from "@/lib/auth-storage";
import {
  hydrateCartQuantities,
  setCartQuantity,
  useCartQuantitiesState,
} from "@/lib/cart-quantities";
import {
  setCurrentWebPath,
  setTabBarForcedHidden,
} from "@/lib/tab-bar-visibility";

function parseTokensString(tokensString) {
  if (!tokensString) return null;
  try {
    return JSON.parse(tokensString);
  } catch {
    return null;
  }
}

function CheckBox({ checked, onPress }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.checkbox}>
      {checked ? (
        <View style={styles.checkboxActive}>
          <Ionicons name="checkmark" size={15} color="#FFFFFF" />
        </View>
      ) : (
        <View style={styles.checkboxEmpty} />
      )}
    </Pressable>
  );
}

function CartRow({
  item,
  selected,
  pending,
  isLast,
  onToggle,
  onDelta,
  onRemove,
}) {
  const product = item.product ?? {};
  const quantity = Math.max(0, Number(item.quantity) || 0);
  const priceStats = computePriceStats(product);

  return (
    <View style={[styles.cartRow, isLast ? styles.cartRowLast : null]}>
      <ExpoImage
        source={{ uri: product.image_url || product.image }}
        style={styles.itemImage}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
      <View style={styles.itemDetails}>
        <View style={styles.itemTopRow}>
          <Text style={styles.itemTitle} numberOfLines={2}>
            {product.name || "Product"}
          </Text>
          <CheckBox checked={selected} onPress={onToggle} />
        </View>
        <View style={styles.itemPriceBlock}>
          <Text style={styles.itemPrice}>
            {formatCurrency(priceStats.finalPrice)}
          </Text>
          {priceStats.hasDiscount ? (
            <Text style={styles.itemOldPrice}>
              {formatCurrency(priceStats.price)}
            </Text>
          ) : null}
        </View>
        <View style={styles.itemActions}>
          <View style={styles.counter}>
            <Pressable
              onPress={() => onDelta(-1)}
              disabled={pending || quantity <= 0}
              style={styles.counterButton}
            >
              <Ionicons name="remove" size={18} color="#131314" />
            </Pressable>
            <Text style={styles.counterText}>{quantity}</Text>
            <Pressable
              onPress={() => onDelta(1)}
              disabled={pending}
              style={styles.counterButton}
            >
              <Ionicons name="add" size={18} color="#131314" />
            </Pressable>
          </View>
          <Pressable
            onPress={onRemove}
            disabled={pending}
            style={styles.removeButton}
          >
            {pending ? (
              <ActivityIndicator color="#E73C50" size="small" />
            ) : (
              <Ionicons name="trash-outline" size={20} color="#E73C50" />
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function CartRowSkeleton() {
  return (
    <View style={styles.cartRow}>
      <View style={styles.skeletonItemImage} />
      <View style={styles.skeletonItemDetails}>
        <View style={styles.skeletonItemTopRow}>
          <View style={styles.skeletonTitleBlock}>
            <View style={styles.skeletonLineWide} />
            <View style={styles.skeletonLineShort} />
          </View>
          <View style={styles.skeletonCheckbox} />
        </View>
        <View style={styles.skeletonPriceBlock}>
          <View style={styles.skeletonPrice} />
          <View style={styles.skeletonOldPrice} />
        </View>
        <View style={styles.skeletonActions}>
          <View style={styles.skeletonCounter} />
          <View style={styles.skeletonRemoveButton} />
        </View>
      </View>
    </View>
  );
}

function CartSkeleton() {
  return (
    <View style={styles.cartCard}>
      <View style={styles.selectAllRow}>
        <View style={styles.skeletonSelectAllText} />
        <View style={styles.skeletonCheckbox} />
      </View>
      {Array.from({ length: 3 }).map((_, index) => (
        <CartRowSkeleton key={index} />
      ))}
    </View>
  );
}

function DetailLine({ icon, label, value, badge }) {
  return (
    <View style={styles.detailLine}>
      <Ionicons name={icon} size={20} color="#757575" />
      <Text style={styles.detailLabel}>{label}</Text>
      {badge ? (
        <View style={styles.detailBadge}>
          <Text style={styles.detailBadgeText}>{badge}</Text>
        </View>
      ) : null}
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function SummaryMenuIcon({ progress }) {
  const topBarStyle = {
    top: progress.interpolate({
      inputRange: [0, 1],
      outputRange: [3, 9],
    }),
    transform: [
      {
        rotate: progress.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", "45deg"],
        }),
      },
    ],
  };
  const middleBarStyle = {
    opacity: progress.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 0],
    }),
  };
  const bottomBarStyle = {
    top: progress.interpolate({
      inputRange: [0, 1],
      outputRange: [15, 9],
    }),
    transform: [
      {
        rotate: progress.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", "-45deg"],
        }),
      },
    ],
  };

  return (
    <View style={styles.summaryMenuIcon}>
      <Animated.View style={[styles.summaryMenuBar, topBarStyle]} />
      <Animated.View
        style={[
          styles.summaryMenuBar,
          styles.summaryMenuBarMiddle,
          middleBarStyle,
        ]}
      />
      <Animated.View style={[styles.summaryMenuBar, bottomBarStyle]} />
    </View>
  );
}

export function NativeCartScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const cartQuantitiesState = useCartQuantitiesState();
  const cartQuantities = cartQuantitiesState.quantities;
  const [tokens, setTokens] = useState(
    parseTokensString(getStoredAuthTokensSync()),
  );
  const [items, setItems] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [selectedIds, setSelectedIds] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const detailsProgress = useRef(new Animated.Value(0)).current;

  const selectedItems = useMemo(
    () =>
      items.filter((item) => {
        const productId = String(item?.product?.id ?? "");
        return selectedIds[productId] !== false;
      }),
    [items, selectedIds],
  );

  const totals = useMemo(() => {
    return selectedItems.reduce(
      (acc, item) => {
        const quantity = Math.max(0, Number(item.quantity) || 0);
        const priceStats = computePriceStats(item.product);
        acc.count += quantity;
        acc.subtotal += priceStats.price * quantity;
        acc.total += priceStats.finalPrice * quantity;
        return acc;
      },
      { count: 0, subtotal: 0, total: 0 },
    );
  }, [selectedItems]);

  const discount = Math.max(0, totals.subtotal - totals.total);
  const deliveryFee = selectedItems.length > 0 ? 10000 : 0;
  const payable = totals.total + deliveryFee;
  const allSelected =
    items.length > 0 &&
    items.every(
      (item) => selectedIds[String(item?.product?.id ?? "")] !== false,
    );

  useFocusEffect(
    useCallback(() => {
      setCurrentWebPath("/cart");
      setTabBarForcedHidden(false);
    }, []),
  );

  const loadCart = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const storedTokens =
        parseTokensString(getStoredAuthTokensSync()) ||
        parseTokensString(await getStoredAuthTokens());
      setTokens(storedTokens);

      if (!storedTokens?.access) {
        setItems([]);
        setSelectedIds({});
        setError(
          "\u0412\u043e\u0439\u0434\u0438\u0442\u0435, \u0447\u0442\u043e\u0431\u044b \u043e\u0442\u043a\u0440\u044b\u0442\u044c \u043a\u043e\u0440\u0437\u0438\u043d\u0443.",
        );
        return;
      }

      const [cartResponse, products] = await Promise.all([
        getCartItems(storedTokens.access),
        fetchProductList({ pageSize: 12 }).catch(() => []),
      ]);
      const nextItems = Array.isArray(cartResponse)
        ? cartResponse
        : (cartResponse?.items ?? []);
      setItems(nextItems);
      setSelectedIds((current) => {
        const next = {};
        nextItems.forEach((item) => {
          const id = String(item?.product?.id ?? "");
          if (id) next[id] = current[id] !== false;
        });
        return next;
      });
      setRecommended(products);
      await hydrateCartQuantities(storedTokens.access, { force: true });
      setError("");
    } catch {
      setError(
        "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u043a\u043e\u0440\u0437\u0438\u043d\u0443.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadCart();
  }, [loadCart]);

  useEffect(() => {
    Animated.timing(detailsProgress, {
      toValue: detailsVisible ? 1 : 0,
      duration: 140,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [detailsProgress, detailsVisible]);

  useEffect(() => {
    setItems((current) =>
      current
        .map((item) => {
          const productId = String(item?.product?.id ?? "");
          if (!productId) return item;
          if (cartQuantities[productId] !== undefined) {
            return { ...item, quantity: cartQuantities[productId] };
          }
          if (
            cartQuantitiesState.source === "change" &&
            cartQuantitiesState.lastChange?.productId === productId
          ) {
            return {
              ...item,
              quantity: cartQuantitiesState.lastChange.quantity,
            };
          }
          if (cartQuantitiesState.source === "hydrate") {
            return { ...item, quantity: 0 };
          }
          return item;
        })
        .filter((item) => Number(item.quantity) > 0),
    );
  }, [
    cartQuantities,
    cartQuantitiesState.lastChange,
    cartQuantitiesState.source,
  ]);

  useEffect(() => {
    const missingProductIds = Object.entries(cartQuantities)
      .filter(([, quantity]) => Number(quantity) > 0)
      .map(([productId]) => productId)
      .filter(
        (productId) =>
          !items.some(
            (item) => String(item?.product?.id) === String(productId),
          ),
      );

    if (missingProductIds.length === 0) return;

    let cancelled = false;
    (async () => {
      const products = await Promise.all(
        missingProductIds.map(async (productId) => {
          const localProduct =
            recommended.find(
              (product) => String(product?.id) === String(productId),
            ) || null;
          if (localProduct) return localProduct;
          return fetchProductById(productId).catch(() => null);
        }),
      );

      if (cancelled) return;
      setItems((current) => {
        const existingIds = new Set(
          current.map((item) => String(item?.product?.id ?? "")),
        );
        const nextItems = [...current];
        products.forEach((product, index) => {
          const productId = missingProductIds[index];
          const quantity = Math.max(0, Number(cartQuantities[productId]) || 0);
          if (!product || quantity <= 0 || existingIds.has(String(product.id)))
            return;
          nextItems.push({
            id: `local-${productId}`,
            quantity,
            product,
          });
          existingIds.add(String(product.id));
        });
        return nextItems;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [cartQuantities, items, recommended]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void loadCart({ silent: true });
  }, [loadCart]);

  const toggleAll = useCallback(() => {
    setSelectedIds((current) => {
      const shouldSelect = !allSelected;
      const next = {};
      items.forEach((item) => {
        const id = String(item?.product?.id ?? "");
        if (id) next[id] = shouldSelect;
      });
      return next;
    });
  }, [allSelected, items]);

  const changeQuantity = useCallback(
    async (item, delta) => {
      const productId = String(item?.product?.id ?? "");
      if (!productId || !tokens?.access || pendingId) return;

      const previous = Math.max(0, Number(item.quantity) || 0);
      const optimistic = Math.max(0, previous + delta);
      setPendingId(productId);
      setCartQuantity(productId, optimistic);
      setItems((current) =>
        current
          .map((entry) =>
            String(entry?.product?.id) === productId
              ? { ...entry, quantity: optimistic }
              : entry,
          )
          .filter((entry) => Number(entry.quantity) > 0),
      );

      try {
        const updated = await adjustCartItemByProduct(
          tokens.access,
          productId,
          delta,
        );
        const updatedQuantity = Number(updated?.quantity ?? optimistic) || 0;
        setCartQuantity(productId, updatedQuantity);
        setItems((current) =>
          current
            .map((entry) =>
              String(entry?.product?.id) === productId
                ? { ...entry, quantity: updatedQuantity }
                : entry,
            )
            .filter((entry) => Number(entry.quantity) > 0),
        );
      } catch {
        setCartQuantity(productId, previous);
        setItems((current) =>
          current.map((entry) =>
            String(entry?.product?.id) === productId
              ? { ...entry, quantity: previous }
              : entry,
          ),
        );
      } finally {
        setPendingId(null);
      }
    },
    [pendingId, tokens?.access],
  );

  const removeItem = useCallback(
    (item) => {
      const quantity = Math.max(0, Number(item.quantity) || 0);
      if (quantity > 0) void changeQuantity(item, -quantity);
    },
    [changeQuantity],
  );

  const handleCheckout = useCallback(() => {
    if (selectedItems.length === 0) return;
    setCurrentWebPath("/checkout");
    setTabBarForcedHidden(true);
    router.push("/checkout");
  }, [router, selectedItems.length]);

  const handleLogin = useCallback(() => {
    router.push({
      pathname: "/onboarding/phone",
      params: { next: "/(tabs)/cart" },
    });
  }, [router]);

  const handleAuthAction = useCallback(() => {
    router.push({
      pathname: "/onboarding/phone",
      params: { next: "/(tabs)/cart" },
    });
  }, [router]);

  const showSummary = selectedItems.length > 0;
  const headerCache = getHeaderCache();
  const isLoggedIn = Boolean(tokens?.access);

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" translucent={false} backgroundColor="#FFFFFF" />
      <View style={styles.headerWrap}>
        <NativePageHeader
          title={t("tabs.cart")}
          isLoggedIn={isLoggedIn}
          walletBalance={headerCache.walletBalance}
          onLoginPress={isLoggedIn ? undefined : handleAuthAction}
        />
      </View>

      <ScrollView
        style={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        contentContainerStyle={[styles.scrollContent]}
      >
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            {!tokens?.access ? (
              <Pressable onPress={handleLogin} style={styles.loginButton}>
                <Text style={styles.loginButtonText}>
                  {"\u0412\u043e\u0439\u0442\u0438"}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {loading ? (
          <CartSkeleton />
        ) : items.length > 0 ? (
          <View style={styles.cartCard}>
            <View style={styles.selectAllRow}>
              <Text style={styles.selectAllText}>
                {
                  "\u0412\u044b\u0431\u0440\u0430\u0442\u044c \u0432\u0441\u0435 \u0442\u043e\u0432\u0430\u0440\u044b"
                }
              </Text>
              <CheckBox checked={allSelected} onPress={toggleAll} />
            </View>
            {items.map((item, index) => {
              const productId = String(item?.product?.id ?? index);
              return (
                <CartRow
                  key={productId}
                  item={item}
                  selected={selectedIds[productId] !== false}
                  pending={pendingId === productId}
                  isLast={index === items.length - 1}
                  onToggle={() =>
                    setSelectedIds((current) => ({
                      ...current,
                      [productId]: current[productId] === false,
                    }))
                  }
                  onDelta={(delta) => changeQuantity(item, delta)}
                  onRemove={() => removeItem(item)}
                />
              );
            })}
          </View>
        ) : !error ? (
          <View style={styles.emptyCard}>
            <Ionicons name="bag-outline" size={36} color="#FE946E" />
            <Text style={styles.emptyTitle}>
              {
                "\u041a\u043e\u0440\u0437\u0438\u043d\u0430 \u043f\u0443\u0441\u0442\u0430\u044f"
              }
            </Text>
            <Text style={styles.emptyText}>
              {
                "\u0414\u043e\u0431\u0430\u0432\u044c\u0442\u0435 \u0442\u043e\u0432\u0430\u0440\u044b \u0438\u0437 \u043a\u0430\u0442\u0430\u043b\u043e\u0433\u0430, \u0438 \u043e\u043d\u0438 \u043f\u043e\u044f\u0432\u044f\u0442\u0441\u044f \u0437\u0434\u0435\u0441\u044c."
              }
            </Text>
          </View>
        ) : null}

        {recommended.length > 0 ? (
          <View style={styles.recommendedSection}>
            <Text style={styles.recommendedTitle}>
              {
                "\u0420\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0443\u0435\u043c"
              }
            </Text>
            <View style={styles.recommendedList}>
              {recommended.map((product) => (
                <View key={product.id} style={styles.recommendedCard}>
                  <ProductCard product={product} compact />
                </View>
              ))}
            </View>
          </View>
        ) : null}
        {showSummary ? (
          <View
            pointerEvents="none"
            style={[
              styles.summaryScrollSpacer,
              { height: 120 + insets.bottom },
            ]}
          />
        ) : null}
      </ScrollView>

      {showSummary ? (
        <View pointerEvents="box-none" style={styles.summaryLayer}>
          <Animated.View
            pointerEvents={detailsVisible ? "auto" : "none"}
            style={[
              styles.summaryDetailsPanel,
              { bottom: 120 + insets.bottom },
              {
                opacity: detailsProgress,
                maxHeight: detailsProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 168],
                }),
                transform: [
                  {
                    translateY: detailsProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [8, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.detailsTitle}>
              {"\u0414\u0435\u0442\u0430\u043b\u0438"}
            </Text>
            <DetailLine
              icon="bag"
              label={"\u0422\u043e\u0432\u0430\u0440\u043e\u0432"}
              badge={String(totals.count)}
              value={formatCurrency(totals.subtotal)}
            />
            <DetailLine
              icon="pricetag"
              label={"\u0421\u043a\u0438\u0434\u043a\u0430"}
              value={`-${formatCurrency(discount)}`}
            />
            <DetailLine
              icon="car"
              label={"\u0414\u043e\u0441\u0442\u0430\u0432\u043a\u0430"}
              value={formatCurrency(deliveryFee)}
            />
          </Animated.View>
          <Animated.View
            style={[
              styles.summaryWrap,
              detailsVisible ? styles.summaryWrapDetailsOpen : null,
              {
                bottom: 12 + insets.bottom,
                borderTopLeftRadius: detailsProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [24, 0],
                }),
                borderTopRightRadius: detailsProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [24, 0],
                }),
              },
            ]}
          >
            <Pressable
              onPress={() => setDetailsVisible((current) => !current)}
              style={styles.summaryTop}
            >
              <Ionicons name="wallet" size={24} color="#22C55E" />
              <View style={styles.summaryTextBlock}>
                <Text style={styles.summaryLabel}>
                  {
                    "\u0418\u0442\u043e\u0433\u043e \u043a \u043e\u043f\u043b\u0430\u0442\u0435"
                  }
                </Text>
                <Text style={styles.summaryValue}>
                  {formatCurrency(payable)}
                </Text>
              </View>
              <View style={styles.summaryMenuButton}>
                <SummaryMenuIcon progress={detailsProgress} />
              </View>
            </Pressable>
            <Pressable onPress={handleCheckout} style={styles.checkoutButton}>
              <Text style={styles.checkoutButtonText}>
                {
                  "\u041e\u0444\u043e\u0440\u043c\u0438\u0442\u044c \u0437\u0430\u043a\u0430\u0437"
                }
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  headerWrap: {
    width: "100%",
    zIndex: 10,
    backgroundColor: "#FFFFFF",
  },
  scroll: {
    flex: 1,
    backgroundColor: "#F8F8F8",
  },
  scrollContent: {
    gap: 8,
  },
  emptyScrollContent: {
    flexGrow: 1,
    paddingTop: 8,
    backgroundColor: "#F8F8F8",
  },
  cartCard: {
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
  },
  selectAllRow: {
    minHeight: 48,
    borderBottomWidth: 1,
    borderBottomColor: "#EDEDED",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectAllText: {
    color: "#0B0B0B",
    fontSize: 14,
    lineHeight: 16,
  },
  checkbox: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: "#FE946E",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxEmpty: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#C9C9C9",
    backgroundColor: "#FFFFFF",
  },
  cartRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#EDEDED",
  },
  cartRowLast: {
    borderBottomWidth: 0,
  },
  skeletonItemImage: {
    width: 88,
    height: 117,
    borderRadius: 8,
    backgroundColor: "#ECECEF",
  },
  skeletonItemDetails: {
    flex: 1,
    minWidth: 0,
    gap: 14,
  },
  skeletonItemTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  skeletonTitleBlock: {
    flex: 1,
    gap: 7,
    paddingTop: 1,
  },
  skeletonLineWide: {
    width: "92%",
    height: 14,
    borderRadius: 999,
    backgroundColor: "#ECECEF",
  },
  skeletonLineShort: {
    width: "58%",
    height: 14,
    borderRadius: 999,
    backgroundColor: "#F1F1F3",
  },
  skeletonCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: "#ECECEF",
  },
  skeletonPriceBlock: {
    gap: 6,
  },
  skeletonPrice: {
    width: 112,
    height: 18,
    borderRadius: 999,
    backgroundColor: "#ECECEF",
  },
  skeletonOldPrice: {
    width: 78,
    height: 12,
    borderRadius: 999,
    backgroundColor: "#F1F1F3",
  },
  skeletonActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  skeletonCounter: {
    width: 123,
    height: 40,
    borderRadius: 900,
    backgroundColor: "#F1F1F3",
  },
  skeletonRemoveButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ECECEF",
  },
  skeletonSelectAllText: {
    width: 156,
    height: 14,
    borderRadius: 999,
    backgroundColor: "#ECECEF",
  },
  itemImage: {
    width: 88,
    height: 117,
    borderRadius: 8,
    backgroundColor: "#F1F1F3",
  },
  itemDetails: {
    flex: 1,
    minWidth: 0,
    gap: 14,
  },
  itemTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  itemTitle: {
    flex: 1,
    color: "#0B0B0B",
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "500",
  },
  itemPriceBlock: {
    gap: 1,
  },
  itemPrice: {
    color: "#0B0B0B",
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
  },
  itemOldPrice: {
    color: "#7C7C7C",
    fontSize: 12,
    lineHeight: 15,
    textDecorationLine: "line-through",
  },
  itemActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  counter: {
    width: 123,
    height: 40,
    borderRadius: 900,
    backgroundColor: "#F8F8F8",
    padding: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  counterButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  counterText: {
    minWidth: 24,
    textAlign: "center",
    color: "#0B0B0B",
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "500",
  },
  removeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FDECEE",
    alignItems: "center",
    justifyContent: "center",
  },
  recommendedSection: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 16,
  },
  recommendedTitle: {
    color: "#0B0B0B",
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "600",
    marginBottom: 12,
  },
  recommendedList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
  },
  recommendedCard: {
    width: "48%",
  },
  summaryScrollSpacer: {
    backgroundColor: "#FFFFFF",
  },
  summaryLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  summaryDetailsPanel: {
    position: "absolute",
    left: 16,
    right: 16,
    overflow: "hidden",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    shadowColor: "#000014",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.025,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryWrap: {
    position: "absolute",
    left: 16,
    right: 16,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 8,
    shadowColor: "#000014",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.025,
    shadowRadius: 8,
    elevation: 4,
  },
  summaryWrapDetailsOpen: {
    shadowOpacity: 0,
    elevation: 0,
  },
  summaryTop: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  summaryTextBlock: {
    alignItems: "center",
  },
  summaryLabel: {
    color: "#757575",
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "500",
  },
  summaryValue: {
    color: "#0B0B0B",
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "600",
  },
  summaryMenuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryMenuIcon: {
    width: 20,
    height: 20,
    position: "relative",
  },
  summaryMenuBar: {
    position: "absolute",
    left: 0,
    width: 20,
    height: 1.5,
    borderRadius: 999,
    backgroundColor: "#131314",
  },
  summaryMenuBarTop: {
    top: 3,
  },
  summaryMenuBarMiddle: {
    top: 9,
  },
  summaryMenuBarBottom: {
    top: 15,
  },
  summaryMenuBarTopOpen: {
    top: 9,
    transform: [{ rotate: "45deg" }],
  },
  summaryMenuBarMiddleOpen: {
    opacity: 0,
  },
  summaryMenuBarBottomOpen: {
    top: 9,
    transform: [{ rotate: "-45deg" }],
  },
  checkoutButton: {
    height: 40,
    borderRadius: 60,
    backgroundColor: "#FE946E",
    alignItems: "center",
    justifyContent: "center",
  },
  checkoutButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "600",
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.35)",
    paddingHorizontal: 16,
  },
  detailsSheet: {
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    paddingTop: 14,
    paddingHorizontal: 12,
    gap: 4,
    marginBottom: 88,
  },
  detailsTitle: {
    color: "#0B0B0B",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
    paddingHorizontal: 0,
    paddingBottom: 6,
  },
  detailLine: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 4,
  },
  detailLabel: {
    flex: 1,
    color: "#0B0B0B",
    fontSize: 16,
    lineHeight: 22,
  },
  detailBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#757575",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  detailBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "600",
  },
  detailValue: {
    color: "#0B0B0B",
    fontSize: 16,
    lineHeight: 22,
  },
  sheetSummary: {
    borderTopWidth: 1,
    borderTopColor: "#EDEDED",
    marginTop: 6,
    paddingTop: 12,
    paddingHorizontal: 4,
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  errorBox: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 18,
    alignItems: "center",
    gap: 12,
  },
  errorText: {
    color: "#131314",
    fontSize: 15,
    lineHeight: 20,
    textAlign: "center",
  },
  loginButton: {
    height: 42,
    borderRadius: 999,
    backgroundColor: "#FE946E",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  emptyCard: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    paddingVertical: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    marginTop: 12,
    color: "#131314",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
  },
  emptyText: {
    marginTop: 6,
    color: "#757575",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
});
