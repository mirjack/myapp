import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { BlurView } from "expo-blur";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import Animated, { useSharedValue } from "react-native-reanimated";

import { SUPPORT_REQUEST_SHEET_ART } from "@/components/support-chat/support-request-sheet-art";
import {
  PRICE_FILTER_MAX,
  PRICE_FILTER_MIN,
  SHEET_DISMISS_DRAG_Y,
  SHEET_DISMISS_VELOCITY_Y,
  clampNumber,
  computePriceStats,
  currencyFormatter,
  formatCurrency,
  parseNumber,
  parsePriceInput,
  priceToInput,
} from "@/components/native-bottom-sheet.shared";
import { styles } from "@/components/native-bottom-sheet.styles";

function LanguageSelectSheet({ payload, onAction }) {
  const options = Array.isArray(payload?.options) ? payload.options : [];
  return (
    <View style={styles.languageSheetWrap}>
      <Text style={styles.languageSheetTitle}>
        {payload?.title || "Language"}
      </Text>
      <Text style={styles.languageSheetDescription}>
        {payload?.description || ""}
      </Text>
      <View style={styles.languageList}>
        {options.map((option) => {
          const isSelected = payload?.selectedLang === option.code;
          return (
            <Pressable
              key={option.code}
              style={styles.languageRow}
              onPress={() =>
                onAction?.("select_language", { code: String(option.code) })
              }
            >
              <View
                style={[styles.radio, isSelected ? styles.radioChecked : null]}
              >
                {isSelected ? <View style={styles.radioDot} /> : null}
              </View>
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
    <View style={styles.compactInfoSheetWrap}>
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

function LogoutConfirmSheet({ payload, onAction }) {
  const isLoading = Boolean(payload?.isLoading);

  return (
    <View style={styles.supportDecisionSheetWrap}>
      <Text style={styles.supportDecisionTitle}>
        {payload?.title || "Logout"}
      </Text>
      <Text style={styles.supportDecisionDescription}>
        {payload?.description || "Are you sure you want to log out?"}
      </Text>

      <View style={styles.supportDecisionActionStack}>
        <Pressable
          disabled={isLoading}
          onPress={() => onAction?.("cancel_logout", null)}
          style={[
            styles.supportDecisionSecondaryButton,
            isLoading ? styles.supportDecisionButtonDisabled : null,
          ]}
        >
          <Text style={styles.supportDecisionSecondaryText}>
            {payload?.secondaryLabel || "No, stay here"}
          </Text>
        </Pressable>

        <Pressable
          disabled={isLoading}
          onPress={() => onAction?.("confirm_logout", null)}
          style={isLoading ? styles.supportDecisionButtonDisabled : null}
        >
          <LinearGradient
            colors={["#FE946E", "#FE946E"]}
            style={styles.supportDecisionPrimaryButton}
          >
            <Text style={styles.supportDecisionPrimaryText}>
              {isLoading
                ? payload?.loadingLabel || "Logging out..."
                : payload?.primaryLabel || "Yes, log out"}
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

function WalletInfoSheet({ payload }) {
  const amount = Number(payload?.amount ?? 0);
  const formattedValue = currencyFormatter.format(
    Math.max(0, Math.round(amount)),
  );
  return (
    <View style={styles.walletSheetWrap}>
      <View style={styles.walletHeroWrap}>
        <LinearGradient
          colors={["#FAF56C", "#7EFDEC"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.walletHeroBase}
        />
        <LinearGradient
          colors={["#FFA483", "#FD7D4F"]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.walletHeroOverlay}
        />

        <View style={styles.walletHeroContent}>
          <View style={styles.walletHeroIconWrap}>
            <Svg width={48} height={48} viewBox="0 0 16 16" fill="none">
              <Path
                d="M8 0C12.4183 0 16 3.58172 16 8C16 12.4183 12.4183 16 8 16C3.58172 16 0 12.4183 0 8C0 3.58172 3.58172 0 8 0ZM8.70312 3.50098C8.46151 2.84801 7.53849 2.84801 7.29688 3.50098L6.3916 5.94824C6.31563 6.15333 6.15334 6.31466 5.94824 6.39062L3.50098 7.29688C2.84817 7.53858 2.84809 8.46151 3.50098 8.70312L5.94824 9.6084C6.15352 9.68437 6.31564 9.84648 6.3916 10.0518L7.29688 12.499C7.53854 13.1518 8.46141 13.1517 8.70312 12.499L9.60938 10.0518C9.68534 9.84663 9.84663 9.68437 10.0518 9.6084L12.499 8.70312C13.152 8.46151 13.152 7.53849 12.499 7.29688L10.0518 6.39062C9.84683 6.31466 9.68537 6.15315 9.60938 5.94824L8.70312 3.50098Z"
                fill="#ffffff"
              />
            </Svg>
          </View>

          <Text style={styles.walletHeroTitle}>
            {payload?.title || "Your bonus balance"}
          </Text>
          <Text style={styles.walletHeroDescription}>
            {payload?.description || "Use bonuses for purchases in the app"}
          </Text>

          <View style={styles.walletHeroDivider} />

          <View style={styles.walletInfoCard}>
            <Text style={styles.walletInfoLabel}>
              {payload?.youHaveLabel || "YOU HAVE"}
            </Text>
            <View style={styles.walletInfoAmountRow}>
              <Text style={styles.walletInfoAmount}>{formattedValue}</Text>
              <Svg width={24} height={24} viewBox="0 0 16 16" fill="none">
                <Path
                  d="M8 0C12.4183 0 16 3.58172 16 8C16 12.4183 12.4183 16 8 16C3.58172 16 0 12.4183 0 8C0 3.58172 3.58172 0 8 0ZM8.70312 3.50098C8.46151 2.84801 7.53849 2.84801 7.29688 3.50098L6.3916 5.94824C6.31563 6.15333 6.15334 6.31466 5.94824 6.39062L3.50098 7.29688C2.84817 7.53858 2.84809 8.46151 3.50098 8.70312L5.94824 9.6084C6.15352 9.68437 6.31564 9.84648 6.3916 10.0518L7.29688 12.499C7.53854 13.1518 8.46141 13.1517 8.70312 12.499L9.60938 10.0518C9.68534 9.84663 9.84663 9.68437 10.0518 9.6084L12.499 8.70312C13.152 8.46151 13.152 7.53849 12.499 7.29688L10.0518 6.39062C9.84683 6.31466 9.68537 6.15315 9.60938 5.94824L8.70312 3.50098Z"
                  fill="#ffffff"
                />
              </Svg>
            </View>
            <Text style={styles.walletInfoNote}>
              {payload?.conversionNote || "1 bonus = 1 sum"}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.walletHelpWrap}>
        <Text style={styles.walletHelpTitle}>
          {payload?.howToSpendTitle || "How to spend bonuses"}
        </Text>
        <Text style={styles.walletHelpText}>
          {payload?.howToSpendDescription ||
            "At checkout, select bonus payment and apply available balance."}
        </Text>
      </View>
    </View>
  );
}

function SupportRequestCreateSheet({ payload, onAction }) {
  const problemImageUrl =
    payload?.problemImageUrl || SUPPORT_REQUEST_SHEET_ART.problem;
  const questionImageUrl =
    payload?.questionImageUrl || SUPPORT_REQUEST_SHEET_ART.question;
  const activeKind = payload?.activeKind || null;

  return (
    <View style={styles.supportCreateSheetWrap}>
      <Text style={styles.supportCreateSheetTitle}>
        {payload?.title || "ÃÅ“Ã‘â€¹ Ã‘â‚¬Ã‘ÂÃÂ´ÃÂ¾ÃÂ¼ ÃÂ¸ ÃÂ³ÃÂ¾Ã‘â€šÃÂ¾ÃÂ²Ã‘â€¹ ÃÂ¿ÃÂ¾ÃÂ¼ÃÂ¾Ã‘â€¡Ã‘Å’"}
      </Text>
      <Text style={styles.supportCreateSheetDescription}>
        {payload?.description ||
          "ÃÅ¸ÃÂ¾ÃÂ´Ã‘ÂÃÂºÃÂ°ÃÂ¶ÃÂ¸Ã‘â€šÃÂµ, ÃÂ¿ÃÂ¾ÃÂ¶ÃÂ°ÃÂ»Ã‘Æ’ÃÂ¹Ã‘ÂÃ‘â€šÃÂ°, Ã‘Æ’ ÃÂ²ÃÂ°Ã‘Â ÃÂ²ÃÂ¾ÃÂ¿Ã‘â‚¬ÃÂ¾Ã‘Â ÃÂ¸ÃÂ»ÃÂ¸ ÃÂ²ÃÂ¾ÃÂ·ÃÂ½ÃÂ¸ÃÂºÃÂ»ÃÂ° ÃÂ¿Ã‘â‚¬ÃÂ¾ÃÂ±ÃÂ»ÃÂµÃÂ¼ÃÂ°?"}
      </Text>

      <View style={styles.supportCreateCardRow}>
        <Pressable
          onPress={() => onAction?.("problem", null)}
          style={[
            styles.supportCreateCard,
            styles.supportCreateProblemCard,
            activeKind === "problem" ? styles.supportCreateCardPressed : null,
          ]}
        >
          <Text
            style={[
              styles.supportCreateCardTitle,
              styles.supportCreateProblemTitle,
            ]}
          >
            {payload?.problemTitle || "ÃÅ¸Ã‘â‚¬ÃÂ¾ÃÂ±ÃÂ»ÃÂµÃÂ¼ÃÂ°"}
          </Text>
          <ExpoImage
            source={{ uri: problemImageUrl }}
            contentFit="contain"
            cachePolicy="memory-disk"
            style={styles.supportCreateProblemImage}
          />
        </Pressable>

        <Pressable
          onPress={() => onAction?.("question", null)}
          style={[
            styles.supportCreateCard,
            styles.supportCreateQuestionCard,
            activeKind === "question" ? styles.supportCreateCardPressed : null,
          ]}
        >
          <Text
            style={[
              styles.supportCreateCardTitle,
              styles.supportCreateQuestionTitle,
            ]}
          >
            {payload?.questionTitle || "Ãâ€™ÃÂ¾ÃÂ¿Ã‘â‚¬ÃÂ¾Ã‘Â"}
          </Text>
          <ExpoImage
            source={{ uri: questionImageUrl }}
            contentFit="contain"
            cachePolicy="memory-disk"
            style={styles.supportCreateQuestionImage}
          />
          {activeKind === "question" ? (
            <Text style={styles.supportCreateLoadingText}>
              {payload?.loadingLabel || "ÃÂ¡ÃÂ¾ÃÂ·ÃÂ´ÃÂ°ÃÂ½ÃÂ¸ÃÂµ..."}
            </Text>
          ) : null}
        </Pressable>
      </View>
    </View>
  );
}

function SupportRequestCloseSheet({ payload, onAction }) {
  const isPendingConfirmation = Boolean(payload?.isPendingConfirmation);
  const isLoading = Boolean(payload?.isLoading);

  return (
    <View style={styles.supportDecisionSheetWrap}>
      <Text style={styles.supportDecisionTitle}>
        {payload?.title || "Close request"}
      </Text>
      <Text style={styles.supportDecisionDescription}>
        {payload?.description ||
          "Confirm that the issue is fully resolved before closing the request."}
      </Text>

      <View style={styles.supportDecisionActionStack}>
        <Pressable
          disabled={isLoading}
          onPress={() => onAction?.("not_resolved", null)}
          style={[
            styles.supportDecisionSecondaryButton,
            isLoading ? styles.supportDecisionButtonDisabled : null,
          ]}
        >
          <Text style={styles.supportDecisionSecondaryText}>
            {isPendingConfirmation
              ? payload?.pendingSecondaryLabel || "Not solved yet"
              : payload?.secondaryLabel || "Not solved yet"}
          </Text>
        </Pressable>

        <Pressable
          disabled={isLoading}
          onPress={() => onAction?.("confirm_resolved", null)}
          style={isLoading ? styles.supportDecisionButtonDisabled : null}
        >
          <LinearGradient
            colors={["#FE946E", "#FE946E"]}
            style={styles.supportDecisionPrimaryButton}
          >
            <Text style={styles.supportDecisionPrimaryText}>
              {isLoading
                ? payload?.loadingLabel || "Saving..."
                : payload?.primaryLabel || "Yes, everything is solved"}
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

function SupportRequestRateSheet({ payload, onAction }) {
  const [ratingValue, setRatingValue] = useState(payload?.ratingValue ?? 5);
  const [comment, setComment] = useState(payload?.comment || "");

  useEffect(() => {
    setRatingValue(payload?.ratingValue ?? 5);
    setComment(payload?.comment || "");
  }, [payload?.comment, payload?.ratingValue]);

  const isSubmitting = Boolean(payload?.isSubmitting);

  return (
    <View style={styles.supportDecisionSheetWrap}>
      <Text style={styles.supportDecisionTitle}>
        {payload?.title || "Rate service"}
      </Text>
      <Text style={styles.supportDecisionDescription}>
        {payload?.description ||
          "Share how the support experience went. A short comment is optional."}
      </Text>

      <View style={styles.supportRateCard}>
        <Text style={styles.supportRateCardTitle}>
          {payload?.ratingLabel || "Your rating"}
        </Text>
        <View style={styles.supportRateRow}>
          {[1, 2, 3, 4, 5].map((value) => {
            const isSelected = value <= ratingValue;
            return (
              <Pressable
                key={value}
                onPress={() => setRatingValue(value)}
                style={[
                  styles.supportRateButton,
                  isSelected ? styles.supportRateButtonActive : null,
                ]}
              >
                <Ionicons
                  name={isSelected ? "star" : "star-outline"}
                  size={20}
                  color={isSelected ? "#FE946E" : "#A0A0A0"}
                />
              </Pressable>
            );
          })}
        </View>
      </View>

      <TextInput
        value={comment}
        onChangeText={setComment}
        placeholder={payload?.commentPlaceholder || "Comment (optional)"}
        placeholderTextColor="#A0A0A0"
        multiline
        textAlignVertical="top"
        style={styles.supportRateInput}
      />

      <View style={styles.supportRateActionRow}>
        <Pressable
          onPress={() => onAction?.("skip_rating", null)}
          style={styles.supportRateSkipButton}
        >
          <Text style={styles.supportRateSkipText}>
            {payload?.skipLabel || "Skip"}
          </Text>
        </Pressable>
        <Pressable
          disabled={isSubmitting}
          onPress={() =>
            onAction?.("submit_rating", {
              ratingValue,
              comment,
            })
          }
          style={[
            styles.supportRateSubmitWrap,
            isSubmitting ? styles.supportDecisionButtonDisabled : null,
          ]}
        >
          <LinearGradient
            colors={["#FE946E", "#FE946E"]}
            style={styles.supportDecisionPrimaryButton}
          >
            <Text style={styles.supportDecisionPrimaryText}>
              {isSubmitting
                ? payload?.loadingLabel || "Saving..."
                : payload?.submitLabel || "Save rating"}
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

function LoyaltyProgressSheet({ payload, onAction }) {
  const points = Math.max(0, Math.round(parseNumber(payload?.allBalls ?? 0)));
  const percent = Math.max(
    0,
    Math.min(100, Math.round(parseNumber(payload?.indicatorPercent ?? 0))),
  );
  return (
    <View style={styles.loyaltySheetWrap}>
      <View style={styles.loyaltyHeaderCard}>
        <Text style={styles.loyaltyHeadText}>{payload?.headText || ""}</Text>
        <Text style={styles.loyaltyPoints}>
          {currencyFormatter.format(points)}
          <Text style={styles.loyaltyPointsSuffix}>
            {" "}
            {payload?.monet || ""}
          </Text>
        </Text>
        <Text style={styles.loyaltySubText}>
          {payload?.subTextPrefix || ""}{" "}
          <Text style={styles.loyaltySubTextAccent}>
            {payload?.subTextAccent || ""}
          </Text>
        </Text>
        <View style={styles.loyaltyProgressTrack}>
          <View
            style={[styles.loyaltyProgressFill, { width: `${percent}%` }]}
          />
        </View>
      </View>

      <View style={styles.loyaltyBody}>
        <Text style={styles.loyaltyBodyTitle}>{payload?.modalTitle || ""}</Text>
        <Text style={styles.loyaltyBodyText}>{payload?.modalBody || ""}</Text>
      </View>

      <Pressable
        style={styles.loyaltyCta}
        onPress={() => onAction?.("loyalty_info", null)}
      >
        <Text style={styles.loyaltyCtaText}>{payload?.modalCta || "Info"}</Text>
      </Pressable>
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

  const isApplyEnabled =
    filterKey === "price"
      ? minValue !== initialMinValue || maxValue !== initialMaxValue
      : selectedValue !== initialSelectedValue;

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

  if (filterKey === "price") {
    return (
      <View style={styles.catalogFilterWrap}>
        <Text style={styles.catalogFilterTitle}>{payload?.title || "Price"}</Text>
        <View style={styles.priceInputRow}>
          <View style={styles.priceInputBox}>
            <Text style={styles.priceInputPrefix}>from</Text>
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
          </View>
          <View style={[styles.priceInputBox, styles.priceInputBoxMuted]}>
            <Text style={styles.priceInputPrefix}>to</Text>
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
            Apply
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.catalogFilterWrap}>
      <Text style={styles.catalogFilterTitle}>{payload?.title || "Filter"}</Text>
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
          Apply
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

export function ProductSheetSkeleton() {
  return (
    <View style={styles.skeletonRoot}>
      <View style={styles.skeletonImage}>
        <View style={styles.skeletonFavoriteButton} />
        <View style={styles.skeletonImageProgress}>
          <View style={styles.skeletonImageProgressActive} />
          <View style={styles.skeletonImageProgressSegment} />
          <View style={styles.skeletonImageProgressSegment} />
          <View style={styles.skeletonImageProgressSegment} />
        </View>
      </View>
      <View style={styles.skeletonDetails}>
        <View style={styles.skeletonBadgeRow}>
          <View style={styles.skeletonCashbackBadge} />
          <View style={styles.skeletonDiscountBadge} />
        </View>
        <View style={styles.skeletonTitleRaised}>
          <View style={styles.skeletonTitle} />
          <View style={styles.skeletonLine} />
          <View style={styles.skeletonLineShort} />
        </View>
      </View>
      <View style={styles.skeletonOrderSection}>
        <View style={styles.skeletonPriceColumn}>
          <View style={styles.skeletonPriceSmall} />
          <View style={styles.skeletonPriceLarge} />
        </View>
        <View style={styles.skeletonButton} />
      </View>
    </View>
  );
}

function ProductFavoriteButton({ isFavorite, isPending, onPress }) {
  return (
    <Pressable
      style={[
        styles.productFavoriteButton,
        isFavorite
          ? styles.productFavoriteButtonActive
          : styles.productFavoriteButtonIdle,
      ]}
      onPress={onPress}
      disabled={isPending}
    >
      <Ionicons
        name={isFavorite ? "heart" : "heart-outline"}
        size={24}
        color="#FFFFFF"
      />
    </Pressable>
  );
}

function ProductPriceBlock({ priceStats, originalPrice, finalPrice }) {
  return (
    <View style={styles.bottomPriceColumn}>
      {priceStats.hasDiscount ? (
        <Text style={styles.bottomOldPrice}>
          {formatCurrency(originalPrice)}
        </Text>
      ) : null}
      <Text style={styles.bottomFinalPrice}>{formatCurrency(finalPrice)}</Text>
    </View>
  );
}

function ProductDetailSheet({ payload, onAction }) {
  const product = payload?.product;
  const quantity = Math.max(0, Number(payload?.quantity || 0));
  const isLoading = Boolean(payload?.isLoading);
  const isCartPending = Boolean(payload?.isCartPending);
  const isFavorite = Boolean(payload?.isFavorite);
  const isFavoritePending = Boolean(payload?.isFavoritePending);
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
          <View style={styles.productImageTopRow}>
            <ProductFavoriteButton
              isFavorite={isFavorite}
              isPending={isFavoritePending}
              onPress={() => onAction?.("favorite_toggle", null)}
            />
          </View>
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
          </View>

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
            <View style={styles.cartSummaryCard}>
              <View style={styles.cartSummary}>
                <Text style={styles.cartSummaryLabel}>Cashback</Text>
                <CashbackPill>+{formatCurrency(cashbackValue)}</CashbackPill>
              </View>
              <View style={styles.cartSummaryDivider} />
              <View style={styles.productFooterRow}>
                <ProductPriceBlock
                  priceStats={priceStats}
                  originalPrice={priceStats.price * quantity}
                  finalPrice={totalOrderPrice}
                />
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
            <View style={styles.productFooterRow}>
              <ProductPriceBlock
                priceStats={priceStats}
                originalPrice={priceStats.price}
                finalPrice={priceStats.finalPrice}
              />
              <Pressable
                style={styles.addToCartButton}
                onPress={() => onAction?.("add_to_cart", null)}
                disabled={isCartPending}
              >
                {isCartPending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.addToCartText}>Add to cart</Text>
                )}
              </Pressable>
            </View>
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

export function renderSheetContent(sheet, onAction) {
  if (!sheet) return null;
  if (sheet.sheetKey === "login_required") {
    return null;
  }
  if (sheet.sheetKey === "language_select") {
    return <LanguageSelectSheet payload={sheet.payload} onAction={onAction} />;
  }
  if (sheet.sheetKey === "contact_info") {
    return <ContactInfoSheet payload={sheet.payload} />;
  }
  if (sheet.sheetKey === "logout_confirm") {
    return <LogoutConfirmSheet payload={sheet.payload} onAction={onAction} />;
  }
  if (sheet.sheetKey === "wallet_info") {
    return <WalletInfoSheet payload={sheet.payload} />;
  }
  if (sheet.sheetKey === "support_request_create") {
    return (
      <SupportRequestCreateSheet payload={sheet.payload} onAction={onAction} />
    );
  }
  if (sheet.sheetKey === "support_request_close") {
    return (
      <SupportRequestCloseSheet payload={sheet.payload} onAction={onAction} />
    );
  }
  if (sheet.sheetKey === "support_request_rate") {
    return (
      <SupportRequestRateSheet payload={sheet.payload} onAction={onAction} />
    );
  }
  if (sheet.sheetKey === "loyalty_progress") {
    return <LoyaltyProgressSheet payload={sheet.payload} onAction={onAction} />;
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

