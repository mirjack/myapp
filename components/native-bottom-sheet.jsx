import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const WINDOW_SIZE = Dimensions.get("window");
const SHEET_CLOSED_Y = WINDOW_SIZE.height;
const SHEET_OPEN_WIDTH = Math.max(100, WINDOW_SIZE.width - 32);
const SHEET_CLOSED_WIDTH = 100;
const SHEET_CLOSED_SCALE = SHEET_CLOSED_WIDTH / SHEET_OPEN_WIDTH;
const SHEET_OPEN_MS = 320;
const SHEET_CLOSE_MS = 280;
const SHEET_DRAG_CLOSE_MS = 500;
const SHEET_CONTENT_REVEAL_MS = 300;
const SHEET_CONTENT_FADE_MS = 620;
const SHEET_DISMISS_DRAG_Y = 34;
const SHEET_DISMISS_VELOCITY_Y = 0;
const SHEET_OPEN_EASING = Easing.bezier(0.22, 1, 0.36, 1);
const SHEET_CONTENT_EASING = Easing.bezier(0.2, 0, 0, 1);
const SHEET_CLOSE_EASING = Easing.bezier(0.32, 0, 0.67, 0);
const SHEET_DRAG_CLOSE_EASING = Easing.out(Easing.cubic);
const PRICE_FILTER_MIN = 0;
const PRICE_FILTER_MAX = 10000000;

const currencyFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
});

function parseNumber(value) {
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
}

function formatCurrency(value) {
  return `${currencyFormatter.format(Math.round(parseNumber(value)))} sum`;
}

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function parsePriceInput(value, fallback) {
  const normalized = String(value ?? "").replace(/[^\d]/g, "");
  if (!normalized) return fallback;
  const parsed = Number(normalized);
  return Number.isFinite(parsed)
    ? clampNumber(parsed, PRICE_FILTER_MIN, PRICE_FILTER_MAX)
    : fallback;
}

function priceToInput(value) {
  return String(
    Math.round(
      clampNumber(Number(value) || 0, PRICE_FILTER_MIN, PRICE_FILTER_MAX),
    ),
  );
}

function computePriceStats(product) {
  const price = parseNumber(product?.price ?? product?.raw?.price ?? 0);
  const rawFinalPrice =
    product?.final_price ??
    product?.discounted_price ??
    product?.raw?.final_price ??
    product?.raw?.discounted_price;
  const finalPrice =
    rawFinalPrice !== undefined && rawFinalPrice !== null
      ? parseNumber(rawFinalPrice)
      : price;
  const parsedDiscountPercent = parseNumber(
    product?.discount_percent ?? product?.raw?.discount_percent ?? 0,
  );
  const computedDiscountPercent = price
    ? Math.max(0, Math.round(((price - finalPrice) / price) * 100))
    : 0;
  const discountLabel =
    parsedDiscountPercent > 0
      ? Math.max(0, Math.round(parsedDiscountPercent))
      : computedDiscountPercent;
  return {
    price,
    finalPrice,
    discountLabel,
    hasDiscount: price > finalPrice && discountLabel > 0,
  };
}

function LoginRequiredSheet({ payload, onAction }) {
  return (
    <View>
      <Image
        source={{ uri: payload?.imageUrl }}
        style={styles.loginImage}
        resizeMode="contain"
      />
      <Text style={styles.loginTitle}>
        {payload?.title || "Login required"}
      </Text>
      <Text style={styles.loginDescription}>{payload?.description || ""}</Text>
      <Pressable
        style={styles.loginButton}
        onPress={() => onAction?.("login", null)}
      >
        <Text style={styles.loginButtonText}>
          {payload?.loginText || "Login"}
        </Text>
      </Pressable>
    </View>
  );
}

