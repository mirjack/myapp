import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import * as ExpoLinking from "expo-linking";
import { openBrowserAsync } from "expo-web-browser";
import { StatusBar } from "expo-status-bar";
import Svg, { Path } from "react-native-svg";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { NativeBottomSheet } from "@/components/native-bottom-sheet";
import { BrandColors } from "@/constants/theme";
import {
  createOrder,
  getCartItems,
  getPaymentOptions,
  initPaycomPayment,
} from "@/lib/native-market-api";
import {
  fetchNativeLoyaltyProfile,
  listNativeAddresses,
} from "@/lib/native-account-api";
import {
  getStoredAuthTokens,
  getStoredAuthTokensSync,
} from "@/lib/auth-storage";
import {
  setCurrentWebPath,
  setTabBarForcedHidden,
} from "@/lib/tab-bar-visibility";

const currencyFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
});

const ACCENT_COLOR = BrandColors.primary;

function parseTokensString(tokensString) {
  if (!tokensString) return null;
  try {
    return JSON.parse(tokensString);
  } catch {
    return null;
  }
}

function parseNumber(value) {
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
}

function formatCurrency(value, suffix = " сум") {
  return `${currencyFormatter.format(Math.round(parseNumber(value)))}${suffix}`;
}

function sanitizeBonusInput(value) {
  return String(value ?? "").replace(/[^\d]/g, "");
}

function readAddressValue(item, keys) {
  for (const key of keys) {
    const value = item?.[key];
    if (value != null && String(value).trim() !== "")
      return String(value).trim();
  }

  const nestedSources = [
    item?.details,
    item?.address_details,
    item?.addressDetails,
    item?.metadata,
    item?.extra,
  ];

  for (const source of nestedSources) {
    if (!source || typeof source !== "object") continue;
    for (const key of keys) {
      const value = source?.[key];
      if (value != null && String(value).trim() !== "")
        return String(value).trim();
    }
  }

  return "";
}

function buildAddressSnapshot(address) {
  if (!address) return null;
  const formatted = readAddressValue(address, [
    "formatted_address",
    "formattedAddress",
    "formatted",
    "full_address",
    "fullAddress",
    "address",
    "display_address",
    "displayAddress",
    "description",
  ]);
  const city = readAddressValue(address, ["city", "district", "town"]);
  const street = readAddressValue(address, ["street", "line1", "address_line"]);
  const house = readAddressValue(address, [
    "house",
    "house_number",
    "building",
  ]);
  const apartment = readAddressValue(address, [
    "apartment",
    "flat",
    "office",
    "unit",
  ]);
  const postalCode = readAddressValue(address, [
    "postal_code",
    "postalCode",
    "zip",
  ]);
  const country = readAddressValue(address, ["country"]);

  return {
    city,
    street: street || formatted,
    house,
    apartment,
    postal_code: postalCode,
    country,
    formatted_address: formatted,
  };
}

function getAddressLabel(address) {
  if (!address) return "";
  const direct = readAddressValue(address, [
    "formatted_address",
    "formattedAddress",
    "full_address",
    "fullAddress",
    "address",
    "display_address",
    "description",
  ]);
  if (direct) return direct;
  return [
    readAddressValue(address, ["city", "district", "town"]),
    readAddressValue(address, ["street", "line1"]),
    readAddressValue(address, ["house", "house_number", "building"]),
    readAddressValue(address, ["apartment", "flat", "office", "unit"]),
  ]
    .filter(Boolean)
    .join(", ");
}

function getColorLabel(product) {
  return (
    product?.color_name ||
    product?.color?.name ||
    product?.raw?.color_name ||
    product?.raw?.color?.name ||
    product?.raw?.variant?.color?.name ||
    product?.raw?.shade ||
    product?.raw?.variant_name ||
    "Не указан"
  );
}

function getColorHex(product) {
  return (
    product?.color_hex ||
    product?.color?.hex ||
    product?.raw?.color_hex ||
    product?.raw?.color?.hex ||
    product?.raw?.variant?.color?.hex ||
    "#D7FF00"
  );
}

function getItemUnitFinalPrice(item) {
  return parseNumber(
    item?.product?.final_price ??
      item?.product?.discounted_price ??
      item?.product?.price ??
      0,
  );
}

