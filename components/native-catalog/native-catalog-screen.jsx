import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect, useRoute } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { NativeBottomSheet } from "@/components/native-bottom-sheet";
import { NativePageHeader } from "@/components/native-page-header";
import { ProductCard } from "@/components/product-card";
import { getHeaderCache } from "@/lib/native-header-cache";
import { fetchProductList, getCategories } from "@/lib/native-market-api";
import {
  getStoredAuthTokens,
  getStoredAuthTokensSync,
} from "@/lib/auth-storage";
import {
  setCurrentWebPath,
  setTabBarForcedHidden,
} from "@/lib/tab-bar-visibility";

const catalogProductsCache = new Map();

function parseTokensString(tokensString) {
  if (!tokensString) return null;
  try {
    return JSON.parse(tokensString);
  } catch {
    return null;
  }
}

function parsePriceValue(value, fallback = null) {
  const normalized = String(value ?? "").replace(/[^\d.]/g, "");
  if (!normalized) return fallback;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isPriceFilterActive(price) {
  const min = price?.min?.trim?.() || "";
  const max = price?.max?.trim?.() || "";
  if ((!min || min === "0") && (!max || max === "100000000")) return false;
  return Boolean(min || max);
}

function ProductCardSkeleton() {
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

function CatalogSkeletonHeader() {
  return (
    <View style={styles.controls}>
      <View style={styles.skeletonSearchBox} />
      <View style={styles.skeletonFiltersRow}>
        <View style={styles.skeletonFilterChip} />
        <View style={[styles.skeletonFilterChip, styles.skeletonFilterChipWide]} />
      </View>
    </View>
  );
}

function CatalogSkeletonGrid() {
  return (
    <View style={styles.grid}>
      {Array.from({ length: 6 }).map((_, index) => (
        <View key={index} style={styles.cardCell}>
          <ProductCardSkeleton />
        </View>
      ))}
    </View>
  );
}

function FilterChip({ label, active, onPress, onReset }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.filterChip, active ? styles.filterChipActive : null]}
    >
      <Text style={styles.filterChipText} numberOfLines={1}>
        {label}
      </Text>
      {active ? (
        <Pressable onPress={onReset} hitSlop={8} style={styles.chipIconButton}>
          <Ionicons name="close" size={16} color="#131314" />
        </Pressable>
      ) : (
        <Ionicons name="chevron-down" size={18} color="#131314" />
      )}
    </Pressable>
  );
}

