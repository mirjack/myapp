import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Image as ExpoImage } from "expo-image";
import { StatusBar } from "expo-status-bar";
import { openBrowserAsync } from "expo-web-browser";
import { useFocusEffect, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";

import { NativeBottomSheet } from "@/components/native-bottom-sheet";
import { NativePageHeader } from "@/components/native-page-header";
import { ProductCard } from "@/components/product-card";
import {
  getHeaderCache,
  updateHeaderCache,
} from "@/lib/native-header-cache";
import { NativeStoriesViewer } from "@/components/native-stories-viewer";
import {
  fetchMarketingBanners,
  fetchProductList,
  fetchStories,
  getCategories,
} from "@/lib/native-market-api";
import { fetchNativeLoyaltyProfile } from "@/lib/native-account-api";
import {
  readCachedNativeLoyaltyProfileSync,
  writeCachedNativeLoyaltyProfile,
} from "@/lib/native-loyalty-cache";
import {
  getStoredAuthTokens,
  getStoredAuthTokensSync,
} from "@/lib/auth-storage";
import {
  setCurrentWebPath,
  setTabBarForcedHidden,
} from "@/lib/tab-bar-visibility";

const colorPalette = ["#3399FF", "#16C647", "#FD9334", "#933DFF"];
const homeCache = {
  stories: new Map(),
  banners: new Map(),
  categories: new Map(),
  sections: new Map(),
};

function parseTokensString(tokensString) {
  if (!tokensString) return null;
  try {
    return JSON.parse(tokensString);
  } catch {
    return null;
  }
}

function parseLoyaltyNumber(value) {
  const parsed = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function formatLoyaltyValue(value) {
  const numeric = parseLoyaltyNumber(value);
  if (numeric == null) return String(value ?? "0").trim() || "0";
  return new Intl.NumberFormat("en-US")
    .format(Math.trunc(numeric))
    .replace(/,/g, " ");
}

function formatCompactLoyaltyValue(value) {
  const numeric = parseLoyaltyNumber(value);
  if (numeric == null) return String(value ?? "0").trim() || "0";
  const abs = Math.abs(numeric);
  if (abs >= 1_000_000) return `${Math.trunc(numeric / 1_000_000)}m`;
  if (abs >= 100_000) return `${Math.trunc(numeric / 1_000)}k`;
  return formatLoyaltyValue(numeric);
}

function formatLoyaltyPercent(value) {
  const numeric = parseLoyaltyNumber(value);
  if (numeric == null) return "0%";
  return `${Math.max(0, Math.min(100, Math.round(numeric)))}%`;
}

function ProductGridSkeleton() {
  return (
    <View style={styles.grid}>
      {Array.from({ length: 6 }).map((_, index) => (
        <View key={index} style={styles.cardCell}>
          <View style={styles.skeletonCard}>
            <View style={styles.skeletonImage} />
            <View style={styles.skeletonTitle} />
            <View style={styles.skeletonLine} />
            <View style={styles.skeletonOrder} />
          </View>
        </View>
      ))}
    </View>
  );
}

function StoriesRow({ stories, loading, onOpen }) {
  if (loading) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.storiesRow}
      >
        {Array.from({ length: 4 }).map((_, index) => (
          <View key={index} style={styles.storySkeleton} />
        ))}
      </ScrollView>
    );
  }
  if (!stories.length) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.storiesRow}
    >
      {stories.map((story, index) => (
        <Pressable
          key={story.id || story.mediaName || index}
          onPress={() => onOpen(index)}
          style={[styles.storyButton, { borderColor: story.borderColor }]}
        >
          <ExpoImage
            source={{ uri: story.previewUrl || story.mediaUrl }}
            style={styles.storyImage}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        </Pressable>
      ))}
    </ScrollView>
  );
}