function Icon({ name, size = 20, color = "#1B1C1F" }) {
  if (name === "back") {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M15 6L9 12L15 18"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  if (name === "chevron-right") {
    return (
      <Svg width={size} height={size} viewBox="0 0 12 12" fill="none">
        <Path
          d="M4.5 3L7.5 6L4.5 9"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  if (name === "delivery") {
    return (
      <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
        <Path
          d="M17.9167 12.9165C18.15 12.9165 18.3333 13.0998 18.3333 13.3332V14.1665C18.3333 15.5498 17.2167 16.6665 15.8333 16.6665C15.8333 15.2915 14.7083 14.1665 13.3333 14.1665C11.9583 14.1665 10.8333 15.2915 10.8333 16.6665H9.16666C9.16666 15.2915 8.04166 14.1665 6.66666 14.1665C5.29166 14.1665 4.16666 15.2915 4.16666 16.6665C2.78332 16.6665 1.66666 15.5498 1.66666 14.1665V12.4998C1.66666 12.0415 2.04166 11.6665 2.49999 11.6665H10.4167C11.5667 11.6665 12.5 10.7332 12.5 9.58317V4.99984C12.5 4.5415 12.875 4.1665 13.3333 4.1665H14.0333C14.6333 4.1665 15.1833 4.4915 15.4833 5.00817L16.0167 5.9415C16.0917 6.07484 15.9917 6.24984 15.8333 6.24984C14.6833 6.24984 13.75 7.18317 13.75 8.33317V10.8332C13.75 11.9832 14.6833 12.9165 15.8333 12.9165H17.9167Z"
          fill={color}
        />
        <Path
          d="M6.66667 18.3333C7.58714 18.3333 8.33333 17.5872 8.33333 16.6667C8.33333 15.7462 7.58714 15 6.66667 15C5.74619 15 5 15.7462 5 16.6667C5 17.5872 5.74619 18.3333 6.66667 18.3333Z"
          fill={color}
        />
        <Path
          d="M13.3333 18.3333C14.2538 18.3333 15 17.5872 15 16.6667C15 15.7462 14.2538 15 13.3333 15C12.4128 15 11.6667 15.7462 11.6667 16.6667C11.6667 17.5872 12.4128 18.3333 13.3333 18.3333Z"
          fill={color}
        />
        <Path
          d="M18.3333 10.4417V11.6667H15.8333C15.375 11.6667 15 11.2917 15 10.8333V8.33333C15 7.875 15.375 7.5 15.8333 7.5H16.9083L18.1167 9.61667C18.2583 9.86667 18.3333 10.15 18.3333 10.4417Z"
          fill={color}
        />
        <Path
          d="M10.9 1.6665H4.74166C3.04166 1.6665 1.66666 3.0415 1.66666 4.7415V10.0582C1.66666 10.5165 2.04166 10.8915 2.49999 10.8915H10.125C10.975 10.8915 11.6667 10.1998 11.6667 9.34984V2.43317C11.6667 2.00817 11.325 1.6665 10.9 1.6665ZM8.39166 5.8915L6.64999 7.57484C6.52499 7.6915 6.36666 7.74984 6.21666 7.74984C6.05832 7.74984 5.89999 7.6915 5.78332 7.57484L4.94166 6.77484C4.69166 6.53317 4.68332 6.13317 4.92499 5.88317C5.15832 5.63317 5.55832 5.63317 5.80832 5.8665L6.21666 6.25817L7.52499 4.9915C7.77499 4.74984 8.16666 4.75817 8.40832 5.00817C8.64999 5.25817 8.64166 5.64984 8.39166 5.8915Z"
          fill={color}
        />
      </Svg>
    );
  }

  if (name === "points") {
    return (
      <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
        <Path
          d="M10 20C15.5228 20 20 15.5228 20 10C20 4.47715 15.5228 0 10 0C4.47715 0 0 4.47715 0 10C0 15.5228 4.47715 20 10 20Z"
          fill={color}
        />
        <Path
          d="M10 0C15.5228 0 20 4.47715 20 10C20 15.5228 15.5228 20 10 20C4.47715 20 0 15.5228 0 10C0 4.47715 4.47715 0 10 0ZM14.5986 6.64453C14.9619 5.854 14.146 5.03816 13.3555 5.40137L10.3916 6.76367C10.143 6.87796 9.85698 6.87797 9.6084 6.76367L6.64551 5.40137C5.8549 5.03783 5.03814 5.85392 5.40137 6.64453L6.76465 9.6084C6.87877 9.8569 6.8789 10.1431 6.76465 10.3916L5.40137 13.3545C5.03779 14.1452 5.8548 14.9622 6.64551 14.5986L9.6084 13.2354C9.85691 13.1211 10.1431 13.1211 10.3916 13.2354L13.3555 14.5986C14.146 14.9616 14.9621 14.145 14.5986 13.3545L13.2363 10.3916C13.122 10.143 13.1221 9.85697 13.2363 9.6084L14.5986 6.64453Z"
          fill={color === ACCENT_COLOR ? "#0B0B0B" : "#F6F6F7"}
        />
      </Svg>
    );
  }

  if (name === "cash") {
    return (
      <Svg width={size} height={size} viewBox="0 0 17.75 15.1602" fill="none">
        <Path
          d="M0.75 12.625C5.19634 12.6214 9.62334 13.2102 13.9142 14.3758C14.52 14.5408 15.125 14.0908 15.125 13.4625V12.625M2 0.75V1.375C2 1.54076 1.93415 1.69973 1.81694 1.81694C1.69973 1.93415 1.54076 2 1.375 2H0.75M0.75 2V1.6875C0.75 1.17 1.17 0.75 1.6875 0.75H15.75M0.75 2V9.5M15.75 0.75V1.375C15.75 1.72 16.03 2 16.375 2H17M15.75 0.75H16.0625C16.58 0.75 17 1.17 17 1.6875V9.8125C17 10.33 16.58 10.75 16.0625 10.75H15.75M0.75 9.5V9.8125C0.75 10.0611 0.848772 10.2996 1.02459 10.4754C1.2004 10.6512 1.43886 10.75 1.6875 10.75H2M0.75 9.5H1.375C1.54076 9.5 1.69973 9.56585 1.81694 9.68306C1.93415 9.80027 2 9.95924 2 10.125V10.75M15.75 10.75V10.125C15.75 9.95924 15.8158 9.80027 15.9331 9.68306C16.0503 9.56585 16.2092 9.5 16.375 9.5H17M15.75 10.75H2M11.375 5.75C11.375 6.41304 11.1116 7.04893 10.6428 7.51777C10.1739 7.98661 9.53804 8.25 8.875 8.25C8.21196 8.25 7.57607 7.98661 7.10723 7.51777C6.63839 7.04893 6.375 6.41304 6.375 5.75C6.375 5.08696 6.63839 4.45107 7.10723 3.98223C7.57607 3.51339 8.21196 3.25 8.875 3.25C9.53804 3.25 10.1739 3.51339 10.6428 3.98223C11.1116 4.45107 11.375 5.08696 11.375 5.75ZM13.875 5.75H13.8817V5.75667H13.875V5.75ZM3.875 5.75H3.88167V5.75667H3.875V5.75Z"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  if (name === "card") {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M4 7.5C4 6.67 4.67 6 5.5 6H18.5C19.33 6 20 6.67 20 7.5V16.5C20 17.33 19.33 18 18.5 18H5.5C4.67 18 4 17.33 4 16.5V7.5Z"
          stroke={color}
          strokeWidth={1.8}
        />
        <Path
          d="M4 10H20M7 14.5H10.5"
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      </Svg>
    );
  }

  if (name === "bag") {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M19.96 8.96C19.29 8.22 18.28 7.79 16.88 7.64V6.88C16.88 5.51 16.3 4.19 15.28 3.27C14.25 2.33 12.91 1.89 11.52 2.02C9.13 2.25 7.12 4.56 7.12 7.06V7.64C5.72 7.79 4.71 8.22 4.04 8.96C3.07 10.04 3.1 11.48 3.21 12.48L3.91 18.05C4.12 20 4.91 22 9.21 22H14.79C19.09 22 19.88 20 20.09 18.06L20.79 12.47C20.9 11.48 20.93 10.04 19.96 8.96ZM11.66 3.41C12.66 3.32 13.61 3.63 14.35 4.3C15.08 4.96 15.49 5.9 15.49 6.88V7.58H8.51V7.06C8.51 5.28 10 3.57 11.66 3.41ZM8.42 13.16H8.41C7.86 13.16 7.41 12.71 7.41 12.16C7.41 11.6 7.86 11.16 8.41 11.16C8.97 11.16 9.42 11.6 9.42 12.16C9.42 12.71 8.97 13.16 8.42 13.16ZM15.42 13.16H15.41C14.86 13.16 14.41 12.71 14.41 12.16C14.41 11.6 14.86 11.16 15.41 11.16C15.97 11.16 16.42 11.6 16.42 12.16C16.42 12.71 15.97 13.16 15.42 13.16Z"
          fill={color}
        />
      </Svg>
    );
  }

  if (name === "tag") {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2Z"
          fill={color}
        />
        <Path
          d="M8.7 15.3L15.3 8.7M9.3 9.3H9.31M14.69 14.69H14.7"
          stroke="#F6F6F7"
          strokeWidth={1.6}
          strokeLinecap="round"
        />
      </Svg>
    );
  }

  if (name === "close") {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M7 7L17 17M17 7L7 17"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
        />
      </Svg>
    );
  }

  return null;
}