export function NativeCatalogScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const route = useRoute();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const searchInputRef = useRef(null);
  const languageCode = i18n.resolvedLanguage ?? i18n.language ?? "en";
  const initialCategoryId = String(params.category_id ?? "");
  const initialQuery = String(params.q ?? "");
  const [tokens, setTokens] = useState(
    parseTokensString(getStoredAuthTokensSync()),
  );
  const [searchInput, setSearchInput] = useState(initialQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery.trim());
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [filters, setFilters] = useState({ price: { min: "", max: "" } });
  const cacheKey = `${languageCode}::${categoryId}::${searchInput.trim()}`;
  const [products, setProducts] = useState(
    () => catalogProductsCache.get(cacheKey) ?? [],
  );
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(
    () => !catalogProductsCache.get(cacheKey),
  );
  const [refreshing, setRefreshing] = useState(false);
  const [softLoading, setSoftLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeSheet, setActiveSheet] = useState(null);
  const [renderedSheet, setRenderedSheet] = useState(null);
  const requestIdRef = useRef(0);

  useFocusEffect(
    useCallback(() => {
      setCurrentWebPath("/catalog");
      setTabBarForcedHidden(false);
    }, []),
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const stored = await getStoredAuthTokens();
      if (mounted) setTokens(parseTokensString(stored));
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (route?.params?.focusSearch) {
      const timer = setTimeout(() => searchInputRef.current?.focus?.(), 80);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [route?.params?.focusSearch]);

  useEffect(() => {
    let mounted = true;
    getCategories()
      .then((data) => {
        if (!mounted) return;
        setCategories(
          data.filter(
            (category) => category.isActive && category.productsCount > 0,
          ),
        );
      })
      .catch(() => {
        if (mounted) setCategories([]);
      });
    return () => {
      mounted = false;
    };
  }, [languageCode]);

  const loadProducts = useCallback(
    async ({ force = false } = {}) => {
      const requestId = ++requestIdRef.current;
      const trimmedQuery = debouncedSearch;
      const nextCacheKey = `${languageCode}::${categoryId}::${trimmedQuery}`;
      const cachedProducts = catalogProductsCache.get(nextCacheKey);

      if (!force && cachedProducts) {
        setProducts(cachedProducts);
        setLoading(false);
        setSoftLoading(false);
      } else if (products.length > 0) {
        setSoftLoading(true);
      } else {
        setLoading(true);
      }

      try {
        const data = await fetchProductList({
          categoryId: categoryId || undefined,
          search: trimmedQuery || undefined,
        });
        if (requestId !== requestIdRef.current) return;
        catalogProductsCache.set(nextCacheKey, data);
        setProducts(data);
        setError("");
      } catch {
        if (requestId === requestIdRef.current) {
          setError(t("catalogPage.loadError"));
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
          setSoftLoading(false);
        }
      }
    },
    [categoryId, debouncedSearch, languageCode, products.length, t],
  );

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled) void loadProducts();
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [loadProducts]);

  const filterDefs = useMemo(
    () => ({
      category: {
        title: t("catalogPage.filters.categoryTitle"),
        chipLabel: t("catalogPage.filters.categoryChip"),
        options: [
          { label: t("catalogPage.filters.all"), value: "" },
          ...categories.map((category) => ({
            label: category.name,
            value: category.id,
          })),
        ],
      },
      price: {
        title: t("catalogPage.filters.priceTitle"),
        chipLabel: t("catalogPage.filters.priceChip"),
      },
    }),
    [categories, t],
  );

  const visibleProducts = useMemo(() => {
    const minPrice = parsePriceValue(filters.price?.min, 0);
    const maxPrice = parsePriceValue(filters.price?.max, 100000000);

    return products.filter((product) => {
      const productPrice = parsePriceValue(
        product.final_price ?? product.discounted_price ?? product.price,
        0,
      );
      return productPrice >= minPrice && productPrice <= maxPrice;
    });
  }, [filters.price, products]);

  const selectedCategoryLabel =
    filterDefs.category.options.find(
      (option) => String(option.value) === String(categoryId),
    )?.label || filterDefs.category.chipLabel;
  const priceActive = isPriceFilterActive(filters.price);
  const headerCache = getHeaderCache();
  const isLoggedIn = Boolean(tokens?.access);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void loadProducts({ force: true });
  }, [loadProducts]);

  const handleCategoryChange = useCallback((nextCategoryId) => {
    setCategoryId(String(nextCategoryId || ""));
    setActiveSheet(null);
  }, []);

  const activeFilterSheet = useMemo(() => {
    if (!activeSheet) return null;
    const filter = filterDefs[activeSheet];
    if (!filter) return null;

    return {
      sheetKey: "catalog_filter",
      options: { hideClose: false },
      payload: {
        filterKey: activeSheet,
        title: filter.title,
        options: filter.options || [],
        selected: activeSheet === "category" ? categoryId : "",
        price: filters.price,
      },
    };
  }, [activeSheet, categoryId, filterDefs, filters.price]);

  useEffect(() => {
    if (activeFilterSheet) {
      setRenderedSheet(activeFilterSheet);
      return undefined;
    }

    const timer = setTimeout(() => setRenderedSheet(null), 300);
    return () => clearTimeout(timer);
  }, [activeFilterSheet]);

  const handleSheetAction = useCallback(
    (actionId, payload) => {
      if (actionId !== "apply") return;

      const filterKey = payload?.filterKey;
      if (filterKey === "category") {
        handleCategoryChange(payload?.value ?? "");
        return;
      }

      if (filterKey === "price") {
        setFilters({ price: payload?.value ?? { min: "", max: "" } });
        setActiveSheet(null);
      }
    },
    [handleCategoryChange],
  );

  const handleOpenProduct = useCallback(
    (product) => {
      const productId = product?.id;
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

  const renderProduct = useCallback(
    ({ item }) => (
      <View style={styles.cardCell}>
        <ProductCard product={item} onPress={handleOpenProduct} />
      </View>
    ),
    [handleOpenProduct],
  );

  const listHeaderComponent = useMemo(() => {
    if (loading && products.length === 0) return <CatalogSkeletonHeader />;

    return (
      <View style={styles.controls}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color="#8A8A8F" />
          <TextInput
            ref={searchInputRef}
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder={t("catalogPage.searchPlaceholder")}
            placeholderTextColor="#8A8A8F"
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            style={styles.searchInput}
          />
          {searchInput ? (
            <Pressable
              onPress={() => setSearchInput("")}
              style={styles.clearSearch}
            >
              <Ionicons name="close" size={16} color="#747479" />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersRow}
        >
          <FilterChip
            label={selectedCategoryLabel}
            active={Boolean(categoryId)}
            onPress={() => setActiveSheet("category")}
            onReset={() => setCategoryId("")}
          />
          <FilterChip
            label={filterDefs.price.chipLabel}
            active={priceActive}
            onPress={() => setActiveSheet("price")}
            onReset={() => setFilters({ price: { min: "", max: "" } })}
          />
        </ScrollView>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </View>
    );
  }, [
    categoryId,
    error,
    filterDefs.price.chipLabel,
    loading,
    priceActive,
    products.length,
    searchInput,
    selectedCategoryLabel,
    t,
  ]);

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" translucent={false} backgroundColor="#FFFFFF" />
      <View style={styles.headerWrap}>
        <NativePageHeader
          title={t("tabs.catalog")}
          isLoggedIn={isLoggedIn}
          walletBalance={headerCache.walletBalance}
          onLoginPress={
            isLoggedIn
              ? undefined
              : () =>
                  router.push({
                    pathname: "/onboarding/phone",
                    params: { next: "/(tabs)/catalog" },
                  })
          }
        />
      </View>

      <FlatList
        data={loading || softLoading ? [] : visibleProducts}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        renderItem={renderProduct}
        ListHeaderComponent={listHeaderComponent}
        ListEmptyComponent={
          loading || softLoading ? (
            <CatalogSkeletonGrid />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={36} color="#FE946E" />
              <Text style={styles.emptyTitle}>{t("catalogPage.noProducts")}</Text>
              <Text style={styles.emptyText}>
                {t("catalogPage.tryDifferent")}
              </Text>
            </View>
          )
        }
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: 98 + insets.bottom },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        keyboardShouldPersistTaps="always"
      />

      <NativeBottomSheet
        mounted={Boolean(renderedSheet)}
        visible={Boolean(activeFilterSheet)}
        sheet={renderedSheet}
        onClose={() => setActiveSheet(null)}
        onAction={handleSheetAction}
      />
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
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: "#FFFFFF",
  },
  controls: {
    marginBottom: 10,
    gap: 8,
  },
  searchBox: {
    height: 40,
    borderRadius: 999,
    backgroundColor: "#F3F3F3",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    color: "#55565A",
    fontSize: 18,
    lineHeight: 22,
    paddingVertical: 0,
    textAlignVertical: "center",
  },
  clearSearch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  filtersRow: {
    gap: 10,
    paddingRight: 12,
  },
  filterChip: {
    height: 42,
    maxWidth: 230,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "transparent",
    backgroundColor: "#FFFFFF",
    paddingLeft: 16,
    paddingRight: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  filterChipActive: {
    borderColor: "#131314",
  },
  filterChipText: {
    maxWidth: 180,
    color: "#131314",
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "500",
  },
  chipIconButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  skeletonSearchBox: {
    height: 40,
    borderRadius: 999,
    backgroundColor: "#ECECEF",
  },
  skeletonFiltersRow: {
    flexDirection: "row",
    gap: 10,
  },
  skeletonFilterChip: {
    width: 92,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#ECECEF",
  },
  skeletonFilterChipWide: {
    width: 118,
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
    lineHeight: 18,
    textAlign: "center",
  },
  columnWrapper: {
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  cardCell: {
    width: "48%",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
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
  emptyState: {
    marginTop: 36,
    paddingHorizontal: 18,
    paddingVertical: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    marginTop: 12,
    color: "#131314",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyText: {
    marginTop: 6,
    maxWidth: 280,
    color: "#757575",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheet: {
    maxHeight: "78%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 18,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D9D9DE",
    marginBottom: 12,
  },
  sheetHeader: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: {
    color: "#131314",
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "700",
  },
  sheetCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F3F3",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetScroll: {
    marginTop: 8,
  },
  optionRow: {
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F2",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  optionText: {
    flex: 1,
    color: "#131314",
    fontSize: 16,
    lineHeight: 20,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "#C9C9C9",
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterActive: {
    borderColor: "#FE946E",
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#FE946E",
  },
  priceInputs: {
    marginTop: 14,
    flexDirection: "row",
    gap: 10,
  },
  priceInputBlock: {
    flex: 1,
    gap: 7,
  },
  inputLabel: {
    color: "#757575",
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "500",
  },
  priceInput: {
    height: 46,
    borderRadius: 999,
    backgroundColor: "#F3F3F3",
    paddingHorizontal: 14,
    color: "#131314",
    fontSize: 18,
    lineHeight: 22,
    textAlignVertical: "center",
  },
  sheetActions: {
    marginTop: 18,
    flexDirection: "row",
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    height: 46,
    borderRadius: 999,
    backgroundColor: "#F3F3F3",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: "#131314",
    fontSize: 15,
    fontWeight: "600",
  },
  primaryButton: {
    flex: 1,
    height: 46,
    borderRadius: 999,
    backgroundColor: "#FE946E",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