function LanguageSelectSheet({ payload, onAction }) {
  const options = Array.isArray(payload?.options) ? payload.options : [];
  return (
    <View>
      <Text style={styles.sectionTitle}>{payload?.title || "Language"}</Text>
      <Text style={styles.sectionDescription}>
        {payload?.description || ""}
      </Text>
      <View style={styles.languageList}>
        {options.map((option) => {
          const isSelected = payload?.selectedLang === option.code;
          return (
            <Pressable
              key={option.code}
              style={[
                styles.languageRow,
                isSelected ? styles.languageRowSelected : null,
              ]}
              onPress={() =>
                onAction?.("select_language", { code: String(option.code) })
              }
            >
              <View
                style={[styles.radio, isSelected ? styles.radioChecked : null]}
              />
              <Text style={styles.languageText}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ContactInfoSheet({ payload }) {
  return (
    <View>
      <Text style={styles.sectionTitle}>{payload?.title || "Contact"}</Text>
      <Text style={styles.sectionDescription}>
        {payload?.description || ""}
      </Text>
      <View style={styles.contactCard}>
        <Text style={styles.contactLabel}>
          {payload?.phoneLabel || "Phone"}
        </Text>
        <Text style={styles.contactPhone}>{payload?.phoneNumber || ""}</Text>
      </View>
      <Text style={styles.contactWorkHours}>{payload?.workHours || ""}</Text>
    </View>
  );
}

function CatalogFilterSheet({ payload, onAction }) {
  const filterKey = payload?.filterKey || "price";
  const initialMinPrice = parsePriceInput(
    payload?.price?.min,
    PRICE_FILTER_MIN,
  );
  const initialMaxPrice = parsePriceInput(
    payload?.price?.max,
    PRICE_FILTER_MAX,
  );
  const initialMinValue = Math.min(initialMinPrice, initialMaxPrice);
  const initialMaxValue = Math.max(initialMinPrice, initialMaxPrice);
  const initialSelectedValue = String(payload?.selected ?? "");
  const [minValue, setMinValue] = useState(initialMinValue);
  const [maxValue, setMaxValue] = useState(initialMaxValue);
  const [minPrice, setMinPrice] = useState(priceToInput(initialMinValue));
  const [maxPrice, setMaxPrice] = useState(priceToInput(initialMaxValue));
  const [selectedValue, setSelectedValue] = useState(initialSelectedValue);
  const options = Array.isArray(payload?.options) ? payload.options : [];

  const syncMinPrice = useCallback(
    (nextValue) => {
      const next = clampNumber(nextValue, PRICE_FILTER_MIN, maxValue);
      setMinValue(next);
      setMinPrice(priceToInput(next));
    },
    [maxValue],
  );

  const syncMaxPrice = useCallback(
    (nextValue) => {
      const next = clampNumber(nextValue, minValue, PRICE_FILTER_MAX);
      setMaxValue(next);
      setMaxPrice(priceToInput(next));
    },
    [minValue],
  );

  const applyFilter = () => {
    if (!isApplyEnabled) return;
    onAction?.("apply", {
      filterKey,
      value:
        filterKey === "price"
          ? { min: priceToInput(minValue), max: priceToInput(maxValue) }
          : selectedValue,
    });
  };
  const isApplyEnabled =
    filterKey === "price"
      ? minValue !== initialMinValue || maxValue !== initialMaxValue
      : selectedValue !== initialSelectedValue;

  if (filterKey === "price") {
    return (
      <View style={styles.catalogFilterWrap}>
        <Text style={styles.catalogFilterTitle}>
          {payload?.title || "Цена"}
        </Text>
        <View style={styles.priceInputRow}>
          <View style={styles.priceInputBox}>
            <Text style={styles.priceInputPrefix}>от</Text>
            <TextInput
              value={minPrice}
              onChangeText={(text) => {
                setMinPrice(text);
                syncMinPrice(parsePriceInput(text, PRICE_FILTER_MIN));
              }}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor="#131314"
              style={styles.priceInput}
            />
            {/* {minPrice ? (
              <Pressable
                style={styles.priceInputClear}
                onPress={() => syncMinPrice(PRICE_FILTER_MIN)}
              >
                <Ionicons name="close" size={12} color="#fff" />
              </Pressable>
            ) : null} */}
          </View>
          <View style={[styles.priceInputBox, styles.priceInputBoxMuted]}>
            <Text style={styles.priceInputPrefix}>до</Text>
            <TextInput
              value={maxPrice}
              onChangeText={(text) => {
                setMaxPrice(text);
                syncMaxPrice(parsePriceInput(text, PRICE_FILTER_MAX));
              }}
              keyboardType="number-pad"
              placeholder="100000000"
              placeholderTextColor="#131314"
              style={styles.priceInput}
            />
            {/* {maxPrice ? (
              <Pressable
                style={styles.priceInputClear}
                onPress={() => syncMaxPrice(PRICE_FILTER_MAX)}
              >
                <Ionicons name="close" size={12} color="#fff" />
              </Pressable>
            ) : null} */}
          </View>
        </View>
        <View style={styles.catalogFilterDivider} />
        <Pressable
          style={[
            styles.catalogApplyButton,
            isApplyEnabled ? styles.catalogApplyButtonActive : null,
          ]}
          onPress={applyFilter}
          disabled={!isApplyEnabled}
        >
          <Text
            style={[
              styles.catalogApplyButtonText,
              isApplyEnabled ? styles.catalogApplyButtonTextActive : null,
            ]}
          >
            Применить
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.catalogFilterWrap}>
      <Text style={styles.catalogFilterTitle}>
        {payload?.title || "Фильтр"}
      </Text>
      <View style={styles.catalogOptionGrid}>
        {options.map((option) => {
          const value = String(option.value ?? option.label ?? "");
          const isActive = selectedValue === value;
          return (
            <Pressable
              key={value}
              style={[
                styles.catalogOptionPill,
                isActive ? styles.catalogOptionPillActive : null,
              ]}
              onPress={() => setSelectedValue(value)}
            >
              <Text
                style={[
                  styles.catalogOptionText,
                  isActive ? styles.catalogOptionTextActive : null,
                ]}
              >
                {option.label || value}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        style={[
          styles.catalogApplyButton,
          isApplyEnabled ? styles.catalogApplyButtonActive : null,
        ]}
        onPress={applyFilter}
        disabled={!isApplyEnabled}
      >
        <Text
          style={[
            styles.catalogApplyButtonText,
            isApplyEnabled ? styles.catalogApplyButtonTextActive : null,
          ]}
        >
          Применить
        </Text>
      </Pressable>
    </View>
  );
}

function CashbackPill({ children, style }) {
  return (
    <LinearGradient
      colors={["#FAF56C", "#7EFDEC"]}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={[styles.cashbackPill, style]}
    >
      <Svg
        style={styles.cashbackIcon}
        width={16}
        height={16}
        viewBox="0 0 16 16"
        fill="none"
      >
        <Path
          d="M8 0C12.4183 0 16 3.58172 16 8C16 12.4183 12.4183 16 8 16C3.58172 16 0 12.4183 0 8C0 3.58172 3.58172 0 8 0ZM11.6787 5.31641C11.9696 4.68384 11.3162 4.03042 10.6836 4.32129L8.31348 5.41113C8.1146 5.50258 7.8854 5.50258 7.68652 5.41113L5.31641 4.32129C4.68384 4.03042 4.03042 4.68384 4.32129 5.31641L5.41113 7.68652C5.50258 7.8854 5.50258 8.1146 5.41113 8.31348L4.32129 10.6836C4.03042 11.3162 4.68384 11.9696 5.31641 11.6787L7.68652 10.5889C7.8854 10.4974 8.1146 10.4974 8.31348 10.5889L10.6836 11.6787C11.3162 11.9696 11.9696 11.3162 11.6787 10.6836L10.5889 8.31348C10.4974 8.1146 10.4974 7.8854 10.5889 7.68652L11.6787 5.31641Z"
          fill="#0B0B0B"
        />
      </Svg>
      <Text style={styles.cashbackText}>{children}</Text>
    </LinearGradient>
  );
}

function getProductImageSlides(product) {
  const urls = [
    product?.image_url,
    product?.image,
    product?.raw?.image_url,
    product?.raw?.image,
    ...(Array.isArray(product?.images) ? product.images : []).map((entry) =>
      typeof entry === "string" ? entry : (entry?.image_url ?? entry?.image),
    ),
    ...(Array.isArray(product?.raw?.images) ? product.raw.images : []).map(
      (entry) =>
        typeof entry === "string" ? entry : (entry?.image_url ?? entry?.image),
    ),
  ].filter(Boolean);

  return Array.from(new Set(urls));
}

function ProductImageSlide({ imageUrl, width, onPress }) {
  return (
    <View style={[styles.productImageSlide, { width }]}>
      <Animated.View style={styles.productImageAnimated}>
        <Pressable style={styles.productImagePressable} onPress={onPress}>
          <Image
            source={{ uri: imageUrl }}
            style={styles.productImage}
            resizeMode="cover"
          />
        </Pressable>
      </Animated.View>
    </View>
  );
}

function ProductSheetSkeleton() {
  return (
    <View style={styles.skeletonRoot}>
      <View style={styles.skeletonImage} />
      <View style={styles.skeletonBody}>
        <View style={styles.skeletonHeaderRow}>
          <View style={styles.skeletonBadgeRow}>
            <View style={styles.skeletonCashbackBadge} />
            <View style={styles.skeletonDiscountBadge} />
          </View>
          <View style={styles.skeletonPriceColumn}>
            <View style={styles.skeletonPriceSmall} />
            <View style={styles.skeletonPriceLarge} />
          </View>
        </View>
        <View style={styles.skeletonTitle} />
        <View style={styles.skeletonLine} />
        <View style={styles.skeletonLineShort} />
      </View>
      <View style={styles.skeletonButton} />
    </View>
  );
}

function ProductDetailSheet({ payload, onAction }) {
  const product = payload?.product;
  const quantity = Math.max(0, Number(payload?.quantity || 0));
  const isLoading = Boolean(payload?.isLoading);
  const isCartPending = Boolean(payload?.isCartPending);
  const error = payload?.error;
  const priceStats = computePriceStats(product);
  const totalOrderPrice = priceStats.finalPrice * quantity;
  const cashbackValue = Math.max(0, Math.round(totalOrderPrice * 0.03));
  const imageSlides = useMemo(() => getProductImageSlides(product), [product]);
  const carouselSlides = useMemo(() => {
    if (imageSlides.length <= 1) return imageSlides;
    return [
      imageSlides[imageSlides.length - 1],
      ...imageSlides,
      imageSlides[0],
    ];
  }, [imageSlides]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isImageViewerVisible, setIsImageViewerVisible] = useState(false);
  const [imageSliderWidth, setImageSliderWidth] = useState(0);
  const [viewerWidth, setViewerWidth] = useState(0);
  const imageListRef = useRef(null);
  const viewerListRef = useRef(null);
  const activeImageIndexRef = useRef(0);
  const imageScrollX = useSharedValue(0);
  const viewerDismissPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          gestureState.dy > 2 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
        onMoveShouldSetPanResponderCapture: (_, gestureState) =>
          gestureState.dy > 2 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: (_, gestureState) => {
          if (
            gestureState.dy > SHEET_DISMISS_DRAG_Y ||
            gestureState.vy > SHEET_DISMISS_VELOCITY_Y
          ) {
            setIsImageViewerVisible(false);
          }
        },
      }),
    [],
  );
  const setActiveImage = useCallback((nextIndex) => {
    if (activeImageIndexRef.current === nextIndex) return;
    activeImageIndexRef.current = nextIndex;
    setActiveImageIndex(nextIndex);
  }, []);
  const resolveRealImageIndex = useCallback(
    (virtualIndex) => {
      if (imageSlides.length <= 1) return 0;
      if (virtualIndex <= 0) return imageSlides.length - 1;
      if (virtualIndex >= imageSlides.length + 1) return 0;
      return virtualIndex - 1;
    },
    [imageSlides.length],
  );
  const updateActiveImageFromOffset = useCallback(
    (offsetX) => {
      const virtualIndex = Math.round(offsetX / Math.max(imageSliderWidth, 1));
      setActiveImage(resolveRealImageIndex(virtualIndex));
    },
    [imageSliderWidth, resolveRealImageIndex, setActiveImage],
  );
  useEffect(() => {
    activeImageIndexRef.current = 0;
    setActiveImageIndex(0);
    if (imageSlides.length > 1 && imageSliderWidth > 1) {
      imageScrollX.value = imageSliderWidth;
      requestAnimationFrame(() => {
        imageListRef.current?.scrollToIndex({
          index: 1,
          animated: false,
        });
      });
    }
  }, [imageScrollX, imageSliderWidth, imageSlides.length, product?.id]);

  if (error && !product) {
    return (
      <View style={styles.productErrorWrap}>
        <Text style={styles.productTitle}>Product</Text>
        <Text style={styles.productError}>{error}</Text>
      </View>
    );
  }

  if (isLoading && !product) {
    return <ProductSheetSkeleton />;
  }

  if (!product) {
    return null;
  }

  return (
    <>
      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        contentContainerStyle={styles.productScrollContent}
      >
        <View
          style={styles.productImageWrap}
          onLayout={(event) => {
            const nextWidth = Math.round(event.nativeEvent.layout.width);
            if (nextWidth > 0 && nextWidth !== imageSliderWidth) {
              setImageSliderWidth(nextWidth);
            }
          }}
        >
          {imageSlides.length > 0 && imageSliderWidth > 0 ? (
            <>
              <Animated.FlatList
                key={`${product.id || "product"}-${imageSliderWidth}-${imageSlides.length}`}
                ref={imageListRef}
                data={carouselSlides}
                horizontal
                pagingEnabled={false}
                nestedScrollEnabled
                directionalLockEnabled
                bounces={imageSlides.length > 1}
                scrollEnabled={imageSlides.length > 1}
                decelerationRate="fast"
                snapToInterval={imageSliderWidth}
                snapToAlignment="start"
                disableIntervalMomentum
                scrollEventThrottle={16}
                showsHorizontalScrollIndicator={false}
                removeClippedSubviews={false}
                initialNumToRender={carouselSlides.length}
                maxToRenderPerBatch={carouselSlides.length}
                windowSize={Math.max(3, carouselSlides.length)}
                initialScrollIndex={imageSlides.length > 1 ? 1 : 0}
                contentOffset={
                  imageSlides.length > 1
                    ? { x: imageSliderWidth, y: 0 }
                    : undefined
                }
                keyExtractor={(imageUrl, index) => `${imageUrl}-${index}`}
                getItemLayout={(_, index) => ({
                  length: imageSliderWidth,
                  offset: imageSliderWidth * index,
                  index,
                })}
                onScrollToIndexFailed={(info) => {
                  requestAnimationFrame(() => {
                    imageListRef.current?.scrollToOffset({
                      offset: info.averageItemLength * info.index,
                      animated: false,
                    });
                  });
                }}
                onScroll={(event) => {
                  const offsetX = event.nativeEvent.contentOffset.x;
                  imageScrollX.value = offsetX;
                  updateActiveImageFromOffset(offsetX);
                }}
                onMomentumScrollEnd={(event) => {
                  const nextVirtualIndex = Math.round(
                    event.nativeEvent.contentOffset.x / imageSliderWidth,
                  );
                  if (imageSlides.length <= 1) {
                    setActiveImage(0);
                    return;
                  }

                  if (nextVirtualIndex <= 0) {
                    const resetOffset = imageSlides.length * imageSliderWidth;
                    setActiveImage(imageSlides.length - 1);
                    imageListRef.current?.scrollToOffset({
                      offset: resetOffset,
                      animated: false,
                    });
                    imageScrollX.value = resetOffset;
                    return;
                  }

                  if (nextVirtualIndex >= carouselSlides.length - 1) {
                    setActiveImage(0);
                    imageListRef.current?.scrollToOffset({
                      offset: imageSliderWidth,
                      animated: false,
                    });
                    imageScrollX.value = imageSliderWidth;
                    return;
                  }

                  setActiveImage(nextVirtualIndex - 1);
                }}
                renderItem={({ item: imageUrl, index }) => (
                  <ProductImageSlide
                    imageUrl={imageUrl}
                    width={imageSliderWidth}
                    onPress={() => {
                      const nextVirtualIndex = Math.max(
                        0,
                        Math.min(index, carouselSlides.length - 1),
                      );
                      setActiveImage(resolveRealImageIndex(nextVirtualIndex));
                      setIsImageViewerVisible(true);
                    }}
                  />
                )}
              />
              {imageSlides.length > 1 ? (
                <View style={styles.productImageCounter}>
                  <Text style={styles.productImageCounterText}>
                    {activeImageIndex + 1} / {imageSlides.length}
                  </Text>
                  <View style={styles.productImageProgress}>
                    {imageSlides.map((imageUrl, index) => (
                      <View
                        key={`${imageUrl}-progress-${index}`}
                        style={[
                          styles.productImageProgressSegment,
                          index === activeImageIndex
                            ? styles.productImageProgressSegmentActive
                            : null,
                        ]}
                      />
                    ))}
                  </View>
                </View>
              ) : null}
            </>
          ) : null}
        </View>

        <View style={styles.productDetails}>
          {quantity === 0 ? (
            <View style={styles.priceHeader}>
              <View style={styles.priceBadges}>
                <CashbackPill style={styles.priceCashback}>+3%</CashbackPill>
                {priceStats.discountLabel > 0 ? (
                  <View style={styles.discountBadge}>
                    <Text style={styles.discountBadgeText}>
                      -{priceStats.discountLabel}%
                    </Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.priceColumn}>
                {priceStats.hasDiscount ? (
                  <Text style={styles.oldPrice}>
                    {currencyFormatter.format(Math.round(priceStats.price))}
                  </Text>
                ) : null}
                <Text style={styles.finalPrice}>
                  {formatCurrency(priceStats.finalPrice)}
                </Text>
              </View>
            </View>
          ) : null}

          <View style={quantity === 0 ? styles.titleRaised : null}>
            <Text style={styles.productTitle}>{product.name}</Text>
            <Text style={styles.productDescription}>
              {product.description || " "}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.productOrderSection,
            quantity > 0 ? styles.productOrderSectionActive : null,
          ]}
        >
          {quantity > 0 ? (
            <View style={styles.cartSummaryWrap}>
              <View style={styles.cartSummary}>
                <View>
                  <Text style={styles.cartSummaryLabel}>Cashback</Text>
                  <CashbackPill>+{formatCurrency(cashbackValue)}</CashbackPill>
                </View>
                <View style={styles.cartTotalColumn}>
                  {priceStats.hasDiscount ? (
                    <Text style={styles.oldPrice}>
                      {formatCurrency(priceStats.price * quantity)}
                    </Text>
                  ) : null}
                  <Text style={styles.cartTotal}>
                    {formatCurrency(totalOrderPrice)}
                  </Text>
                </View>
              </View>
              <View style={styles.quantityRow}>
                <Pressable
                  style={styles.catalogButton}
                  onPress={() => onAction?.("catalog", null)}
                >
                  <Text style={styles.catalogButtonText}>В каталог</Text>
                </Pressable>
                <View style={styles.quantityControl}>
                  <Pressable
                    style={styles.quantityButton}
                    onPress={() => onAction?.("decrement", null)}
                    disabled={isCartPending}
                  >
                    <Text style={styles.quantityButtonText}>-</Text>
                  </Pressable>
                  <Text style={styles.quantityValue}>{quantity}</Text>
                  <Pressable
                    style={styles.quantityButton}
                    onPress={() => onAction?.("increment", null)}
                    disabled={isCartPending}
                  >
                    <Text style={styles.quantityButtonText}>+</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ) : (
            <Pressable
              style={styles.addToCartButton}
              onPress={() => onAction?.("add_to_cart", null)}
              disabled={isCartPending}
            >
              {isCartPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.addToCartText}>Add to cart</Text>
              )}
            </Pressable>
          )}
        </View>
      </ScrollView>
      <Modal
        visible={isImageViewerVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setIsImageViewerVisible(false)}
      >
        <View
          style={styles.imageViewerRoot}
          {...viewerDismissPanResponder.panHandlers}
          onLayout={(event) => {
            const nextWidth = Math.round(event.nativeEvent.layout.width);
            if (nextWidth > 0 && nextWidth !== viewerWidth) {
              setViewerWidth(nextWidth);
            }
          }}
        >
          <Pressable
            style={styles.imageViewerBackdrop}
            onPress={() => setIsImageViewerVisible(false)}
          />
          <Pressable
            style={styles.imageViewerClose}
            onPress={() => setIsImageViewerVisible(false)}
          >
            <BlurView
              intensity={32}
              tint="light"
              style={styles.imageViewerCloseBlur}
            >
              <Ionicons name="close" size={22} color="#000" />
            </BlurView>
          </Pressable>
          <View style={styles.imageViewerContent} pointerEvents="box-none">
            {viewerWidth > 0 && imageSlides.length > 0 ? (
              <Animated.FlatList
                key={`viewer-${viewerWidth}-${imageSlides.length}`}
                ref={viewerListRef}
                data={imageSlides}
                horizontal
                pagingEnabled
                directionalLockEnabled
                bounces={imageSlides.length > 1}
                scrollEnabled={imageSlides.length > 1}
                decelerationRate="fast"
                disableIntervalMomentum
                showsHorizontalScrollIndicator={false}
                removeClippedSubviews={false}
                initialNumToRender={imageSlides.length}
                maxToRenderPerBatch={imageSlides.length}
                windowSize={Math.max(3, imageSlides.length)}
                initialScrollIndex={activeImageIndex}
                getItemLayout={(_, index) => ({
                  length: viewerWidth,
                  offset: viewerWidth * index,
                  index,
                })}
                keyExtractor={(imageUrl, index) =>
                  `${imageUrl}-viewer-${index}`
                }
                onScrollToIndexFailed={(info) => {
                  requestAnimationFrame(() => {
                    viewerListRef.current?.scrollToOffset({
                      offset: info.averageItemLength * info.index,
                      animated: false,
                    });
                  });
                }}
                onMomentumScrollEnd={(event) => {
                  const nextIndex = Math.round(
                    event.nativeEvent.contentOffset.x /
                      Math.max(viewerWidth, 1),
                  );
                  setActiveImage(
                    Math.max(0, Math.min(nextIndex, imageSlides.length - 1)),
                  );
                }}
                renderItem={({ item: imageUrl }) => (
                  <Pressable
                    style={[
                      styles.imageViewerImageWrap,
                      { width: viewerWidth },
                    ]}
                  >
                    <Image
                      source={{ uri: imageUrl }}
                      style={styles.imageViewerImage}
                      resizeMode="contain"
                    />
                  </Pressable>
                )}
              />
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

function renderSheetContent(sheet, onAction) {
  if (!sheet) return null;
  if (sheet.sheetKey === "login_required") {
    return <LoginRequiredSheet payload={sheet.payload} onAction={onAction} />;
  }
  if (sheet.sheetKey === "language_select") {
    return <LanguageSelectSheet payload={sheet.payload} onAction={onAction} />;
  }
  if (sheet.sheetKey === "contact_info") {
    return <ContactInfoSheet payload={sheet.payload} />;
  }
  if (sheet.sheetKey === "catalog_filter") {
    return <CatalogFilterSheet payload={sheet.payload} onAction={onAction} />;
  }
  if (sheet.sheetKey === "product_detail") {
    return <ProductDetailSheet payload={sheet.payload} onAction={onAction} />;
  }

  return (
    <View>
      <Text style={styles.fallbackTitle}>Sheet</Text>
      <Text style={styles.fallbackText}>
        Unsupported sheet: {sheet.sheetKey}
      </Text>
    </View>
  );
}

export function NativeBottomSheet({
  mounted,
  visible,
  sheet,
  onClose,
  onAction,
}) {
  const contentRevealTimerRef = useRef(null);
  const contentRevealFrameRef = useRef(null);
  const isDragClosingRef = useRef(false);
  const [isOpening, setIsOpening] = useState(false);
  const sheetTranslateY = useSharedValue(SHEET_CLOSED_Y);
  const sheetWidth = useSharedValue(SHEET_CLOSED_WIDTH);
  const sheetScaleX = useSharedValue(1);
  const sheetOpacity = useSharedValue(0);
  const contentOpacity = useSharedValue(1);
  const skeletonOpacity = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (contentRevealTimerRef.current) {
      clearTimeout(contentRevealTimerRef.current);
      contentRevealTimerRef.current = null;
    }
    if (contentRevealFrameRef.current) {
      cancelAnimationFrame(contentRevealFrameRef.current);
      contentRevealFrameRef.current = null;
    }

    if (visible) {
      isDragClosingRef.current = false;
      const shouldDelayContent = sheet?.sheetKey === "product_detail";
      setIsOpening(shouldDelayContent);
      contentOpacity.value = shouldDelayContent ? 0 : 1;
      skeletonOpacity.value = shouldDelayContent ? 1 : 0;
      sheetScaleX.value = 1;
      if (shouldDelayContent) {
        contentRevealTimerRef.current = setTimeout(() => {
          contentRevealFrameRef.current = requestAnimationFrame(() => {
            contentOpacity.value = withTiming(1, {
              duration: SHEET_CONTENT_FADE_MS,
              easing: SHEET_CONTENT_EASING,
            });
            skeletonOpacity.value = withTiming(0, {
              duration: SHEET_CONTENT_FADE_MS,
              easing: SHEET_CONTENT_EASING,
            });
            setTimeout(() => {
              setIsOpening(false);
            }, SHEET_CONTENT_FADE_MS);
            contentRevealFrameRef.current = null;
          });
          contentRevealTimerRef.current = null;
        }, SHEET_CONTENT_REVEAL_MS);
      }
      sheetTranslateY.value = SHEET_CLOSED_Y;
      sheetWidth.value = SHEET_CLOSED_WIDTH;
      sheetOpacity.value = 1;
      backdropOpacity.value = withTiming(1, {
        duration: SHEET_OPEN_MS,
        easing: SHEET_OPEN_EASING,
      });
      sheetTranslateY.value = withTiming(0, {
        duration: SHEET_OPEN_MS,
        easing: SHEET_OPEN_EASING,
      });
      sheetWidth.value = withTiming(SHEET_OPEN_WIDTH, {
        duration: SHEET_OPEN_MS,
        easing: SHEET_OPEN_EASING,
      });
      return;
    }
    setIsOpening(false);
    if (isDragClosingRef.current) {
      contentOpacity.value = 1;
      skeletonOpacity.value = 0;
      return;
    }
    contentOpacity.value = 1;
    skeletonOpacity.value = 0;
    backdropOpacity.value = withTiming(0, {
      duration: 180,
      easing: SHEET_CLOSE_EASING,
    });
    sheetOpacity.value = withTiming(0.98, {
      duration: SHEET_CLOSE_MS,
      easing: SHEET_CLOSE_EASING,
    });
    sheetTranslateY.value = withTiming(SHEET_CLOSED_Y, {
      duration: SHEET_CLOSE_MS,
      easing: SHEET_CLOSE_EASING,
    });
    sheetScaleX.value = withTiming(SHEET_CLOSED_SCALE, {
      duration: SHEET_CLOSE_MS,
      easing: SHEET_CLOSE_EASING,
    });
  }, [
    backdropOpacity,
    contentOpacity,
    sheetOpacity,
    sheetScaleX,
    sheetTranslateY,
    sheetWidth,
    skeletonOpacity,
    sheet?.sheetKey,
    visible,
  ]);

  useEffect(
    () => () => {
      if (contentRevealTimerRef.current) {
        clearTimeout(contentRevealTimerRef.current);
      }
      if (contentRevealFrameRef.current) {
        cancelAnimationFrame(contentRevealFrameRef.current);
      }
    },
    [],
  );

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    width: sheetWidth.value,
    opacity: sheetOpacity.value,
    transform: [
      { translateY: sheetTranslateY.value },
      { scaleX: sheetScaleX.value },
    ],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));
  const skeletonStyle = useAnimatedStyle(() => ({
    opacity: skeletonOpacity.value,
  }));
  const dismissSheetFromDrag = useCallback(() => {
    isDragClosingRef.current = true;
    backdropOpacity.value = withTiming(0, {
      duration: 140,
      easing: SHEET_DRAG_CLOSE_EASING,
    });
    sheetOpacity.value = withTiming(0.98, {
      duration: SHEET_DRAG_CLOSE_MS,
      easing: SHEET_DRAG_CLOSE_EASING,
    });
    sheetTranslateY.value = withTiming(SHEET_CLOSED_Y, {
      duration: SHEET_DRAG_CLOSE_MS,
      easing: SHEET_DRAG_CLOSE_EASING,
    });
    sheetScaleX.value = withTiming(SHEET_CLOSED_SCALE, {
      duration: SHEET_DRAG_CLOSE_MS,
      easing: SHEET_DRAG_CLOSE_EASING,
    });
    onClose?.();
  }, [backdropOpacity, onClose, sheetOpacity, sheetScaleX, sheetTranslateY]);
  const dragPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          gestureState.dy > 2 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
        onMoveShouldSetPanResponderCapture: (_, gestureState) =>
          gestureState.dy > 2 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, gestureState) => {
          const nextTranslateY = Math.max(0, gestureState.dy);
          sheetTranslateY.value = nextTranslateY;
          backdropOpacity.value = Math.max(
            0.35,
            1 - nextTranslateY / (WINDOW_SIZE.height * 0.7),
          );
        },
        onPanResponderRelease: (_, gestureState) => {
          if (
            gestureState.dy > SHEET_DISMISS_DRAG_Y ||
            gestureState.vy > SHEET_DISMISS_VELOCITY_Y
          ) {
            dismissSheetFromDrag();
            return;
          }
          sheetTranslateY.value = withTiming(0, {
            duration: 220,
            easing: SHEET_OPEN_EASING,
          });
          backdropOpacity.value = withTiming(1, {
            duration: 220,
            easing: SHEET_OPEN_EASING,
          });
        },
        onPanResponderTerminate: () => {
          sheetTranslateY.value = withTiming(0, {
            duration: 220,
            easing: SHEET_OPEN_EASING,
          });
          backdropOpacity.value = withTiming(1, {
            duration: 220,
            easing: SHEET_OPEN_EASING,
          });
        },
      }),
    [backdropOpacity, dismissSheetFromDrag, sheetTranslateY],
  );

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalRoot}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <Pressable style={styles.backdropTap} onPress={onClose}>
          <Animated.View style={[styles.backdrop, backdropStyle]}>
            <BlurView
              intensity={20}
              tint="light"
              experimentalBlurMethod="dimezisBlurView"
              style={styles.backdropBlur}
            />
            <View style={styles.backdropTint} />
          </Animated.View>
        </Pressable>

        <Animated.View
          style={[styles.sheetWrap, sheetStyle]}
          {...dragPanResponder.panHandlers}
        >
          {sheet?.options?.hideClose ? null : (
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={16} color="#fff" />
            </Pressable>
          )}
          <View style={styles.sheetContentStack}>
            <Animated.View style={contentStyle}>
              {renderSheetContent(sheet, onAction)}
            </Animated.View>
            {isOpening && sheet?.sheetKey === "product_detail" ? (
              <Animated.View
                pointerEvents="none"
                style={[styles.sheetSkeletonOverlay, skeletonStyle]}
              >
                <ProductSheetSkeleton />
              </Animated.View>
            ) : null}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdropTap: {
    ...StyleSheet.absoluteFillObject,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  backdropBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  backdropTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.30)",
  },
  sheetWrap: {
    alignSelf: "center",
    marginBottom: 24,
    borderRadius: 36,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 16,
    maxHeight: "90%",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.18,
    shadowRadius: 30,
    elevation: 24,
  },
  sheetContentStack: {
    position: "relative",
  },
  sheetSkeletonOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#fff",
    zIndex: 1,
  },
  closeBtn: {
    position: "absolute",
    top: 24,
    right: 24,
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.1)",
    zIndex: 2,
  },
  closeText: {
    color: "#fff",
    fontSize: 14,
    lineHeight: 14,
    fontWeight: "700",
  },
  loginImage: {
    width: 116,
    height: 116,
    alignSelf: "center",
  },
  loginTitle: {
    marginTop: 16,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "700",
    color: "#131314",
  },
  loginDescription: {
    marginTop: 8,
    fontSize: 16,
    lineHeight: 22,
    color: "#131314",
  },
  loginButton: {
    marginTop: 16,
    borderRadius: 999,
    backgroundColor: "#FE946E",
    paddingVertical: 12,
    alignItems: "center",
  },
  loginButtonText: {
    color: "#fff",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "700",
  },
  fallbackTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#131314",
  },
  fallbackText: {
    marginTop: 8,
    fontSize: 14,
    color: "#747479",
  },
  sectionTitle: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "700",
    color: "#131314",
  },
  sectionDescription: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 18,
    color: "#747479",
  },
  languageList: {
    marginTop: 12,
    gap: 8,
  },
  languageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#EEF0F5",
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#fff",
  },
  languageRowSelected: {
    backgroundColor: "#F8F8FA",
    borderColor: "#D86F49",
  },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    backgroundColor: "#fff",
  },
  radioChecked: {
    borderColor: "#D86F49",
    backgroundColor: "#D86F49",
  },
  languageText: {
    fontSize: 16,
    lineHeight: 20,
    color: "#131314",
    fontWeight: "500",
  },
  contactCard: {
    marginTop: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#EEF0F5",
    backgroundColor: "#F8FAFF",
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  contactLabel: {
    fontSize: 11,
    lineHeight: 14,
    textTransform: "uppercase",
    letterSpacing: 1.6,
    color: "#6B7280",
    fontWeight: "700",
  },
  contactPhone: {
    marginTop: 4,
    fontSize: 20,
    lineHeight: 24,
    color: "#111827",
    fontWeight: "700",
  },
  contactWorkHours: {
    marginTop: 14,
    fontSize: 14,
    lineHeight: 18,
    color: "#6B7280",
  },
  catalogFilterWrap: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 18,
    gap: 18,
  },
  catalogFilterTitle: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: "700",
    color: "#131314",
  },
  priceInputRow: {
    flexDirection: "row",
    gap: 10,
  },
  priceInputBox: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#131314",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 1,
  },
  priceInputBoxMuted: {
    borderColor: "#CFCFD2",
  },
  priceInputPrefix: {
    fontSize: 16,
    lineHeight: 22,
    color: "#7C7C80",
  },
  priceInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 0,
    fontSize: 16,
    lineHeight: 22,
    color: "#131314",
  },
  priceInputClear: {
    width: 18,
    height: 18,
    borderRadius: 11,
    backgroundColor: "#A9AAAF",
    alignItems: "center",
    justifyContent: "center",
  },
  catalogFilterDivider: {
    height: 1,
    backgroundColor: "#E0E0E0",
  },
  catalogOptionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  catalogOptionPill: {
    borderRadius: 10,
    backgroundColor: "#F4F4F5",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  catalogOptionPillActive: {
    backgroundColor: "#131314",
  },
  catalogOptionText: {
    fontSize: 16,
    lineHeight: 22,
    color: "#131314",
    fontWeight: "500",
  },
  catalogOptionTextActive: {
    color: "#fff",
  },
  catalogApplyButton: {
    height: 46,
    borderRadius: 24,
    backgroundColor: "#F1F1F2",
    alignItems: "center",
    justifyContent: "center",
  },
  catalogApplyButtonActive: {
    backgroundColor: "#FE946E",
  },
  catalogApplyButtonText: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    color: "#BEBFC2",
  },
  catalogApplyButtonTextActive: {
    color: "#fff",
  },
  productScrollContent: {
    gap: 16,
    paddingBottom: 2,
  },
  productImageWrap: {
    height: 360,
    borderRadius: 30,
    overflow: "hidden",
    borderWidth: 0,
  },
  productImage: {
    width: "100%",
    height: "100%",
  },
  productImagePressable: {
    width: "100%",
    height: "100%",
  },
  productImageSlide: {
    height: "100%",
  },
  productImageAnimated: {
    width: "100%",
    height: "100%",
  },
  productImageCounter: {
    position: "absolute",
    bottom: 12,
    left: 16,
    right: 16,
    gap: 8,
  },
  productImageCounterText: {
    alignSelf: "center",
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.35)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    color: "#fff",
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "600",
  },
  productImageProgress: {
    height: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  productImageProgressSegment: {
    flex: 1,
    height: 3,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.45)",
  },
  productImageProgressSegmentActive: {
    backgroundColor: "#fff",
  },
  productDetails: {
    paddingHorizontal: 4,
  },
  priceHeader: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  priceBadges: {
    flexDirection: "row",
    gap: 8,
  },
  cashbackPill: {
    height: 24,
    minWidth: 54,
    borderRadius: 96,
    paddingHorizontal: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  priceCashback: {
    maxWidth: 62,
  },
  cashbackIcon: {
    width: 16,
    height: 16,
  },
  cashbackText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "600",
    color: "#131314",
  },
  discountBadge: {
    height: 24,
    minWidth: 47,
    borderRadius: 8,
    backgroundColor: "#E73C50",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  discountBadgeText: {
    color: "#fff",
    fontSize: 14,
    lineHeight: 16,
    fontWeight: "600",
  },
  priceColumn: {
    alignItems: "flex-end",
    paddingTop: 7,
    gap: 4,
  },
  oldPrice: {
    fontSize: 13,
    lineHeight: 16,
    color: "#7C7C80",
    textDecorationLine: "line-through",
  },
  finalPrice: {
    fontSize: 20,
    lineHeight: 24,
    color: "#131314",
    fontWeight: "600",
  },
  titleRaised: {
    marginTop: -14,
  },
  productTitle: {
    fontSize: 20,
    lineHeight: 24,
    color: "#00031A",
    fontWeight: "600",
    paddingBottom: 8,
  },
  productDescription: {
    minHeight: 36,
    fontSize: 14,
    lineHeight: 18,
    color: "#747479",
  },
  productOrderSection: {
    padding: 4,
  },
  imageViewerRoot: {
    flex: 1,
    backgroundColor: "#fff",
  },
  imageViewerBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  imageViewerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 100,
  },
  imageViewerImageWrap: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  imageViewerImage: {
    width: "100%",
    height: "100%",
  },
  imageViewerClose: {
    position: "absolute",
    top: 56,
    right: 20,
    zIndex: 3,
    width: 44,
    height: 44,
    overflow: "hidden",
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0)",
  },
  imageViewerCloseBlur: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  productOrderSectionActive: {
    padding: 16,
    borderRadius: 24,
    shadowColor: "#000014",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.09,
    shadowRadius: 10,
    elevation: 8,
    backgroundColor: "#fff",
  },
  cartSummaryWrap: {
    gap: 12,
  },
  cartSummary: {
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EDEDEF",
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  cartSummaryLabel: {
    marginBottom: 4,
    fontSize: 13,
    lineHeight: 16,
    color: "#747479",
  },
  cartTotalColumn: {
    alignItems: "flex-start",
  },
  cartTotal: {
    fontSize: 18,
    lineHeight: 24,
    color: "#131314",
    fontWeight: "600",
  },
  quantityRow: {
    height: 45,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  catalogButton: {
    flex: 1,
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#FFECE5",
    alignItems: "center",
    justifyContent: "center",
  },
  catalogButtonText: {
    color: "#FE946E",
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "600",
  },
  quantityControl: {
    width: 150,
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#F6F6F7",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  quantityButton: {
    width: 45,
    height: 45,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  quantityButtonText: {
    fontSize: 24,
    lineHeight: 28,
    color: "#131314",
    fontWeight: "400",
  },
  quantityValue: {
    minWidth: 32,
    textAlign: "center",
    fontSize: 18,
    lineHeight: 24,
    color: "#131314",
    fontWeight: "600",
  },
  addToCartButton: {
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: "#FE946E",
    alignItems: "center",
    justifyContent: "center",
  },
  addToCartText: {
    color: "#fff",
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "600",
  },
  productErrorWrap: {
    padding: 16,
  },
  productError: {
    color: "#E73C50",
    fontSize: 14,
    lineHeight: 18,
  },
  skeletonRoot: {
    gap: 16,
    paddingBottom: 4,
  },
  skeletonImage: {
    height: 360,
    borderRadius: 30,
    backgroundColor: "#F1F3F6",
  },
  skeletonBody: {
    paddingHorizontal: 4,
    gap: 8,
  },
  skeletonHeaderRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  skeletonBadgeRow: {
    flexDirection: "row",
    gap: 8,
  },
  skeletonCashbackBadge: {
    width: 59,
    height: 24,
    borderRadius: 96,
    backgroundColor: "#E7EBF0",
  },
  skeletonDiscountBadge: {
    width: 47,
    height: 24,
    borderRadius: 8,
    backgroundColor: "#E7EBF0",
  },
  skeletonPriceColumn: {
    alignItems: "flex-end",
    gap: 6,
    paddingTop: 7,
  },
  skeletonPriceSmall: {
    width: 56,
    height: 12,
    borderRadius: 999,
    backgroundColor: "#E7EBF0",
  },
  skeletonPriceLarge: {
    width: 82,
    height: 17,
    borderRadius: 8,
    backgroundColor: "#E7EBF0",
  },
  skeletonTitle: {
    width: "72%",
    height: 20,
    borderRadius: 8,
    backgroundColor: "#E7EBF0",
  },
  skeletonLine: {
    width: "100%",
    height: 12,
    borderRadius: 999,
    backgroundColor: "#EEF1F4",
  },
  skeletonLineShort: {
    width: "84%",
    height: 12,
    borderRadius: 999,
    backgroundColor: "#EEF1F4",
  },
  skeletonButton: {
    height: 48,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
    marginHorizontal: 4,
  },
});
