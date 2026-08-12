import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Image as ExpoImage } from "expo-image";
import { useRouter } from "expo-router";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import {
  addFavorite,
  adjustCartItemByProduct,
  removeFavoriteByProduct,
} from "@/lib/native-market-api";
import {
  getStoredAuthTokens,
  getStoredAuthTokensSync,
  setPendingAuthAction,
} from "@/lib/auth-storage";
import {
  computePriceStats,
  formatCurrency,
} from "@/components/native-bottom-sheet.shared";
import {
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

function resolveImage(product, fallback) {
  const rawImage =
    product?.image ||
    product?.image_url ||
    product?.images?.[0] ||
    product?.raw?.image ||
    product?.raw?.image_url ||
    fallback;

  if (typeof rawImage === "string") return rawImage;
  return rawImage?.image_url || rawImage?.image || DEFAULT_PRODUCT_IMAGE;
}

function normalizeProduct({
  product,
  id,
  imageUri,
  title,
  subtitle,
  price,
  oldPrice,
  discountLabel,
}) {
  const source = product || {};
  return {
    ...source,
    id: String(source.id ?? source.uuid ?? id ?? ""),
    name: source.name ?? source.title ?? title ?? "",
    description: source.description ?? subtitle ?? "",
    price: source.price ?? source.raw?.price ?? oldPrice ?? price ?? 0,
    discount_percent:
      source.discount_percent ??
      source.raw?.discount_percent ??
      discountLabel ??
      0,
    discounted_price:
      source.final_price ??
      source.discounted_price ??
      source.raw?.final_price ??
      source.raw?.discounted_price ??
      price ??
      source.price ??
      0,
    final_price:
      source.final_price ??
      source.discounted_price ??
      source.raw?.final_price ??
      source.raw?.discounted_price ??
      price ??
      source.price ??
      0,
    image: resolveImage(source, imageUri),
  };
}

function ProductCardComponent({
  product,
  id,
  imageUri,
  title,
  subtitle,
  price,
  oldPrice,
  discountLabel,
  inCart = false,
  showCounter = false,
  quantity: quantityProp = 0,
  cartQuantity,
  onPress,
  onToggleFavorite,
  onFavoriteChange,
  onAdd,
  onDecrease,
  onIncrease,
  favorite = false,
  compact = false,
}) {
  const router = useRouter();
  const normalizedProduct = useMemo(
    () =>
      normalizeProduct({
        product,
        id,
        imageUri,
        title,
        subtitle,
        price,
        oldPrice,
        discountLabel,
      }),
    [discountLabel, id, imageUri, oldPrice, price, product, subtitle, title],
  );
  const productId = normalizedProduct.id;
  const priceStats = computePriceStats(normalizedProduct);
  const syncedCartQuantity = useCartQuantity(productId);
  const initialQuantity =
    Number(syncedCartQuantity || cartQuantity || quantityProp || 0) || 0;
  const [quantity, setQuantity] = useState(initialQuantity);
  const [isFavorite, setIsFavorite] = useState(
    Boolean(favorite || product?.is_favorite || product?.isFavorite),
  );
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (isPending) return;
    setQuantity(Number(syncedCartQuantity || cartQuantity || quantityProp || 0) || 0);
  }, [cartQuantity, isPending, quantityProp, syncedCartQuantity]);

  useEffect(() => {
    setIsFavorite(
      Boolean(favorite || product?.is_favorite || product?.isFavorite),
    );
  }, [favorite, product?.isFavorite, product?.is_favorite]);

  const getTokens = useCallback(async () => {
    const cached = parseTokensString(getStoredAuthTokensSync());
    if (cached?.access) return cached;
    return parseTokensString(await getStoredAuthTokens());
  }, []);

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

  const handleOpen = useCallback(() => {
    if (onPress) {
      onPress(normalizedProduct);
      return;
    }
    if (!productId) return;
    setCurrentWebPath(`/products/${productId}`);
    setTabBarForcedHidden(true);
    router.push({
      pathname: "/product",
      params: { productPath: `/products/${productId}` },
    });
  }, [normalizedProduct, onPress, productId, router]);

  const handleCartDelta = useCallback(
    async (delta, overrideHandler) => {
      if (!productId || isPending) return;
      if (overrideHandler) {
        overrideHandler(normalizedProduct);
        return;
      }

      const tokens = await getTokens();
      if (!tokens?.access) {
        await requireAuth({ type: "cart", productId, delta });
        return;
      }

      const previousQuantity = quantity;
      const nextQuantity = Math.max(0, previousQuantity + delta);
      setQuantity(nextQuantity);
      setCartQuantity(productId, nextQuantity);
      setIsPending(true);
      try {
        const updated = await adjustCartItemByProduct(
          tokens.access,
          productId,
          delta,
        );
        const updatedQuantity = Number(updated?.quantity ?? nextQuantity) || 0;
        setQuantity(updatedQuantity);
        setCartQuantity(productId, updatedQuantity);
      } catch {
        setQuantity(previousQuantity);
        setCartQuantity(productId, previousQuantity);
      } finally {
        setIsPending(false);
      }
    },
    [getTokens, isPending, normalizedProduct, productId, quantity, requireAuth],
  );

  const handleFavorite = useCallback(async () => {
    if (!productId || isPending) return;
    if (onToggleFavorite) {
      onToggleFavorite(normalizedProduct);
      return;
    }

    const tokens = await getTokens();
    if (!tokens?.access) {
      await requireAuth({ type: "favorite", productId });
      return;
    }

    const previous = isFavorite;
    const next = !previous;
    setIsFavorite(next);
    setIsPending(true);
    try {
      if (next) {
        await addFavorite(tokens.access, productId);
      } else {
        await removeFavoriteByProduct(tokens.access, productId);
      }
      emitFavoriteChanged({
        productId,
        isFavorite: next,
        product: normalizedProduct,
      });
      onFavoriteChange?.(next);
    } catch {
      setIsFavorite(previous);
    } finally {
      setIsPending(false);
    }
  }, [
    getTokens,
    isFavorite,
    isPending,
    normalizedProduct,
    onFavoriteChange,
    onToggleFavorite,
    productId,
    requireAuth,
  ]);

  const displayName = normalizedProduct.name || title || "Product";
  const displayDescription = normalizedProduct.description || subtitle || "";
  const imageSource = normalizedProduct.image || DEFAULT_PRODUCT_IMAGE;
  const hasCounter = showCounter || inCart || quantity > 0;
  const counterProgress = useSharedValue(hasCounter ? 1 : 0);
  const addButtonProgress = useSharedValue(hasCounter ? 0 : 1);
  const finalPrice = price
    ? String(price)
    : formatCurrency(priceStats.finalPrice);
  const originalPrice =
    oldPrice ||
    (priceStats.hasDiscount ? formatCurrency(priceStats.price) : "");
  const resolvedDiscountLabel =
    discountLabel ||
    (priceStats.hasDiscount ? `Skidka ${priceStats.discountLabel}%` : "");
  const isCompact = compact || displayName.length > 28;

  useEffect(() => {
    counterProgress.value = withSpring(hasCounter ? 1 : 0, {
      stiffness: 420,
      damping: 34,
      mass: 0.8,
      overshootClamping: true,
    });
    addButtonProgress.value = withTiming(hasCounter ? 0 : 1, {
      duration: 160,
    });
  }, [addButtonProgress, counterProgress, hasCounter]);

  const orderBoxAnimatedStyle = useAnimatedStyle(() => {
    const progress = Math.min(1, Math.max(0, counterProgress.value));
    const padding = 8 * (1 - progress);

    return {
      height: 45 + 27 * progress,
      backgroundColor: interpolateColor(
        progress,
        [0, 1],
        ["#FFF7F3", "rgba(254, 148, 110, 0)"],
      ),
      paddingTop: padding,
      paddingBottom: padding,
      paddingLeft: padding,
      paddingRight: padding,
    };
  });

  const counterAnimatedStyle = useAnimatedStyle(() => {
    const progress = Math.min(1, Math.max(0, counterProgress.value));

    return {
      height: 40 * progress,
      opacity: progress,
      transform: [{ translateY: 8 * (1 - progress) }],
    };
  });

  const addButtonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: addButtonProgress.value,
    transform: [{ scale: 0.7 + 0.3 * addButtonProgress.value }],
  }));

  return (
    <View style={[styles.cardShadow, isCompact && styles.cardCompact]}>
      <View style={styles.card}>
        <Pressable
          onPress={handleOpen}
          style={styles.imageWrap}
          android_ripple={null}
        >
          <ExpoImage
            source={{ uri: imageSource }}
            style={styles.image}
            contentFit="cover"
            cachePolicy="memory-disk"
          />

          {resolvedDiscountLabel ? (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText} numberOfLines={1}>
                {resolvedDiscountLabel}
              </Text>
            </View>
          ) : null}

          <Pressable
            onPress={handleFavorite}
            hitSlop={10}
            disabled={isPending}
            style={styles.favoriteButton}
          >
            <Ionicons
              name={isFavorite ? "heart" : "heart-outline"}
              size={18}
              color={isFavorite ? "#E73C50" : "#131314"}
            />
          </Pressable>
        </Pressable>

        <Pressable
          onPress={handleOpen}
          style={styles.body}
          android_ripple={null}
        >
          <Text style={styles.title} numberOfLines={2}>
            {displayName}
          </Text>

          {displayDescription ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {displayDescription}
            </Text>
          ) : null}
        </Pressable>

        <Animated.View style={[styles.orderBox, orderBoxAnimatedStyle]}>
          <View style={styles.priceBlock}>
            {originalPrice && !hasCounter ? (
              <Text style={styles.oldPrice} numberOfLines={1}>
                {originalPrice}
              </Text>
            ) : null}
            <Text style={styles.price} numberOfLines={1}>
              {finalPrice}
            </Text>
          </View>

          <Animated.View
            pointerEvents={hasCounter ? "auto" : "none"}
            style={[styles.counterClip, counterAnimatedStyle]}
          >
            <View style={styles.counterRow}>
              <Pressable
                onPress={() => handleCartDelta(-1, onDecrease)}
                style={styles.counterButton}
                hitSlop={8}
                disabled={isPending || quantity <= 0}
              >
                <Ionicons name="remove" size={18} color="#131314" />
              </Pressable>
              <Text style={styles.counterValue}>{quantity}</Text>
              <Pressable
                onPress={() => handleCartDelta(1, onIncrease)}
                style={styles.counterButton}
                hitSlop={8}
                disabled={isPending}
              >
                <Ionicons name="add" size={18} color="#131314" />
              </Pressable>
            </View>
          </Animated.View>

          <Animated.View
            pointerEvents={hasCounter ? "none" : "auto"}
            style={[styles.addButtonAnimated, addButtonAnimatedStyle]}
          >
            <Pressable
              onPress={() => handleCartDelta(1, onAdd)}
              style={styles.addButton}
              hitSlop={8}
              disabled={isPending}
            >
              <Ionicons name="add" size={20} color="#FFFFFF" />
            </Pressable>
          </Animated.View>
        </Animated.View>
      </View>
    </View>
  );
}

