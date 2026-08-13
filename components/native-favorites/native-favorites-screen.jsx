import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
  Platform,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { NativePageHeader } from "@/components/native-page-header";
import { GuestAuthCard } from "@/components/guest-auth-card";
import { ProductCard } from "@/components/product-card";
import { getHeaderCache } from "@/lib/native-header-cache";
import {
  fetchFavorites,
  removeFavoriteByProduct,
} from "@/lib/native-market-api";
import {
  getStoredAuthTokens,
  getStoredAuthTokensSync,
} from "@/lib/auth-storage";
import {
  emitFavoriteChanged,
  subscribeFavoriteChanges,
} from "@/lib/native-favorites-events";
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

function FavoriteCardSkeleton() {
  return (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonImage}>
        <View style={styles.skeletonFavoriteIcon} />
      </View>
      <View style={styles.skeletonBody}>
        <View style={styles.skeletonTitle} />
        <View style={styles.skeletonLine} />
      </View>
      <View style={styles.skeletonOrderBox}>
        <View style={styles.skeletonPrice} />
        <View style={styles.skeletonAddButton} />
      </View>
    </View>
  );
}

function FavoritesSkeleton() {
  return (
    <View style={styles.listWrap}>
      {Array.from({ length: 6 }).map((_, index) => (
        <View key={index} style={styles.cardCell}>
          <FavoriteCardSkeleton />
        </View>
      ))}
    </View>
  );
}

