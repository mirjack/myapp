import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  PanResponder,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import {
  computePriceStats,
  formatCurrency,
} from "@/components/native-bottom-sheet.shared";
import { ProductCard } from "@/components/product-card";
import {
  addFavorite,
  adjustCartItemByProduct,
  fetchFavorites,
  fetchProductById,
  fetchProductList,
  getCartItems,
  removeFavoriteByProduct,
} from "@/lib/native-market-api";
import {
  getStoredAuthTokens,
  getStoredAuthTokensSync,
  setPendingAuthAction,
} from "@/lib/auth-storage";
import {
  getLastNonProductWebPath,
  setCurrentWebPath,
  setTabBarForcedHidden,
} from "@/lib/tab-bar-visibility";
import { setCartQuantity, useCartQuantity } from "@/lib/cart-quantities";
import { emitFavoriteChanged } from "@/lib/native-favorites-events";

const DEFAULT_PRODUCT_IMAGE =
  "https://www.figma.com/api/mcp/asset/240cc9ae-83de-433c-a66a-e4c026d9e177.png";

function parseTokensString(tokensString) {
  if (!tokensString) return null;
  try {
    return JSON.parse(tokensString);
  } catch {
    return null;
  }
}

function getProductIdFromPath(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  const text = decodeURIComponent(String(raw || ""));
  const match = text.match(/\/products\/([^/?#]+)/);
  if (match?.[1]) return decodeURIComponent(match[1]);
  try {
    const pathname = new URL(text).pathname;
    const urlMatch = pathname.match(/\/products\/([^/?#]+)/);
    if (urlMatch?.[1]) return decodeURIComponent(urlMatch[1]);
  } catch {
    // Plain ids are expected here too.
  }
  return text.replace(/^\/+/, "");
}

function getProductImages(product) {
  const urls = [
    product?.image_url,
    product?.image,
    ...(Array.isArray(product?.images) ? product.images : []).map((entry) =>
      typeof entry === "string" ? entry : (entry?.image_url ?? entry?.image),
    ),
    ...(Array.isArray(product?.raw?.images) ? product.raw.images : []).map(
      (entry) =>
        typeof entry === "string" ? entry : (entry?.image_url ?? entry?.image),
    ),
  ].filter(Boolean);

  const unique = Array.from(new Set(urls));
  return unique.length > 0 ? unique : [DEFAULT_PRODUCT_IMAGE];
}

function CashbackPill({ children }) {
  return (
    <LinearGradient
      colors={["#FAF56C", "#7EFDEC"]}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={styles.cashbackPill}
    >
      <Ionicons name="sparkles" size={14} color="#0B0B0B" />
      <Text style={styles.cashbackText}>{children}</Text>
    </LinearGradient>
  );
}

function ProductPageSkeleton({ topInset, onBack }) {
  return (
    <View style={styles.screen}>
      <StatusBar style="dark" translucent={false} backgroundColor="#FFFFFF" />
      <View style={[styles.safeTop, { height: topInset }]} />
      <View style={styles.skeletonImage}>
        <View style={styles.topBarOverlay}>
          <Pressable onPress={onBack} style={styles.iconButton}>
            <Ionicons name="chevron-back" size={24} color="#131314" />
          </Pressable>
          <View style={styles.iconButton} />
        </View>
      </View>
      <View style={styles.skeletonPriceCard}>
        <View style={styles.skeletonBadge} />
        <View style={styles.skeletonPriceGroup}>
          <View style={styles.skeletonOldPrice} />
          <View style={styles.skeletonPrice} />
        </View>
      </View>
      <View style={styles.skeletonDetailsCard}>
        <View style={styles.skeletonTitle} />
        <View style={styles.skeletonLine} />
        <View style={styles.skeletonLineWide} />
        <View style={styles.skeletonLineShort} />
      </View>
      <View style={styles.skeletonRelatedCard}>
        <View style={styles.skeletonRelatedTitle} />
        <View style={styles.skeletonRelatedGrid}>
          <View style={styles.skeletonRelatedItem} />
          <View style={styles.skeletonRelatedItem} />
        </View>
      </View>
      <View style={styles.skeletonFooter}>
        <View style={styles.skeletonFooterButton} />
        <View style={styles.skeletonFooterButtonActive} />
      </View>
    </View>
  );
}

export function NativeProductScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const productId = getProductIdFromPath(params?.productPath);
  const syncedCartQuantity = useCartQuantity(productId);
  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [cartPending, setCartPending] = useState(false);
  const [favoritePending, setFavoritePending] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isImageViewerVisible, setIsImageViewerVisible] = useState(false);
  const listRef = useRef(null);
  const viewerPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          gestureState.dy > 4 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
        onMoveShouldSetPanResponderCapture: (_, gestureState) =>
          gestureState.dy > 4 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > 56 || gestureState.vy > 0.8) {
            setIsImageViewerVisible(false);
          }
        },
      }),
    [],
  );
  const footerProgress = useSharedValue(quantity > 0 ? 1 : 0);

  const images = useMemo(() => getProductImages(product), [product]);
  const heroWidth = Math.max(1, Math.round(windowWidth));
  const priceStats = computePriceStats(product);
  const totalPrice = priceStats.finalPrice * Math.max(1, quantity);
  const cashbackValue = Math.max(0, Math.round(totalPrice * 0.03));
  const availableQuantity = Math.max(
    0,
    Number(
      product?.available_quantity ??
        product?.raw?.available_quantity ??
        product?.raw?.stock_qty ??
        product?.raw?.quantity ??
        product?.raw?.inventory_quantity ??
        0,
    ) || 0,
  );

  useFocusEffect(
    useCallback(() => {
      setTabBarForcedHidden(true);
      if (productId) setCurrentWebPath(`/products/${productId}`);

      return () => {
        setCurrentWebPath(getLastNonProductWebPath());
        setTabBarForcedHidden(false);
      };
    }, [productId]),
  );

  const getTokens = useCallback(async () => {
    const cached = parseTokensString(getStoredAuthTokensSync());
    if (cached?.access) return cached;
    return parseTokensString(await getStoredAuthTokens());
  }, []);

  const loadProduct = useCallback(
    async ({ silent = false } = {}) => {
      if (!productId) {
        setError("Product not found.");
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (!silent) setLoading(true);
      try {
        const [nextProduct, tokens] = await Promise.all([
          fetchProductById(productId),
          getTokens(),
        ]);
        setProduct(nextProduct);
        if (nextProduct?.category_id) {
          fetchProductList({
            categoryId: nextProduct.category_id,
            pageSize: 12,
          })
            .then((items) => {
              setRelatedProducts(
                items.filter(
                  (item) => String(item.id) !== String(nextProduct.id),
                ),
              );
            })
            .catch(() => setRelatedProducts([]));
        } else {
          setRelatedProducts([]);
        }
        setIsFavorite(
          Boolean(
            nextProduct?.is_favorite ||
            nextProduct?.isFavorite ||
            nextProduct?.raw?.is_favorite ||
            nextProduct?.raw?.isFavorite,
          ),
        );
        setError("");

        if (tokens?.access) {
          const [cartResponse, favorites] = await Promise.all([
            getCartItems(tokens.access).catch(() => null),
            fetchFavorites(tokens.access).catch(() => []),
          ]);
          const items = Array.isArray(cartResponse)
            ? cartResponse
            : (cartResponse?.items ?? []);
          const cartItem = items.find(
            (entry) => String(entry?.product?.id) === String(productId),
          );
          const nextQuantity = Number(cartItem?.quantity ?? 0) || 0;
          setQuantity(nextQuantity);
          setCartQuantity(productId, nextQuantity);
          setIsFavorite(
            (current) =>
              current ||
              favorites.some(
                (entry) => String(entry?.product?.id) === String(productId),
              ),
          );
        } else {
          setQuantity(0);
          setCartQuantity(productId, 0);
        }
      } catch {
        setError("Failed to load product information.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [getTokens, productId],
  );

  useEffect(() => {
    void loadProduct();
  }, [loadProduct]);

  useEffect(() => {
    if (!cartPending) setQuantity(syncedCartQuantity);
  }, [cartPending, syncedCartQuantity]);

  useEffect(() => {
    footerProgress.value = withSpring(quantity > 0 ? 1 : 0, {
      stiffness: 420,
      damping: 34,
      mass: 0.8,
      overshootClamping: true,
    });
  }, [footerProgress, quantity]);

  const activeFooterStyle = useAnimatedStyle(() => {
    const progress = Math.min(1, Math.max(0, footerProgress.value));
    return {
      opacity: progress,
      maxHeight: 184 * progress,
      transform: [{ translateY: 12 * (1 - progress) }],
    };
  });

  const idleFooterStyle = useAnimatedStyle(() => {
    const progress = Math.min(1, Math.max(0, footerProgress.value));
    return {
      opacity: 1 - progress,
      maxHeight: 56 * (1 - progress),
      transform: [{ scale: 0.96 + 0.04 * (1 - progress) }],
    };
  });

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)/catalog");
  }, [router]);

  const handleGoToCart = useCallback(() => {
    setCurrentWebPath("/cart");
    setTabBarForcedHidden(false);
    router.replace("/(tabs)/cart");
  }, [router]);

  const requireAuth = useCallback(
    async (action) => {
      await setPendingAuthAction(action);
      router.push({
        pathname: "/onboarding/phone",
        params: { next: "/catalog" },
      });
    },
    [router],
  );

  const changeQuantity = useCallback(
    async (delta) => {
      if (!productId || cartPending) return;
      if (delta < 0 && quantity <= 0) return;

      const tokens = await getTokens();
      if (!tokens?.access) {
        await requireAuth({ type: "cart", productId, delta });
        return;
      }

      const previous = quantity;
      const optimistic = Math.max(0, previous + delta);
      setQuantity(optimistic);
      setCartQuantity(productId, optimistic);
      setCartPending(true);
      try {
        const updated = await adjustCartItemByProduct(
          tokens.access,
          productId,
          delta,
        );
        const updatedQuantity = Number(updated?.quantity ?? optimistic) || 0;
        setQuantity(updatedQuantity);
        setCartQuantity(productId, updatedQuantity);
      } catch {
        setQuantity(previous);
        setCartQuantity(productId, previous);
      } finally {
        setCartPending(false);
      }
    },
    [cartPending, getTokens, productId, quantity, requireAuth],
  );

  const toggleFavorite = useCallback(async () => {
    if (!productId || favoritePending) return;

    const tokens = await getTokens();
    if (!tokens?.access) {
      await requireAuth({ type: "favorite", productId });
      return;
    }

    const previous = isFavorite;
    const next = !previous;
    setIsFavorite(next);
    setFavoritePending(true);
    try {
      if (previous) {
        await removeFavoriteByProduct(tokens.access, productId);
      } else {
        await addFavorite(tokens.access, productId);
      }
      emitFavoriteChanged({ productId, isFavorite: next, product });
    } catch {
      setIsFavorite(previous);
    } finally {
      setFavoritePending(false);
    }
  }, [favoritePending, getTokens, isFavorite, product, productId, requireAuth]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadProduct({ silent: true });
  }, [loadProduct]);

  if (loading && !product) {
    return <ProductPageSkeleton topInset={insets.top} onBack={handleBack} />;
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" translucent={false} backgroundColor="#FFFFFF" />
      <View style={[styles.safeTop, { height: insets.top }]} />
      <ScrollView
        bounces={false}
        overScrollMode="never"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={{ paddingBottom: 196 + insets.bottom }}
      >
        <View style={styles.imageWrap}>
          <View style={styles.topBarOverlay}>
            <Pressable onPress={handleBack} style={styles.iconButton}>
              <Ionicons name="chevron-back" size={24} color="#131314" />
            </Pressable>
            <Pressable
              onPress={toggleFavorite}
              disabled={favoritePending}
              style={[styles.iconButton, styles.favoriteButton]}
            >
              <Ionicons
                name={isFavorite ? "heart" : "heart-outline"}
                size={22}
                color={isFavorite ? "#E73C50" : "#131314"}
              />
            </Pressable>
          </View>

          {heroWidth > 0 ? (
            <>
              <FlatList
                ref={listRef}
                data={images}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item, index) => `${item}-${index}`}
                onMomentumScrollEnd={(event) => {
                  setActiveImageIndex(
                    Math.round(event.nativeEvent.contentOffset.x / heroWidth),
                  );
                }}
                renderItem={({ item }) => (
                  <View style={{ width: heroWidth, height: 364 }}>
                    <Pressable
                      style={styles.productImagePressable}
                      onPress={() => setIsImageViewerVisible(true)}
                    >
                      <ExpoImage
                        source={{ uri: item }}
                        style={styles.productImage}
                        contentFit="cover"
                        contentPosition="center"
                        cachePolicy="memory-disk"
                        transition={180}
                        recyclingKey={`${productId}-${item}`}
                      />
                    </Pressable>
                  </View>
                )}
              />
            </>
          ) : null}

          {images.length > 1 ? (
            <View style={styles.imageProgress}>
              {images.map((item, index) => (
                <View
                  key={`${item}-dot-${index}`}
                  style={[
                    styles.imageProgressSegment,
                    index === activeImageIndex
                      ? styles.imageProgressSegmentActive
                      : null,
                  ]}
                />
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.priceCard}>
          <View style={styles.badgeRow}>
            <CashbackPill>+3%</CashbackPill>
            {priceStats.discountLabel > 0 ? (
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>
                  -{priceStats.discountLabel}%
                </Text>
              </View>
            ) : null}
          </View>
          <View style={styles.priceCardPriceBlock}>
            {priceStats.hasDiscount ? (
              <Text style={styles.priceCardOldPrice}>
                {formatCurrency(priceStats.price)}
              </Text>
            ) : null}
            <Text style={styles.priceCardFinalPrice}>
              {formatCurrency(priceStats.finalPrice)}
            </Text>
          </View>
        </View>

        <View style={styles.details}>
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Text style={styles.title}>{product?.name || "Product"}</Text>
          {product?.description ? (
            <Text style={styles.description}>{product.description}</Text>
          ) : null}
        </View>

        <View style={styles.stockCard}>
          <View style={styles.stockIcon}>
            <Ionicons name="checkmark" size={22} color="#22C55E" />
          </View>
          <Text style={styles.stockText}>В наличии</Text>
          <Text style={styles.stockCount}>{availableQuantity} шт</Text>
          {false ? (
            <Text style={styles.stockCount}>
              {Number(product.available_quantity) || 0} шт
            </Text>
          ) : null}
        </View>

        {relatedProducts.length > 0 ? (
          <View style={styles.relatedSection}>
            <Text style={styles.relatedTitle}>Similar products</Text>
            <View style={styles.relatedGrid}>
              {relatedProducts.map((item) => (
                <View key={item.id} style={styles.relatedCell}>
                  <ProductCard product={item} compact stretch />
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 16 + insets.bottom }]}>
        <Animated.View
          pointerEvents={quantity > 0 ? "auto" : "none"}
          style={[
            styles.footerContent,
            styles.footerAnimatedClip,
            activeFooterStyle,
          ]}
        >
            <View style={styles.cashbackSummary}>
              <Text style={styles.cashbackLabel}>Cashback</Text>
              <CashbackPill>+{formatCurrency(cashbackValue)}</CashbackPill>
            </View>
            <View style={styles.divider} />
            <View style={styles.footerRow}>
              <View style={styles.priceBlock}>
                {priceStats.hasDiscount ? (
                  <Text style={styles.oldPrice}>
                    {formatCurrency(priceStats.price * quantity)}
                  </Text>
                ) : null}
                <Text style={styles.finalPrice}>
                  {formatCurrency(priceStats.finalPrice * quantity)}
                </Text>
              </View>
              <View style={styles.counter}>
                <Pressable
                  onPress={() => changeQuantity(-1)}
                  disabled={cartPending || quantity <= 0}
                  style={styles.counterButton}
                >
                  <Ionicons name="remove" size={20} color="#131314" />
                </Pressable>
                <Text style={styles.counterText}>{quantity}</Text>
                <Pressable
                  onPress={() => changeQuantity(1)}
                  disabled={cartPending}
                  style={styles.counterButton}
                >
                  <Ionicons name="add" size={20} color="#131314" />
                </Pressable>
              </View>
            </View>
            <Pressable onPress={handleGoToCart} style={styles.cartButton}>
              <Text style={styles.cartButtonText}>Go to cart</Text>
            </Pressable>
        </Animated.View>

        <Animated.View
          pointerEvents={quantity > 0 ? "none" : "auto"}
          style={[styles.footerAnimatedClip, idleFooterStyle]}
        >
          <View style={styles.footerRow}>
            <Pressable
              onPress={() => changeQuantity(1)}
              disabled={cartPending}
              style={styles.secondaryAddButton}
            >
              {cartPending ? (
                <ActivityIndicator color="#131314" />
              ) : (
                <Text style={styles.addButtonText}>Add to cart</Text>
              )}
            </Pressable>
            <Pressable
              onPress={() => changeQuantity(1)}
              disabled={cartPending}
              style={styles.buyButton}
            >
              <Text style={styles.buyButtonText}>Buy now</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>

      <Modal
        visible={isImageViewerVisible}
        transparent={false}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setIsImageViewerVisible(false)}
      >
        <View style={styles.viewerRoot} {...viewerPanResponder.panHandlers}>
          <StatusBar style="light" translucent backgroundColor="#000000" />
          <Pressable
            onPress={() => setIsImageViewerVisible(false)}
            style={[styles.viewerClose, { top: insets.top + 12 }]}
          >
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </Pressable>
          <FlatList
            data={images}
            horizontal
            pagingEnabled
            initialScrollIndex={Math.min(activeImageIndex, images.length - 1)}
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item, index) => `viewer-${item}-${index}`}
            getItemLayout={(_, index) => ({
              length: heroWidth,
              offset: heroWidth * index,
              index,
            })}
            onMomentumScrollEnd={(event) => {
              setActiveImageIndex(
                Math.round(event.nativeEvent.contentOffset.x / heroWidth),
              );
            }}
            renderItem={({ item }) => (
              <View style={[styles.viewerSlide, { width: heroWidth }]}>
                <ExpoImage
                  source={{ uri: item }}
                  style={styles.viewerImage}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                />
              </View>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FBFBFB",
  },
  safeTop: {
    width: "100%",
    backgroundColor: "#FFFFFF",
  },
  topBar: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  topBarOverlay: {
    position: "absolute",
    left: 12,
    right: 12,
    top: 8,
    zIndex: 3,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  favoriteButton: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  imageWrap: {
    position: "relative",
    overflow: "hidden",
    marginHorizontal: 0,
    backgroundColor: "#FFFFFF",
  },
  productImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#FFFFFF",
  },
  productImagePressable: {
    width: "100%",
    height: "100%",
  },
  imageProgress: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 12,
    flexDirection: "row",
    gap: 5,
  },
  imageProgressSegment: {
    flex: 1,
    height: 3,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.45)",
  },
  imageProgressSegmentActive: {
    backgroundColor: "#FFFFFF",
  },
  priceCard: {
    marginTop: 8,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badgeRow: {
    minHeight: 24,
    flexDirection: "row",
    gap: 8,
  },
  priceCardPriceBlock: {
    alignItems: "flex-end",
    flexShrink: 1,
    marginLeft: 12,
  },
  priceCardOldPrice: {
    color: "#7C7C80",
    fontSize: 13,
    lineHeight: 16,
    textDecorationLine: "line-through",
  },
  priceCardFinalPrice: {
    color: "#000000",
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "700",
  },
  cashbackPill: {
    minHeight: 24,
    borderRadius: 96,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  cashbackText: {
    color: "#131314",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "600",
  },
  discountBadge: {
    minHeight: 24,
    borderRadius: 25,
    backgroundColor: "#E73C50",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  discountText: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 16,
    fontWeight: "600",
  },
  title: {
    color: "#00031A",
    fontSize: 21,
    lineHeight: 26,
    fontWeight: "600",
  },
  description: {
    marginTop: 10,
    color: "#747479",
    fontSize: 15,
    lineHeight: 21,
  },
  details: {
    marginTop: 8,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  stockCard: {
    marginTop: 8,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stockIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#EAFBF0",
    alignItems: "center",
    justifyContent: "center",
  },
  stockText: {
    flex: 1,
    color: "#131314",
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "500",
  },
  stockCount: {
    color: "#131314",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
  },
  relatedSection: {
    marginTop: 8,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 25,
  },
  relatedTitle: {
    color: "#131314",
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "700",
    marginBottom: 12,
  },
  relatedGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "stretch",
    justifyContent: "space-between",
    gap: 12,
  },
  relatedCell: {
    width: "48%",
    alignSelf: "stretch",
  },
  errorBox: {
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: "#FFEDEF",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorText: {
    color: "#B72136",
    fontSize: 14,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  skeletonImage: {
    position: "relative",
    height: 364,
    backgroundColor: "#F1F1F3",
  },
  skeletonPriceCard: {
    marginTop: 8,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  skeletonBadge: {
    width: 118,
    height: 24,
    borderRadius: 999,
    backgroundColor: "#F1F1F3",
  },
  skeletonPriceGroup: {
    alignItems: "flex-end",
    gap: 6,
  },
  skeletonOldPrice: {
    width: 82,
    height: 12,
    borderRadius: 999,
    backgroundColor: "#F1F1F3",
  },
  skeletonPrice: {
    width: 126,
    height: 22,
    borderRadius: 999,
    backgroundColor: "#F1F1F3",
  },
  skeletonDetailsCard: {
    marginTop: 8,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 10,
  },
  skeletonTitle: {
    width: "72%",
    height: 24,
    borderRadius: 999,
    backgroundColor: "#F1F1F3",
  },
  skeletonLine: {
    width: "92%",
    height: 14,
    borderRadius: 999,
    backgroundColor: "#F1F1F3",
  },
  skeletonLineWide: {
    width: "100%",
    height: 14,
    borderRadius: 999,
    backgroundColor: "#F1F1F3",
  },
  skeletonLineShort: {
    width: "66%",
    height: 14,
    borderRadius: 999,
    backgroundColor: "#F1F1F3",
  },
  skeletonRelatedCard: {
    marginTop: 8,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 16,
  },
  skeletonRelatedTitle: {
    width: 146,
    height: 22,
    borderRadius: 999,
    backgroundColor: "#F1F1F3",
    marginBottom: 12,
  },
  skeletonRelatedGrid: {
    flexDirection: "row",
    gap: 12,
  },
  skeletonRelatedItem: {
    flex: 1,
    height: 210,
    borderRadius: 24,
    backgroundColor: "#F1F1F3",
  },
  skeletonStockCard: {
    marginTop: 8,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  skeletonStockIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#F1F1F3",
  },
  skeletonStockText: {
    flex: 1,
    height: 18,
    borderRadius: 999,
    backgroundColor: "#F1F1F3",
  },
  skeletonStockCount: {
    width: 48,
    height: 18,
    borderRadius: 999,
    backgroundColor: "#F1F1F3",
  },
  skeletonFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    flexDirection: "row",
    gap: 12,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: -7 },
    shadowOpacity: 0.09,
    shadowRadius: 20,
    elevation: 10,
  },
  skeletonFooterButton: {
    flex: 1,
    height: 48,
    borderRadius: 999,
    backgroundColor: "#F6F6F7",
  },
  skeletonFooterButtonActive: {
    flex: 1,
    height: 48,
    borderRadius: 999,
    backgroundColor: "#FFD0C0",
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: 16,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: -7 },
    shadowOpacity: 0.09,
    shadowRadius: 20,
    elevation: 10,
  },
  footerContent: {
    gap: 0,
  },
  footerAnimatedClip: {
    overflow: "hidden",
  },
  cashbackSummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cashbackLabel: {
    color: "#747479",
    fontSize: 14,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: "#EDEDEF",
    marginTop: 14,
    marginBottom: 14,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  cartButton: {
    marginTop: 14,
    height: 48,
    borderRadius: 999,
    backgroundColor: "#FE946E",
    alignItems: "center",
    justifyContent: "center",
  },
  cartButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
  },
  priceBlock: {
    flex: 1,
    gap: 2,
  },
  oldPrice: {
    color: "#7C7C80",
    fontSize: 13,
    lineHeight: 16,
    textDecorationLine: "line-through",
  },
  finalPrice: {
    color: "#131314",
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "600",
  },
  addButton: {
    minWidth: 148,
    height: 48,
    borderRadius: 999,
    backgroundColor: "#FE946E",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  addButtonText: {
    color: "#131314",
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "700",
  },
  secondaryAddButton: {
    flex: 1,
    height: 48,
    borderRadius: 999,
    backgroundColor: "#F6F6F7",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  buyButton: {
    flex: 1,
    height: 48,
    borderRadius: 999,
    backgroundColor: "#FE946E",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  buyButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "700",
  },
  counter: {
    width: 150,
    height: 48,
    borderRadius: 999,
    backgroundColor: "#F1F1F3",
    paddingHorizontal: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  counterButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  counterText: {
    minWidth: 28,
    textAlign: "center",
    color: "#131314",
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
  },
  viewerRoot: {
    flex: 1,
    backgroundColor: "#fff",
  },
  viewerClose: {
    position: "absolute",
    right: 16,
    zIndex: 5,
    width: 40,
    height: 40,
    borderRadius: 22,
    backgroundColor: "#ddd",
    alignItems: "center",
    justifyContent: "center",
  },
  viewerSlide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  viewerImage: {
    width: "100%",
    height: "100%",
  },
});