export const ProductCard = memo(ProductCardComponent);

const styles = StyleSheet.create({
  cardShadow: {
    width: "100%",
    minWidth: 150,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    shadowColor: "#00001E",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.025,
    shadowRadius: 22,
    elevation: 0,
    boxShadow: "0px 0px 22px rgba(0, 0, 30, 0.055)",
  },
  card: {
    width: "100%",
    minWidth: 150,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    padding: 4,
    overflow: "hidden",
  },
  cardCompact: {
    minWidth: 150,
  },
  imageWrap: {
    position: "relative",
    width: "100%",
    aspectRatio: 1.08,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#FFF7F3",
  },
  image: {
    width: "100%",
    height: "100%",
    borderRadius: 20,
  },
  discountBadge: {
    position: "absolute",
    left: 8,
    top: 8,
    maxWidth: "68%",
    borderRadius: 100,
    backgroundColor: "#E73C50",
    paddingHorizontal: 7,
    paddingVertical: 3,
    zIndex: 2,
  },
  discountText: {
    color: "#FFFFFF",
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "600",
  },
  favoriteButton: {
    position: "absolute",
    right: 8,
    top: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  body: {
    paddingHorizontal: 4,
    paddingTop: 8,
  },
  title: {
    minHeight: 36,
    color: "#131314",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "600",
  },
  subtitle: {
    marginTop: 3,
    color: "#85858C",
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "400",
  },
  orderBox: {
    position: "relative",
    marginTop: 8,
    marginHorizontal: 0,
    borderRadius: 19,
    backgroundColor: "#FFF7F3",
    paddingHorizontal: 8,
    paddingVertical: 8,
    minHeight: 45,
    overflow: "hidden",
    display: "flex",
  },
  priceBlock: {
    minHeight: 32,
    justifyContent: "center",
    paddingRight: 38,
  },
  oldPrice: {
    color: "#85858C",
    fontSize: 12,
    lineHeight: 14,
    textDecorationLine: "line-through",
  },
  price: {
    color: "#1A1B23",
    fontSize: 14,
    lineHeight: 16,
    fontWeight: "700",
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FE946E",
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonAnimated: {
    position: "absolute",
    right: 7,
    top: 8,
  },
  counterClip: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 32,
    overflow: "hidden",
    borderRadius: 20,
  },
  counterRow: {
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 4,
    backgroundColor: "#F1F1F3",
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
  counterValue: {
    minWidth: 20,
    textAlign: "center",
    color: "#131314",
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "600",
  },
});