export function NativeFavoritesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const initialTokens = parseTokensString(getStoredAuthTokensSync());
  const [tokens, setTokens] = useState(initialTokens);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [removingId, setRemovingId] = useState(null);

  const loadFavorites = useCallback(async () => {
    if (!tokens?.access) {
      setFavorites([]);
      setError("");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const data = await fetchFavorites(tokens.access);
      setFavorites(data);
      setError("");
    } catch {
      setError(t("profile.loadError"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t, tokens?.access]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const stored = await getStoredAuthTokens();
      if (!mounted) return;
      setTokens(parseTokensString(stored));
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setCurrentWebPath("/favorites");
    loadFavorites();
  }, [loadFavorites]);

  useEffect(
    () =>
      subscribeFavoriteChanges(({ productId, isFavorite, product }) => {
        if (!tokens?.access) return;

        if (!isFavorite) {
          setFavorites((prev) =>
            prev.filter(
              (entry) => String(entry?.product?.id) !== String(productId),
            ),
          );
          return;
        }

        if (!product) {
          void loadFavorites();
          return;
        }

        setFavorites((prev) => {
          const exists = prev.some(
            (entry) => String(entry?.product?.id) === String(productId),
          );
          if (exists) return prev;
          return [
            {
              id: `local-${productId}`,
              product,
            },
            ...prev,
          ];
        });
      }),
    [loadFavorites, tokens?.access],
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadFavorites();
  }, [loadFavorites]);

  const handleRemove = useCallback(
    async (favorite) => {
      const productId = favorite?.product?.id;
      if (!productId || !tokens?.access) return;
      setRemovingId(String(productId));
      try {
        await removeFavoriteByProduct(tokens.access, productId);
        emitFavoriteChanged({ productId, isFavorite: false });
        setFavorites((prev) =>
          prev.filter(
            (entry) => String(entry?.product?.id) !== String(productId),
          ),
        );
      } catch {
        setError(t("profile.loadError"));
      } finally {
        setRemovingId(null);
      }
    },
    [t, tokens?.access],
  );

  const handleOpen = useCallback(
    (favorite) => {
      const productId = favorite?.product?.id;
      if (!productId) return;
      setCurrentWebPath(`/products/${productId}`);
      setTabBarForcedHidden(true);
      router.push({
        pathname: "/product",
        params: { productPath: `/products/${productId}` },
      });
    },
    [router],
  );

  const emptyState = useMemo(() => {
    if (!tokens?.access) {
      return {
        title: t("favorites.authTitle"),
        description: t("favorites.authDescription"),
        action: t("common.login"),
      };
    }

    return {
      title: t("favorites.emptyTitle"),
      description: t("favorites.emptyDescription"),
      action: t("favorites.refresh"),
    };
  }, [t, tokens?.access]);

  const handleAuthAction = useCallback(() => {
    router.push({
      pathname: "/onboarding/phone",
      params: { next: "/(tabs)/favorites" },
    });
  }, [router]);

  const showLoading = loading && favorites.length === 0;
  const showEmptyContent = !showLoading && favorites.length === 0;
  const headerCache = getHeaderCache();
  const isLoggedIn = Boolean(tokens?.access);

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" translucent={false} backgroundColor="#FFFFFF" />
      <View style={styles.headerWrap}>
        <NativePageHeader
          title={t("tabs.favorites")}
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
        contentContainerStyle={[
          styles.scrollContent,
          showEmptyContent ? styles.emptyScrollContent : null,
          { paddingBottom: 24 + insets.bottom },
        ]}
      >
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {showLoading ? (
          <FavoritesSkeleton />
        ) : favorites.length > 0 ? (
          <View style={styles.listWrap}>
            {favorites.map((favorite) => {
              const key = String(favorite?.id ?? favorite?.product?.id);
              const isRemoving = removingId === String(favorite?.product?.id);
              const product = favorite?.product ?? {};
              return (
                <View key={key} style={styles.cardCell}>
                  <ProductCard
                    product={product}
                    favorite
                    onPress={() => handleOpen(favorite)}
                    onToggleFavorite={() => {
                      if (!isRemoving) handleRemove(favorite);
                    }}
                  />
                  {isRemoving ? (
                    <View style={styles.removingOverlay}>
                      <ActivityIndicator color="#FE946E" />
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : tokens?.access ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons
                name="heart-dislike-outline"
                size={34}
                color="#FE946E"
              />
            </View>
            <Text style={styles.emptyTitle}>{emptyState.title}</Text>
            <Text style={styles.emptyDescription}>
              {emptyState.description}
            </Text>
            <Pressable onPress={handleRefresh} style={styles.emptyButton}>
              <Text style={styles.emptyButtonText}>{emptyState.action}</Text>
            </Pressable>
          </View>
        ) : (
          <GuestAuthCard
            icon="heart-outline"
            title={emptyState.title}
            description={emptyState.description}
            actionLabel={emptyState.action}
            onAction={handleAuthAction}
          />
        )}
        {tokens?.access ? <View style={styles.androidTabSpacer} /> : null}
      </ScrollView>
      {/*
      {Platform.OS === "android" ? (
        <View
          style={[
            styles.androidTabBarAnimatedWrap,
            { paddingBottom: Math.max(insets.bottom, 14) },
          ]}
        >
          <AndroidTabBar
            activeTabKey="favorites"
            cartCount={0}
            onTabPress={(tabKey) => {
              if (tabKey === "home") router.push("/(tabs)");
              if (tabKey === "catalog") router.push("/(tabs)/catalog");
              if (tabKey === "cart") router.push("/(tabs)/cart");
              if (tabKey === "favorites") return;
              if (tabKey === "profile") router.push("/(tabs)/profile");
            }}
          />
        </View>
      ) : null}
      */}
    </View>
  );
}

const styles = {
  screen: {
    flex: 1,
    backgroundColor: "#fff",
  },
  headerWrap: {
    width: "100%",
    zIndex: 10,
    backgroundColor: "#FFFFFF",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 12,
  },
  emptyScrollContent: {
    flexGrow: 1,
    backgroundColor: "#FFFFFF",
  },
  errorBox: {
    borderRadius: 18,
    backgroundColor: "#FFEDEF",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorText: {
    color: "#B72136",
    fontSize: 14,
  },
  listWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
  },
  cardCell: {
    width: "48%",
    position: "relative",
  },
  skeletonCard: {
    width: "100%",
    minWidth: 150,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    padding: 4,
    overflow: "hidden",
  },
  skeletonImage: {
    position: "relative",
    width: "100%",
    aspectRatio: 1.08,
    borderRadius: 20,
    backgroundColor: "#ECECEF",
  },
  skeletonFavoriteIcon: {
    position: "absolute",
    right: 8,
    top: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F6F6F7",
  },
  skeletonBody: {
    paddingHorizontal: 4,
    paddingTop: 8,
    gap: 7,
  },
  skeletonTitle: {
    width: "88%",
    height: 14,
    borderRadius: 999,
    backgroundColor: "#ECECEF",
  },
  skeletonLine: {
    width: "62%",
    height: 14,
    borderRadius: 999,
    backgroundColor: "#F1F1F3",
  },
  skeletonOrderBox: {
    minHeight: 45,
    marginTop: 8,
    borderRadius: 19,
    backgroundColor: "#F6F6F7",
    paddingHorizontal: 8,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  skeletonPrice: {
    width: "52%",
    height: 16,
    borderRadius: 999,
    backgroundColor: "#ECECEF",
  },
  skeletonAddButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E3E3E7",
  },
  removingOverlay: {
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.08,
      },
      default: {},
    }),
    position: "absolute",
    inset: 0,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.65)",
  },
  emptyState: {
    paddingVertical: 48,
    paddingHorizontal: 18,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 999,
    backgroundColor: "#FFF2EA",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    color: "#121212",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyDescription: {
    marginTop: 8,
    color: "#777777",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 280,
  },
  emptyButton: {
    marginTop: 18,
    borderRadius: 999,
    backgroundColor: "#111111",
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  emptyButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  androidTabSpacer: {
    height: 88,
  },
  androidTabBarAnimatedWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
  },
};