function RadioIndicator({ checked }) {
  return (
    <View style={[styles.radio, checked ? styles.radioActive : null]}>
      {checked ? <View style={styles.radioDot} /> : null}
    </View>
  );
}

function Section({ children, first, padded = true }) {
  return (
    <View
      style={[
        styles.section,
        first ? styles.firstSection : null,
        padded ? styles.sectionPadded : null,
      ]}
    >
      {children}
    </View>
  );
}

function SummaryRow({ icon, label, value, badge }) {
  return (
    <View style={styles.summaryRow}>
      <View style={styles.summaryLabelWrap}>
        <Icon name={icon} size={20} color="#757575" />
        <Text numberOfLines={1} style={styles.summaryLabel}>
          {label}
        </Text>
      </View>
      <View style={styles.summaryValueWrap}>
        {badge ? (
          <View style={styles.summaryBadge}>
            <Text style={styles.summaryBadgeText}>{badge}</Text>
          </View>
        ) : null}
        <Text style={styles.summaryValue}>{value}</Text>
      </View>
    </View>
  );
}

function ItemsSheet({ visible, items, onClose, onOpenProduct, bottomInset }) {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <View
        style={[styles.sheetRoot, { paddingBottom: Math.max(12, bottomInset) }]}
      >
        <View style={styles.sheetCard}>
          <Text style={styles.sheetTitle}>Товары в заказе</Text>
          {items.map((item) => {
            const product = item?.product ?? {};
            const quantity = Number(item?.quantity) || 1;
            const totalPrice = getItemUnitFinalPrice(item) * quantity;
            return (
              <Pressable
                key={String(item.id)}
                onPress={() => onOpenProduct(item)}
                style={styles.sheetItem}
              >
                <View style={styles.sheetImageWrap}>
                  <ExpoImage
                    source={{ uri: product.image || product.image_url }}
                    style={styles.sheetImage}
                    contentFit="cover"
                  />
                </View>
                <View style={styles.sheetItemInfo}>
                  <Text numberOfLines={2} style={styles.sheetItemTitle}>
                    {product.name || "Товар"}
                  </Text>
                  <View style={styles.sheetMetaRow}>
                    <Text style={styles.sheetMetaLabel}>Количество</Text>
                    <View style={styles.sheetMetaValueWrap}>
                      <View style={styles.quantityBadge}>
                        <Text style={styles.quantityBadgeText}>{quantity}</Text>
                      </View>
                      <View style={styles.sheetDivider} />
                      <Text style={styles.sheetMetaValue}>
                        {formatCurrency(totalPrice)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.sheetMetaRow}>
                    <Text style={styles.sheetMetaLabel}>Цвет</Text>
                    <View style={styles.sheetMetaValueWrap}>
                      <View
                        style={[
                          styles.colorSwatch,
                          { backgroundColor: getColorHex(product) },
                        ]}
                      />
                      <Text style={styles.sheetMetaValue}>
                        {getColorLabel(product)}
                      </Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
        <Pressable onPress={onClose} style={styles.sheetCloseButton}>
          <Text style={styles.sheetCloseText}>Закрыть</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function buildPaymentRedirectUrl(checkoutUrl, fields) {
  const url = String(checkoutUrl || "").trim();
  if (!url) return "";

  try {
    const parsed = new URL(url);
    Object.entries(fields || {}).forEach(([key, value]) => {
      parsed.searchParams.set(key, String(value ?? ""));
    });
    return parsed.toString();
  } catch {
    const params = new URLSearchParams(
      Object.entries(fields || {}).map(([key, value]) => [
        key,
        String(value ?? ""),
      ]),
    ).toString();
    if (!params) return url;
    return `${url}${url.includes("?") ? "&" : "?"}${params}`;
  }
}

export function NativeCheckoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const directCheckoutProductId =
    params?.checkoutProductId != null ? String(params.checkoutProductId) : null;
  const [tokens, setTokens] = useState(
    parseTokensString(getStoredAuthTokensSync()),
  );
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [paymentOptions, setPaymentOptions] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [loyaltyProfile, setLoyaltyProfile] = useState(null);
  const [useBonuses, setUseBonuses] = useState(true);
  const [bonusInput, setBonusInput] = useState("");
  const [itemsSheetOpen, setItemsSheetOpen] = useState(false);
  const [addressSheetOpen, setAddressSheetOpen] = useState(false);
  const [draftAddressId, setDraftAddressId] = useState("");
  const [loading, setLoading] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [error, setError] = useState("");

  const selectedItems = useMemo(() => {
    if (!directCheckoutProductId) return items;
    const filtered = items.filter(
      (item) => String(item?.product?.id ?? "") === directCheckoutProductId,
    );
    return filtered.length > 0 ? filtered : items;
  }, [directCheckoutProductId, items]);

  const totals = useMemo(() => {
    const subtotal = selectedItems.reduce((acc, item) => {
      return (
        acc + parseNumber(item?.product?.price) * (Number(item?.quantity) || 0)
      );
    }, 0);
    const discount = selectedItems.reduce((acc, item) => {
      const price = parseNumber(item?.product?.price);
      const finalPrice = getItemUnitFinalPrice(item);
      return (
        acc + Math.max(0, price - finalPrice) * (Number(item?.quantity) || 0)
      );
    }, 0);
    const deliveryFee =
      summary?.delivery_fee !== null && summary?.delivery_fee !== undefined
        ? parseNumber(summary.delivery_fee)
        : 0;
    return {
      subtotal,
      discount,
      shipping: deliveryFee,
      total: Math.max(subtotal - discount + deliveryFee, 0),
      quantity: selectedItems.reduce(
        (acc, item) => acc + Math.max(0, Number(item?.quantity ?? 0)),
        0,
      ),
    };
  }, [selectedItems, summary]);

  const selectedAddress = useMemo(() => {
    return (
      addresses.find(
        (address) => String(address.id) === String(selectedAddressId),
      ) || null
    );
  }, [addresses, selectedAddressId]);

  const addressLabel = getAddressLabel(selectedAddress);
  const availableBonuses = parseNumber(loyaltyProfile?.wallet_balance ?? 5000);
  const requestedBonuses = parseNumber(bonusInput);
  const maxBonuses = Math.min(
    Math.max(totals.total, 0),
    Math.max(availableBonuses, 0),
  );
  const bonusLimitExceeded = useBonuses && requestedBonuses > availableBonuses;
  const appliedBonuses =
    useBonuses && !bonusLimitExceeded
      ? Math.min(requestedBonuses, maxBonuses)
      : 0;
  const finalTotal = Math.max(totals.total - appliedBonuses, 0);
  const canSubmit =
    Boolean(selectedAddress) && selectedItems.length > 0 && !bonusLimitExceeded;
  const paycomEnabled = Array.isArray(paymentOptions)
    ? paymentOptions.some(
        (option) => option?.provider === "paycom" && option?.enabled,
      )
    : null;
  const showCardOption = paycomEnabled !== false;

  const loadCheckout = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true);
      setError("");
      try {
        const storedTokens =
          parseTokensString(getStoredAuthTokensSync()) ||
          parseTokensString(await getStoredAuthTokens());
        setTokens(storedTokens);
        if (!storedTokens?.access) {
          router.replace({
            pathname: "/onboarding/phone",
            params: { next: "/checkout" },
          });
          return;
        }

        const [cartResponse, addressItems, options, loyalty] =
          await Promise.all([
            getCartItems(storedTokens.access),
            listNativeAddresses().catch(() => []),
            getPaymentOptions(storedTokens.access).catch(() => null),
            fetchNativeLoyaltyProfile().catch(() => null),
          ]);
        const nextItems = Array.isArray(cartResponse)
          ? cartResponse
          : (cartResponse?.items ?? []);
        setItems(nextItems);
        setSummary(cartResponse?.summary ?? null);
        setAddresses(addressItems);
        setPaymentOptions(options);
        setLoyaltyProfile(loyalty);
        const defaultAddress =
          addressItems.find(
            (address) => address.is_default || address.isDefault,
          ) || addressItems[0];
        setSelectedAddressId((current) => {
          if (
            addressItems.some(
              (address) => String(address.id) === String(current),
            )
          ) {
            return current;
          }
          return defaultAddress?.id != null ? String(defaultAddress.id) : "";
        });
      } catch (err) {
        setError(err?.message || "Не удалось загрузить оформление заказа.");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [router],
  );

  useEffect(() => {
    void loadCheckout();
  }, [loadCheckout]);

  useFocusEffect(
    useCallback(() => {
      setCurrentWebPath("/checkout");
      setTabBarForcedHidden(true);
      if (!loading) {
        void loadCheckout({ silent: true });
      }
      return () => {
        setCurrentWebPath("/cart");
        setTabBarForcedHidden(false);
      };
    }, [loadCheckout, loading]),
  );

  useEffect(() => {
    if (paycomEnabled === false && paymentMethod === "card") {
      setPaymentMethod("cash");
    }
  }, [paycomEnabled, paymentMethod]);

  const goBackToCart = useCallback(() => {
    setCurrentWebPath("/cart");
    setTabBarForcedHidden(false);
    router.replace("/(tabs)/cart");
  }, [router]);

  const openAddresses = useCallback(() => {
    setDraftAddressId(selectedAddressId);
    setAddressSheetOpen(true);
  }, [selectedAddressId]);

  const manageAddresses = useCallback(() => {
    setAddressSheetOpen(false);
    router.push("/account/addresses");
  }, [router]);

  const openProduct = useCallback(
    (item) => {
      const productId = item?.product?.id;
      if (!productId) return;
      setItemsSheetOpen(false);
      router.push({
        pathname: "/product",
        params: { productPath: `/products/${productId}` },
      });
    },
    [router],
  );

  const finishOrder = useCallback(() => {
    setCurrentWebPath("/profile/orders");
    setTabBarForcedHidden(false);
    router.replace("/(tabs)/profile/orders");
  }, [router]);

  const placeOrder = useCallback(async () => {
    if (!tokens?.access || placingOrder) return;
    const addressSnapshot = buildAddressSnapshot(selectedAddress);
    if (!addressSnapshot) {
      setError("Выберите или укажите адрес доставки.");
      return;
    }
    const cartItemIds = Array.from(
      new Set(selectedItems.map((item) => item?.id).filter(Boolean)),
    );
    if (cartItemIds.length === 0) {
      setError("Выберите хотя бы один товар.");
      return;
    }

    setPlacingOrder(true);
    setError("");
    try {
      const order = await createOrder(tokens.access, {
        cart_item_ids: cartItemIds,
        address_snapshot: addressSnapshot,
        delivery_fee: String(totals.shipping),
        payment_method: paymentMethod,
        ...(appliedBonuses > 0
          ? { points_redeemed: Math.floor(appliedBonuses) }
          : {}),
      });

      if (paymentMethod === "card" && order?.id) {
        const callback = ExpoLinking.createURL("/account/orders", {
          queryParams: { paidOrderId: String(order.id) },
        });
        const init = await initPaycomPayment(tokens.access, {
          order_id: order.id,
          callback,
        });
        const checkoutUrl = init?.checkout_url;
        const method = String(init?.method || "POST").toUpperCase();
        const fields = init?.fields || {};
        if (!checkoutUrl || method !== "POST" || typeof fields !== "object") {
          throw new Error("Неверный ответ Paycom.");
        }
        const paymentUrl = buildPaymentRedirectUrl(checkoutUrl, fields);
        if (!paymentUrl) {
          throw new Error("ÐÐµ ÑƒÐ´Ð°Ð»Ð¾ÑÑŒ Ð¾Ñ‚ÐºÑ€Ñ‹Ñ‚ÑŒ Paycom.");
        }
        await openBrowserAsync(paymentUrl);
        finishOrder();
        return;
      }

      finishOrder();
    } catch (err) {
      const detail =
        err?.data?.detail ||
        err?.data?.message ||
        err?.data?.error ||
        err?.message;
      setError(detail || "Не удалось оформить заказ.");
    } finally {
      setPlacingOrder(false);
    }
  }, [
    appliedBonuses,
    finishOrder,
    paymentMethod,
    placingOrder,
    selectedAddress,
    selectedItems,
    tokens?.access,
    totals.shipping,
  ]);

  const paymentRows = [
    showCardOption
      ? {
          value: "card",
          title: "Payme / Click / Карта",
          description: "Онлайн-оплата картой",
          icon: "card",
        }
      : null,
    {
      value: "cash",
      title: "Наличными",
      description: "Наличными при получении заказа",
      icon: "cash",
    },
  ].filter(Boolean);

  const addressSheet = useMemo(
    () => ({
      sheetKey: "checkout_address_select",
      payload: {
        addresses,
        selectedId: selectedAddressId,
        draftId: draftAddressId,
      },
      options: { hideClose: true },
    }),
    [addresses, draftAddressId, selectedAddressId],
  );

  const handleAddressSheetAction = useCallback(
    (action, payload) => {
      if (action === "select_address") {
        setDraftAddressId(String(payload?.id || ""));
        return;
      }
      if (action === "save_address") {
        const nextId = String(payload?.id || draftAddressId || "");
        if (!nextId) return;
        setSelectedAddressId(nextId);
        setAddressSheetOpen(false);
        return;
      }
      if (action === "manage_addresses") {
        manageAddresses();
      }
    },
    [draftAddressId, manageAddresses],
  );

  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <View style={styles.headerRow}>
        <Pressable onPress={goBackToCart} style={styles.backButton}>
          <Icon name="back" size={24} color={ACCENT_COLOR} />
          <Text style={styles.backText}>Назад</Text>
        </Pressable>
        <Text numberOfLines={1} style={styles.headerTitle}>
          Оформление заказа
        </Text>
        <View style={styles.headerSide} />
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.screen}>
        <StatusBar style="dark" translucent={false} backgroundColor="#FFFFFF" />
        {renderHeader()}
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={ACCENT_COLOR} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar style="dark" translucent={false} backgroundColor="#FFFFFF" />
      {renderHeader()}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 96 + Math.max(12, insets.bottom) },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Section first>
          <Text style={styles.sectionTitle}>Куда доставить?</Text>
          <Pressable onPress={openAddresses} style={styles.deliveryRow}>
            <View style={styles.deliveryIcon}>
              <Icon name="delivery" size={20} color="#0B0B0B" />
            </View>
            <View style={styles.deliveryTextBlock}>
              <Text style={styles.deliveryTitle}>Укажите адрес доставки</Text>
              <Text numberOfLines={1} style={styles.deliverySubtitle}>
                {addressLabel || "Укажите или выберите из сохранённых"}
              </Text>
            </View>
            <View style={styles.deliveryChevron}>
              <Icon name="chevron-right" size={16} color="#7C7C7C" />
            </View>
          </Pressable>
        </Section>

        <Section>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Товары в заказе</Text>
            <Pressable onPress={goBackToCart} style={styles.viewAllButton}>
              <Text style={styles.viewAllText}>Смотреть все</Text>
              <Icon name="chevron-right" size={12} color={ACCENT_COLOR} />
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.previewList}
          >
            {selectedItems.slice(0, 4).map((item) => (
              <Pressable
                key={String(item.id)}
                onPress={() => openProduct(item)}
                style={styles.previewItem}
              >
                <ExpoImage
                  source={{
                    uri: item?.product?.image || item?.product?.image_url,
                  }}
                  style={styles.previewImage}
                  contentFit="cover"
                />
              </Pressable>
            ))}
          </ScrollView>
          {selectedItems.length > 4 ? (
            <Pressable
              onPress={() => setItemsSheetOpen(true)}
              style={styles.itemsSheetButton}
            >
              <Text style={styles.itemsSheetButtonText}>
                Показать все товары
              </Text>
            </Pressable>
          ) : null}
        </Section>

        <Section>
          <Text style={styles.sectionTitle}>Способ оплаты</Text>
          <View style={styles.paymentList}>
            {paymentRows.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => setPaymentMethod(option.value)}
                style={styles.paymentRow}
              >
                <View style={styles.paymentRadioSlot}>
                  <RadioIndicator checked={paymentMethod === option.value} />
                </View>
                <View style={styles.paymentIconSlot}>
                  <Icon name={option.icon} size={20} color="#1B1C1F" />
                </View>
                <View style={styles.paymentTextBlock}>
                  <Text style={styles.paymentTitle}>{option.title}</Text>
                  <Text style={styles.paymentDescription}>
                    {option.description}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </Section>

        <Section padded={false}>
          <View style={styles.bonusTop}>
            <Text style={styles.sectionTitle}>Оплата баллами</Text>
            <View style={styles.bonusRow}>
              <View style={styles.bonusIcon}>
                <Icon name="points" size={20} />
              </View>
              <View style={styles.bonusTextBlock}>
                <Text style={styles.bonusTitle}>Использовать баллы</Text>
                <Text style={styles.bonusDescription}>
                  Используйте накопленные баллы чтобы оплатить заказ
                </Text>
              </View>
              <Switch
                value={useBonuses}
                onValueChange={setUseBonuses}
                trackColor={{ false: "#D7D8DD", true: ACCENT_COLOR }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
          {useBonuses ? (
            <View style={styles.bonusInputWrap}>
              <Text style={styles.inputLabel}>Оплата баллами</Text>
              <TextInput
                value={bonusInput}
                onChangeText={(value) =>
                  setBonusInput(sanitizeBonusInput(value))
                }
                keyboardType="number-pad"
                placeholder="Введите количество баллов"
                placeholderTextColor="#B8B9BF"
                style={[
                  styles.bonusInput,
                  bonusLimitExceeded ? styles.bonusInputError : null,
                ]}
              />
              <Text
                style={[
                  styles.bonusHint,
                  bonusLimitExceeded ? styles.bonusHintError : null,
                ]}
              >
                {bonusLimitExceeded
                  ? `Доступно ${formatCurrency(availableBonuses)}`
                  : `Баланс: ${formatCurrency(availableBonuses)}`}
              </Text>
            </View>
          ) : null}
        </Section>

        <Section>
          <Text style={styles.sectionTitle}>Способ оплаты</Text>
          <View style={styles.summaryList}>
            <SummaryRow
              icon="bag"
              label="Товаров"
              badge={totals.quantity > 0 ? String(totals.quantity) : null}
              value={formatCurrency(totals.subtotal)}
            />
            <SummaryRow
              icon="tag"
              label="Скидка"
              value={`-${formatCurrency(totals.discount)}`}
            />
            <SummaryRow
              icon="delivery"
              label="Доставка"
              value={formatCurrency(totals.shipping)}
            />
            <SummaryRow
              icon="points"
              label="Баллами"
              value={formatCurrency(appliedBonuses)}
            />
            <View style={styles.summarySeparator} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Итого</Text>
              <Text style={styles.totalValue}>
                {formatCurrency(finalTotal)}
              </Text>
            </View>
          </View>
        </Section>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {selectedItems.length === 0 ? (
          <Text style={styles.emptyText}>Корзина пуста.</Text>
        ) : null}
      </ScrollView>

      <ItemsSheet
        visible={itemsSheetOpen}
        items={selectedItems}
        onClose={() => setItemsSheetOpen(false)}
        onOpenProduct={openProduct}
        bottomInset={insets.bottom}
      />
      <NativeBottomSheet
        mounted={addressSheetOpen}
        visible={addressSheetOpen}
        sheet={addressSheet}
        onClose={() => setAddressSheetOpen(false)}
        onAction={handleAddressSheetAction}
      />
      <View
        style={[styles.footer, { paddingBottom: Math.max(12, insets.bottom) }]}
      >
        <Pressable
          disabled={!canSubmit || placingOrder}
          onPress={placeOrder}
          style={[
            styles.footerButton,
            !canSubmit || placingOrder ? styles.footerButtonDisabled : null,
          ]}
        >
          {placingOrder ? (
            <ActivityIndicator color={canSubmit ? "#FFFFFF" : "#C5C5C5"} />
          ) : (
            <Text
              style={[
                styles.footerButtonText,
                !canSubmit ? styles.footerTextDisabled : null,
              ]}
            >
              Оформить
            </Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F6F6F7",
  },
  header: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 8,
    paddingBottom: 4,
    shadowColor: "#121212",
    shadowOpacity: 0.05,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
    zIndex: 10,
  },
  headerRow: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  backButton: {
    position: "absolute",
    left: 0,
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 1,
  },
  backText: {
    color: ACCENT_COLOR,
    fontSize: 16,
    fontWeight: "400",
  },
  headerTitle: {
    maxWidth: "60%",
    color: "#111214",
    fontSize: 17,
    fontWeight: "600",
  },
  headerSide: {
    position: "absolute",
    right: 0,
    width: 72,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    flex: 1,
  },
  content: {
    gap: 8,
  },
  section: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
  },
  firstSection: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  sectionPadded: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionTitle: {
    color: "#111214",
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "600",
  },
  deliveryRow: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 0,
  },
  deliveryIcon: {
    width: 44,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  deliveryTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  deliveryTitle: {
    color: "#0B0B0B",
    fontSize: 16,
    lineHeight: 22,
  },
  deliverySubtitle: {
    color: "#7C7C7C",
    fontSize: 14,
    lineHeight: 16,
  },
  deliveryChevron: {
    width: 48,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
  },
  viewAllText: {
    color: ACCENT_COLOR,
    fontSize: 15,
    fontWeight: "500",
  },
  previewList: {
    gap: 4,
    paddingTop: 16,
  },
  previewItem: {
    width: 62,
    height: 83,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  previewImage: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
  },
  itemsSheetButton: {
    marginTop: 12,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F5F5F7",
    alignItems: "center",
    justifyContent: "center",
  },
  itemsSheetButtonText: {
    color: "#111214",
    fontSize: 14,
    fontWeight: "600",
  },
  paymentList: {
    marginTop: 8,
    gap: 4,
  },
  paymentRow: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 0,
    paddingVertical: 12,
  },
  paymentRadioSlot: {
    width: 44,
    minHeight: 36,
    alignItems: "flex-start",
    justifyContent: "flex-start",
    paddingLeft: 16,
  },
  paymentIconSlot: {
    width: 44,
    minHeight: 36,
    alignItems: "flex-start",
    justifyContent: "flex-start",
    paddingLeft: 8,
  },
  radio: {
    marginTop: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D0D0D5",
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: {
    borderColor: "#1F1F22",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#1F1F22",
  },
  paymentTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  paymentTitle: {
    color: "#1D1E20",
    fontSize: 16,
    lineHeight: 20,
  },
  paymentDescription: {
    color: "#9899A0",
    fontSize: 14,
    lineHeight: 20,
  },
  bonusTop: {
    position: "relative",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  bonusRow: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  bonusIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  bonusTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  bonusTitle: {
    color: "#1D1E20",
    fontSize: 16,
    lineHeight: 20,
  },
  bonusDescription: {
    color: "#9899A0",
    fontSize: 14,
    lineHeight: 20,
  },
  bonusInputWrap: {
    borderTopWidth: 1,
    borderTopColor: "#ECECEF",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  inputLabel: {
    color: "#202124",
    fontSize: 16,
    fontWeight: "500",
  },
  bonusInput: {
    marginTop: 12,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F5F5F7",
    borderWidth: 1,
    borderColor: "transparent",
    paddingHorizontal: 20,
    color: "#202124",
    fontSize: 16,
  },
  bonusInputError: {
    borderColor: "#FF5B5B",
    backgroundColor: "#FFFFFF",
  },
  bonusHint: {
    marginTop: 8,
    color: "#8E8F96",
    fontSize: 14,
  },
  bonusHintError: {
    color: "#FF5B5B",
  },
  summaryList: {
    marginTop: 12,
    gap: 0,
  },
  summaryRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 0,
    paddingVertical: 12,
  },
  summaryLabelWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 0,
  },
  summaryLabel: {
    color: "#0B0B0B",
    fontSize: 16,
    lineHeight: 22,
  },
  summaryValueWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  summaryBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: "#F0F0F2",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryBadgeText: {
    color: "#111214",
    fontSize: 12,
    fontWeight: "600",
  },
  summaryValue: {
    color: "#111214",
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "400",
  },
  summarySeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#ECECEF",
    marginHorizontal: -8,
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
  },
  totalLabel: {
    color: "#111214",
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "400",
  },
  totalValue: {
    color: "#111214",
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "400",
  },
  errorText: {
    marginHorizontal: 16,
    color: "#FF4D4F",
    fontSize: 14,
    lineHeight: 20,
  },
  emptyText: {
    marginHorizontal: 16,
    color: "#8B8D93",
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    borderTopRadius: 24,
    paddingTop: 12,
    backgroundColor: "#FFFFFF",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#ECECEF",
  },
  footerButton: {
    height: 45,
    borderRadius: 26,
    backgroundColor: ACCENT_COLOR,
    alignItems: "center",
    justifyContent: "center",
  },
  footerButtonDisabled: {
    backgroundColor: "#F0F0F2",
  },
  footerButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "600",
  },
  footerTextDisabled: {
    color: "#B8B8BD",
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  sheetRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheetCard: {
    maxHeight: "72%",
    marginHorizontal: 8,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    padding: 16,
  },
  sheetTitle: {
    color: "#111214",
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "600",
    marginBottom: 12,
  },
  sheetItem: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ECECEF",
  },
  sheetImageWrap: {
    width: 70,
    height: 92,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  sheetImage: {
    width: "100%",
    height: "100%",
  },
  sheetItemInfo: {
    flex: 1,
    minWidth: 0,
  },
  sheetItemTitle: {
    color: "#111214",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
  },
  sheetMetaRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  sheetMetaLabel: {
    color: "#8B8D93",
    fontSize: 13,
    lineHeight: 18,
  },
  sheetMetaValueWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  quantityBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#F2F2F4",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  quantityBadgeText: {
    color: "#111214",
    fontSize: 12,
    fontWeight: "600",
  },
  sheetDivider: {
    width: StyleSheet.hairlineWidth,
    height: 14,
    backgroundColor: "#D8D8DE",
  },
  sheetMetaValue: {
    color: "#111214",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  colorSwatch: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#D8D8DE",
  },
  sheetCloseButton: {
    height: 52,
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetCloseText: {
    color: "#111214",
    fontSize: 16,
    fontWeight: "600",
  },
});