function BannerCarousel({ banners, loading, onPressBanner }) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.max(280, width - 32);
  if (loading) return <View style={styles.bannerSkeleton} />;
  if (!banners.length) return null;

  return (
    <ScrollView
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      snapToInterval={cardWidth + 12}
      decelerationRate="fast"
      contentContainerStyle={styles.bannerRow}
    >
      {banners.map((banner, index) => (
        <Pressable
          key={banner.id || index}
          onPress={() => onPressBanner(banner)}
          style={[styles.bannerCard, { width: cardWidth }]}
        >
          <ExpoImage
            source={{ uri: banner.imageUrl }}
            style={styles.bannerImage}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        </Pressable>
      ))}
    </ScrollView>
  );
}

function CategoriesRow({ categories, loading, onPressCategory, t }) {
  if (loading) {
    return (
      <View style={styles.sectionBlock}>
        <View style={styles.sectionTitleSkeleton} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesRow}
        >
          {Array.from({ length: 3 }).map((_, index) => (
            <View key={index} style={styles.categorySkeleton} />
          ))}
        </ScrollView>
      </View>
    );
  }
  if (!categories.length) return null;

  return (
    <View style={styles.sectionBlock}>
      <Text style={styles.sectionTitle}>
        {t("homePage.categoriesTitle", "Categories")}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoriesRow}
      >
        {categories.map((category) => (
          <Pressable
            key={category.id}
            onPress={() => onPressCategory(category)}
            style={styles.categoryCard}
          >
            <View style={styles.categoryImageWrap}>
              {category.image ? (
                <ExpoImage
                  source={{ uri: category.image }}
                  style={styles.categoryImage}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                />
              ) : null}
            </View>
            <Text style={styles.categoryName} numberOfLines={1}>
              {category.name}
            </Text>
            <Text style={styles.categoryCount} numberOfLines={1}>
              {t("homePage.categoryProducts", {
                count: category.productsCount,
                defaultValue: `${category.productsCount} products`,
              })}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function LoyaltyStats({ profile, loading, onOpen, t }) {
  if (loading && !profile) {
    return (
      <View style={styles.loyaltyRow}>
        <View style={styles.loyaltySkeletonLarge} />
        <View style={styles.loyaltyColumn}>
          <View style={styles.loyaltySkeletonSmall} />
          <View style={styles.loyaltySkeletonSmall} />
        </View>
      </View>
    );
  }
  if (!profile) return null;

  const points = parseLoyaltyNumber(profile.total_earned_points) ?? 0;
  const progress = Math.round(Math.max(
    0,
    Math.min(100, parseLoyaltyNumber(profile.tier_progress_percent) ?? 0),
  ));
  const arcLength = 350;
  const progressArcLength = Math.max(0.1, (progress / 100) * arcLength);
  const tierName =
    profile.tier_name ||
    profile.current_tier_name ||
    t("homePage.progress.defaultTier", "ÐÐ¾Ð²Ð¸Ñ‡Ð¾Ðº");
  const nextTier =
    profile.next_tier_name ||
    profile.nextTierName ||
    t("homePage.progress.nextTier", "Ð­ÐºÑÐ¿ÐµÑ€Ñ‚");
  const pointsToNextTier =
    profile.points_to_next_tier ?? profile.pointsToNextTier ?? points;
  const pointsText = `${formatLoyaltyValue(pointsToNextTier)} ${t(
    "homePage.progress.amount",
    "points",
  )}`;

  return (
    <View style={styles.loyaltyRow}>
      <Pressable onPress={onOpen} style={styles.loyaltyProgressCard}>
        <Svg
          width="100%"
          height={118}
          viewBox="0 0 180 118"
          style={styles.loyaltyArc}
          pointerEvents="none"
        >
          <Path
            d="M-26 114A132 84 0 0 1 206 114"
            stroke="#E6E6EA"
            strokeWidth={6}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M-26 114A132 84 0 0 1 206 114"
            stroke="#16C647"
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={`${progressArcLength} 999`}
            strokeDashoffset={0}
            fill="none"
          />
        </Svg>

        <View style={styles.loyaltyTopContent}>
          <View style={styles.loyaltyTitleRow}>
            <Text style={styles.loyaltyTierTitle} numberOfLines={1}>
              {tierName}
            </Text>
            <Ionicons name="information-circle" size={20} color="#7C7C7C" />
          </View>
          <Text style={styles.loyaltyHint} numberOfLines={2}>
            <Text style={styles.loyaltyProgressInline}>{pointsText}</Text>
            {"\n"}
            {t("homePage.progress.prefix", "to level")}{" "}
            <Text style={styles.loyaltyHintAccent}>{nextTier}</Text>
          </Text>
        </View>

        <View style={styles.loyaltyCenterValue}>
          <Text style={styles.loyaltyPoints} numberOfLines={1}>
            {formatLoyaltyPercent(progress)}
          </Text>
        </View>
      </Pressable>

      <View style={styles.loyaltyColumn}>
        <View style={styles.loyaltyMetricCard}>
          <Text style={styles.metricLabel}>
            {t("homePage.walletNow", "Wallet")}
          </Text>
          <View style={styles.metricRow}>
            <Text style={styles.metricValue} numberOfLines={1}>
              {formatCompactLoyaltyValue(profile.wallet_balance)}
            </Text>
            <Svg width={20} height={20} viewBox="0 0 16 16" fill="none">
              <Circle cx="8" cy="8" r="8" fill="#131314" />
              <Path
                d="M10.684 4.321c.633-.291 1.286.362.995.995l-1.09 2.371a.75.75 0 0 0 0 .626l1.09 2.371c.291.633-.362 1.286-.995.995l-2.371-1.09a.75.75 0 0 0-.626 0l-2.371 1.09c-.633.291-1.286-.362-.995-.995l1.09-2.371a.75.75 0 0 0 0-.626l-1.09-2.371c-.291-.633.362-1.286.995-.995l2.371 1.09a.75.75 0 0 0 .626 0l2.371-1.09Z"
                fill="#fff"
              />
            </Svg>
          </View>
        </View>
        <View style={styles.loyaltyMetricCard}>
          <Text style={styles.metricLabel}>
            {t("homePage.monthlyEarnings", "This month")}
          </Text>
          <View style={styles.metricRow}>
            <Text style={styles.metricValue} numberOfLines={1}>
              {formatCompactLoyaltyValue(profile.savings_month_amount)}
            </Text>
            <View style={styles.growthBadge}>
              <Ionicons name="trending-up" size={14} color="#16C647" />
              <Text style={styles.growthText}>
                {formatLoyaltyPercent(profile.savings_change_percent)}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

export function NativeHomeScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const languageCode = i18n.resolvedLanguage ?? i18n.language ?? "en";
  const [tokens, setTokens] = useState(
    parseTokensString(getStoredAuthTokensSync()),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [stories, setStories] = useState(
    () => homeCache.stories.get(languageCode) ?? [],
  );
  const [banners, setBanners] = useState(
    () => homeCache.banners.get(languageCode) ?? [],
  );
  const [categories, setCategories] = useState(
    () => homeCache.categories.get(languageCode) ?? [],
  );
  const [sections, setSections] = useState(
    () => homeCache.sections.get(languageCode) ?? [],
  );
  const cachedLoyalty = tokens?.access
    ? (readCachedNativeLoyaltyProfileSync(tokens.access)?.profile ?? null)
    : null;
  const [loyaltyProfile, setLoyaltyProfile] = useState(cachedLoyalty);
  const [loading, setLoading] = useState({
    stories: !homeCache.stories.has(languageCode),
    banners: !homeCache.banners.has(languageCode),
    categories: !homeCache.categories.has(languageCode),
    sections: !homeCache.sections.has(languageCode),
    loyalty: Boolean(tokens?.access && !cachedLoyalty),
  });
  const [refreshing, setRefreshing] = useState(false);
  const [activeStoryIndex, setActiveStoryIndex] = useState(null);
  const [activeSheet, setActiveSheet] = useState(null);
  const requestIdRef = useRef(0);
  const headerCache = getHeaderCache();
  const isLoggedIn = Boolean(tokens?.access);
  const hasSearch = searchQuery.trim().length > 0;

  useFocusEffect(
    useCallback(() => {
      setCurrentWebPath("/");
      setTabBarForcedHidden(false);
    }, []),
  );

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

  const loadHome = useCallback(
    async ({ force = false } = {}) => {
      const requestId = ++requestIdRef.current;
      setLoading((current) => ({
        stories:
          force || !homeCache.stories.has(languageCode)
            ? true
            : current.stories,
        banners:
          force || !homeCache.banners.has(languageCode)
            ? true
            : current.banners,
        categories:
          force || !homeCache.categories.has(languageCode)
            ? true
            : current.categories,
        sections:
          force || !homeCache.sections.has(languageCode)
            ? true
            : current.sections,
        loyalty: Boolean(tokens?.access),
      }));

      const nextStoriesPromise =
        !force && homeCache.stories.has(languageCode)
          ? Promise.resolve(homeCache.stories.get(languageCode))
          : fetchStories().then((items) =>
              items
                .filter(
                  (story) =>
                    story?.isActive && (story.previewUrl || story.mediaUrl),
                )
                .map((story, index) => ({
                  ...story,
                  borderColor:
                    story.borderColor ||
                    colorPalette[index % colorPalette.length],
                })),
            );
      const nextBannersPromise =
        !force && homeCache.banners.has(languageCode)
          ? Promise.resolve(homeCache.banners.get(languageCode))
          : fetchMarketingBanners();
      const nextCategoriesPromise =
        !force && homeCache.categories.has(languageCode)
          ? Promise.resolve(homeCache.categories.get(languageCode))
          : getCategories().then((items) =>
              items.filter(
                (category) => category.isActive && category.productsCount > 0,
              ),
            );

      try {
        const [nextStories, nextBanners, nextCategories] = await Promise.all([
          nextStoriesPromise.catch(() => []),
          nextBannersPromise.catch(() => []),
          nextCategoriesPromise.catch(() => []),
        ]);
        if (requestId !== requestIdRef.current) return;
        homeCache.stories.set(languageCode, nextStories);
        homeCache.banners.set(languageCode, nextBanners);
        homeCache.categories.set(languageCode, nextCategories);
        setStories(nextStories);
        setBanners(nextBanners);
        setCategories(nextCategories);
        setLoading((current) => ({
          ...current,
          stories: false,
          banners: false,
          categories: false,
        }));

        const sectionSource =
          !force && homeCache.sections.has(languageCode)
            ? homeCache.sections.get(languageCode)
            : await Promise.all(
                nextCategories.map(async (category) => {
                  const products = await fetchProductList({
                    categoryId: category.id,
                    pageSize: 8,
                  });
                  return {
                    category,
                    products: products.filter(
                      (product) =>
                        String(product.category_id) === String(category.id),
                    ),
                  };
                }),
              ).then((items) =>
                items.filter((section) => section.products.length > 0),
              );
        if (requestId !== requestIdRef.current) return;
        homeCache.sections.set(languageCode, sectionSource);
        setSections(sectionSource);
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading((current) => ({ ...current, sections: false }));
          setRefreshing(false);
        }
      }
    },
    [languageCode, tokens?.access],
  );

  useEffect(() => {
    void loadHome();
  }, [loadHome]);

  useEffect(() => {
    let mounted = true;
    if (!tokens?.access) {
      setLoyaltyProfile(null);
      setLoading((current) => ({ ...current, loyalty: false }));
      return undefined;
    }
    setLoading((current) => ({ ...current, loyalty: true }));
    fetchNativeLoyaltyProfile()
      .then(async (profile) => {
        if (!mounted) return;
        setLoyaltyProfile(profile);
        updateHeaderCache({
          walletBalance: Number(profile?.wallet_balance || 0),
        });
        await writeCachedNativeLoyaltyProfile(tokens.access, profile);
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading((current) => ({ ...current, loyalty: false }));
      });
    return () => {
      mounted = false;
    };
  }, [tokens?.access]);

  const filteredSections = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return sections;
    return sections
      .map((section) => ({
        ...section,
        products: section.products.filter((product) => {
          const name = String(product.name ?? "").toLowerCase();
          const description = String(product.description ?? "").toLowerCase();
          const categoryName = String(
            section.category?.name ?? "",
          ).toLowerCase();
          return (
            name.includes(normalizedQuery) ||
            description.includes(normalizedQuery) ||
            categoryName.includes(normalizedQuery)
          );
        }),
      }))
      .filter((section) => section.products.length > 0);
  }, [searchQuery, sections]);

  const openCategory = useCallback(
    (category) => {
      setCurrentWebPath(`/catalog?category_id=${category.id}`);
      router.push({
        pathname: "/(tabs)/catalog",
        params: { category_id: category.id },
      });
    },
    [router],
  );

  const openProductPath = useCallback(
    (productPath) => {
      const productId = String(productPath || "").match(
        /\/products\/([^/?#]+)/,
      )?.[1];
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

  const openBanner = useCallback(
    (banner) => {
      const actionUrl = String(banner?.actionUrl || "");
      if (!actionUrl) return;
      if (actionUrl.startsWith("/products/")) {
        openProductPath(actionUrl);
        return;
      }
      if (actionUrl.startsWith("/catalog")) {
        setCurrentWebPath(actionUrl);
        router.push("/(tabs)/catalog");
        return;
      }
      if (/^https?:\/\//i.test(actionUrl)) {
        openBrowserAsync(actionUrl).catch(() =>
          Linking.openURL(actionUrl).catch(() => {}),
        );
      }
    },
    [openProductPath, router],
  );

  const openLoyaltySheet = useCallback(() => {
    const points = parseLoyaltyNumber(loyaltyProfile?.total_earned_points) ?? 0;
    const progress = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          parseLoyaltyNumber(loyaltyProfile?.tier_progress_percent) ?? 0,
        ),
      ),
    );
    const tierName =
      loyaltyProfile?.tier_name ||
      loyaltyProfile?.current_tier_name ||
      t("homePage.progress.defaultTier", "Current level");
    const nextTier =
      loyaltyProfile?.next_tier_name ||
      loyaltyProfile?.nextTierName ||
      t("homePage.progress.nextTier", "next level");
    const pointsToNextTier =
      loyaltyProfile?.points_to_next_tier ??
      loyaltyProfile?.pointsToNextTier ??
      0;
    setActiveSheet({
      sheetKey: "loyalty_progress",
      payload: {
        headText: tierName,
        monet: t("homePage.progress.amount", "points"),
        subTextPrefix: `${progress}% ${t(
          "homePage.progress.completed",
          "completed",
        )}. ${formatLoyaltyValue(pointsToNextTier)} ${t(
          "homePage.progress.amount",
          "points",
        )} ${t("homePage.progress.prefix", "to level")}`,
        subTextAccent: nextTier,
        allBalls: points,
        indicatorPercent: progress,
        modalTitle: t("homePage.modalTitle", "How points work"),
        modalBody: t(
          "homePage.modalBody",
          "Earn points for every order and spend them on future purchases.",
        ),
        modalCta: t("homePage.modalCta", "Learn more"),
      },
      options: {},
    });
  }, [loyaltyProfile, t]);

  const handleSheetAction = useCallback(
    (actionId) => {
      if (actionId === "loyalty_info") {
        setActiveSheet(null);
        router.push("/loyalty-info");
      }
    },
    [router],
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadHome({ force: true });
  }, [loadHome]);

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" translucent={false} backgroundColor="#FFFFFF" />
      <NativePageHeader
        title={headerCache.brandTitle || "MIO BEAUTY"}
        isLoggedIn={isLoggedIn}
        walletBalance={Number(
          loyaltyProfile?.wallet_balance ?? headerCache.walletBalance ?? 0,
        )}
        onLoginPress={
          isLoggedIn
            ? undefined
            : () =>
                router.push({
                  pathname: "/onboarding/phone",
                  params: { next: "/(tabs)" },
                })
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 98 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        keyboardShouldPersistTaps="always"
      >
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color="#8D8E94" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t(
              "homePage.searchPlaceholder",
              t("catalogPage.searchPlaceholder"),
            )}
            placeholderTextColor="#8D8E94"
            style={styles.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {hasSearch ? (
            <Pressable
              onPress={() => setSearchQuery("")}
              style={styles.clearSearch}
            >
              <Ionicons name="close" size={16} color="#8D8E94" />
            </Pressable>
          ) : null}
        </View>

        {!hasSearch ? (
          <>
            <StoriesRow
              stories={stories}
              loading={loading.stories}
              onOpen={setActiveStoryIndex}
            />
            <BannerCarousel
              banners={banners}
              loading={loading.banners}
              onPressBanner={openBanner}
            />
            <CategoriesRow
              categories={categories}
              loading={loading.categories}
              onPressCategory={openCategory}
              t={t}
            />
            {isLoggedIn ? (
              <LoyaltyStats
                profile={loyaltyProfile}
                loading={loading.loyalty}
                onOpen={openLoyaltySheet}
                t={t}
              />
            ) : null}
          </>
        ) : null}

        <View style={styles.productsBlock}>
          {loading.sections && !sections.length ? (
            <ProductGridSkeleton />
          ) : filteredSections.length ? (
            filteredSections.map(({ category, products }) => (
              <View key={category.id} style={styles.productSection}>
                <Text style={styles.sectionTitle}>
                  {category.name || t("homePage.productsTitle", "Products")}
                </Text>
                <View style={styles.grid}>
                  {products.map((product) => (
                    <View key={product.id} style={styles.cardCell}>
                      <ProductCard product={product} />
                    </View>
                  ))}
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyBox}>
              {loading.sections ? <ActivityIndicator color="#FE946E" /> : null}
              <Text style={styles.emptyTitle}>
                {t("homePage.productsEmpty", t("catalogPage.noProducts"))}
              </Text>
              <Text style={styles.emptyText}>
                {t(
                  "homePage.productsTryDifferent",
                  t("catalogPage.tryDifferent"),
                )}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <NativeBottomSheet
        mounted={Boolean(activeSheet)}
        visible={Boolean(activeSheet)}
        sheet={activeSheet}
        onClose={() => setActiveSheet(null)}
        onAction={handleSheetAction}
      />
      <NativeStoriesViewer
        items={stories}
        startIndex={activeStoryIndex ?? 0}
        visible={activeStoryIndex !== null}
        onClose={() => setActiveStoryIndex(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  searchBox: {
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F5F5F6",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    color: "#131314",
    fontSize: 15,
    lineHeight: 19,
    paddingVertical: 0,
  },
  clearSearch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  storiesRow: {
    gap: 8,
    paddingTop: 24,
    paddingRight: 16,
  },
  storyButton: {
    width: 96,
    height: 96,
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 2,
    overflow: "hidden",
  },
  storyImage: {
    width: "100%",
    height: "100%",
    borderRadius: 15,
    backgroundColor: "#F5F5F6",
  },
  storySkeleton: {
    width: 96,
    height: 96,
    borderRadius: 18,
    backgroundColor: "#ECECEF",
  },
  bannerRow: {
    gap: 12,
    paddingTop: 24,
    paddingRight: 16,
  },
  bannerCard: {
    height: 192,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#F5F5F6",
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },
  bannerSkeleton: {
    height: 192,
    marginTop: 24,
    borderRadius: 16,
    backgroundColor: "#ECECEF",
  },
  sectionBlock: {
    marginTop: 24,
  },
  sectionTitle: {
    color: "#0B0B0B",
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "700",
    marginBottom: 12,
  },
  sectionTitleSkeleton: {
    width: 120,
    height: 20,
    borderRadius: 999,
    backgroundColor: "#ECECEF",
    marginBottom: 12,
  },
  categoriesRow: {
    gap: 10,
    paddingRight: 16,
  },
  categoryCard: {
    width: 131,
  },
  categoryImageWrap: {
    width: 131,
    height: 119,
    borderRadius: 20,
    backgroundColor: "#F8F8F8",
    overflow: "hidden",
  },
  categoryImage: {
    width: "100%",
    height: "100%",
  },
  categoryName: {
    marginTop: 8,
    color: "#0B0B0B",
    fontSize: 14,
    lineHeight: 16,
    fontWeight: "600",
  },
  categoryCount: {
    marginTop: 3,
    color: "#7C7C7C",
    fontSize: 12,
    lineHeight: 15,
  },
  categorySkeleton: {
    width: 131,
    height: 150,
    borderRadius: 20,
    backgroundColor: "#ECECEF",
  },
  loyaltyRow: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "stretch",
    gap: 4,
    minHeight: 176,
  },
  loyaltyProgressCard: {
    flex: 1,
    height: 176,
    borderRadius: 20,
    backgroundColor: "#F8F8F8",
    overflow: "hidden",
    position: "relative",
  },
  loyaltyArc: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 28,
  },
  loyaltyTopContent: {
    position: "absolute",
    left: 12,
    right: 12,
    top: 12,
  },
  loyaltyTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  loyaltyTierTitle: {
    flex: 1,
    minWidth: 0,
    color: "#0B0B0B",
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "600",
  },
  loyaltyHint: {
    marginTop: 2,
    color: "#7C7C7C",
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "500",
  },
  loyaltyProgressInline: {
    color: "#7C7C7C",
    fontWeight: "500",
  },
  loyaltyHintAccent: {
    color: "#0B0B0B",
    fontWeight: "500",
  },
  loyaltyCenterValue: {
    position: "absolute",
    left: 12,
    right: 12,
    top: 116,
    alignItems: "center",
  },
  loyaltyPoints: {
    color: "#0B0B0B",
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "700",
  },
  loyaltyColumn: {
    flex: 1,
    gap: 4,
  },
  loyaltyMetricCard: {
    flex: 1,
    minHeight: 86,
    borderRadius: 20,
    backgroundColor: "#F8F8F8",
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: "space-between",
  },
  metricLabel: {
    color: "#7C7C7C",
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "600",
  },
  metricRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  metricValue: {
    flexShrink: 1,
    color: "#0B0B0B",
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "600",
  },
  growthBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  growthText: {
    color: "#16C647",
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "700",
  },
  loyaltySkeletonLarge: {
    flex: 1,
    height: 176,
    borderRadius: 20,
    backgroundColor: "#ECECEF",
  },
  loyaltySkeletonSmall: {
    flex: 1,
    minHeight: 86,
    borderRadius: 20,
    backgroundColor: "#ECECEF",
  },
  productsBlock: {
    marginTop: 24,
  },
  productSection: {
    marginBottom: 24,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },
  cardCell: {
    width: "48.5%",
  },
  skeletonCard: {
    minHeight: 260,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    padding: 4,
  },
  skeletonImage: {
    aspectRatio: 1.08,
    borderRadius: 20,
    backgroundColor: "#ECECEF",
  },
  skeletonTitle: {
    width: "82%",
    height: 14,
    borderRadius: 999,
    backgroundColor: "#ECECEF",
    marginTop: 12,
    marginLeft: 4,
  },
  skeletonLine: {
    width: "62%",
    height: 13,
    borderRadius: 999,
    backgroundColor: "#F1F1F3",
    marginTop: 8,
    marginLeft: 4,
  },
  skeletonOrder: {
    height: 45,
    borderRadius: 19,
    backgroundColor: "#F6F6F7",
    marginTop: 12,
  },
  emptyBox: {
    borderRadius: 20,
    backgroundColor: "#F5F5F6",
    paddingHorizontal: 16,
    paddingVertical: 24,
    alignItems: "center",
  },
  emptyTitle: {
    marginTop: 8,
    color: "#131314",
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyText: {
    marginTop: 4,
    color: "#757575",
    fontSize: 14,
    lineHeight: 18,
    textAlign: "center",
  },
});
