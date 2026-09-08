import { buildPaymentRedirectUrl } from "@/lib/payment-redirect";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import * as ExpoLinking from "expo-linking";
import { openBrowserAsync } from "expo-web-browser";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { NativeBottomSheet } from "@/components/native-bottom-sheet";
import { ACCENT_COLOR, styles } from "@/components/native-checkout/checkout-styles";
import { CheckoutItemsSheet } from "@/components/native-checkout/checkout-items-sheet";
import {
  BonusSection,
  CheckoutHeader,
  DeliverySection,
  ItemsSection,
  PaymentSection,
  SummarySection,
} from "@/components/native-checkout/checkout-sections";
import {
  getItemUnitFinalPrice,
  PAYMENT_METHODS,
  parseNumber,
} from "@/components/native-checkout/checkout-data";
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
  getAuthSessionVersion,
  getStoredAuthTokens,
  getStoredAuthTokensSync,
  parseAuthTokens,
} from "@/lib/auth-storage";
import {
  setCurrentWebPath,
  setTabBarForcedHidden,
} from "@/lib/tab-bar-visibility";

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

export function NativeCheckoutScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const directCheckoutProductId =
    params?.checkoutProductId != null ? String(params.checkoutProductId) : null;
  const [tokens, setTokens] = useState(
    parseAuthTokens(getStoredAuthTokensSync()),
  );
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [paymentOptions, setPaymentOptions] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [loyaltyProfile, setLoyaltyProfile] = useState(null);
  const [useBonuses, setUseBonuses] = useState(false);
  const [itemsSheetOpen, setItemsSheetOpen] = useState(false);
  const [addressSheetOpen, setAddressSheetOpen] = useState(false);
  const [draftAddressId, setDraftAddressId] = useState("");
  const [loading, setLoading] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);
  const orderLock = useRef(false);
  const checkoutLoadId = useRef(0);
  const [error, setError] = useState("");

  const selectedItems = useMemo(() => {
    if (!directCheckoutProductId) return items;
    const filtered = items.filter(
      (item) => String(item?.product?.id ?? "") === directCheckoutProductId,
    );
    return filtered;
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
  const availableBonuses = parseNumber(loyaltyProfile?.wallet_balance ?? 0);
  // The API accepts a boolean, not a requested points amount. Only the server
  // can quote the final discount; do not promise an unsent client-side amount.
  const appliedBonuses = 0;
  const finalTotal = totals.total;
  const canSubmit = Boolean(selectedAddress) && selectedItems.length > 0 && !loading;
  const paycomEnabled = Array.isArray(paymentOptions)
    ? paymentOptions.some(
        (option) => option?.provider === "paycom" && option?.enabled,
      )
    : null;
  const showCardOption = paycomEnabled === true;

  const loadCheckout = useCallback(
    async ({ silent = false } = {}) => {
      const requestId = ++checkoutLoadId.current;
      const session = getAuthSessionVersion();
      if (!silent) setLoading(true);
      setError("");
      try {
        const storedTokens =
          parseAuthTokens(getStoredAuthTokensSync()) ||
          parseAuthTokens(await getStoredAuthTokens());
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
        if (requestId !== checkoutLoadId.current || session !== getAuthSessionVersion()) return;
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
        setError(err?.message || t("ui.checkout.loadError"));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [router, t],
  );

  useFocusEffect(
    useCallback(() => {
      setCurrentWebPath("/checkout");
      setTabBarForcedHidden(true);
      void loadCheckout();
      return () => {
        checkoutLoadId.current += 1;
        setCurrentWebPath("/cart");
        setTabBarForcedHidden(false);
      };
    }, [loadCheckout]),
  );

  useEffect(() => {
    if (paycomEnabled !== true && paymentMethod === "card") {
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
    if (!tokens?.access || orderLock.current || !canSubmit) return;
    if (paymentMethod === "card" && paycomEnabled !== true) {
      setError(t("ui.checkout.invalidPayment"));
      return;
    }
    const addressSnapshot = buildAddressSnapshot(selectedAddress);
    if (!addressSnapshot) {
      setError(t("ui.checkout.addressRequired"));
      return;
    }
    const cartItemIds = Array.from(
      new Set(selectedItems.map((item) => item?.id).filter(Boolean)),
    );
    if (cartItemIds.length === 0) {
      setError(t("ui.checkout.itemRequired"));
      return;
    }

    orderLock.current = true;
    const session = getAuthSessionVersion();
    let createdOrder = null;
    setPlacingOrder(true);
    setError("");
    try {
      const order = await createOrder(tokens.access, {
        cart_item_ids: cartItemIds,
        address_id: selectedAddress?.id,
        payment_method: paymentMethod,
        use_points: useBonuses,
      });

      createdOrder = order;
      if (!order?.id) throw new Error("Invalid order response");
      if (session !== getAuthSessionVersion()) return;
      if (paymentMethod === "card") {
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
        if (!checkoutUrl || !["POST", "GET"].includes(method) || typeof fields !== "object") {
          throw new Error(t("ui.checkout.invalidPayment"));
        }
        const paymentUrl = buildPaymentRedirectUrl(checkoutUrl, fields, method);
        if (!paymentUrl) {
            throw new Error(t("ui.checkout.paymentOpenError"));
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
      if (session !== getAuthSessionVersion()) return;
      if (createdOrder?.id || !err?.status || err.status >= 500) {
        // A failed response does not prove that the server failed to create the order.
        Alert.alert(t("profile.orders"), t(createdOrder?.id ? "ui.checkout.paymentPending" : "ui.checkout.orderUncertain"), [
          { text: t("profile.orders"), onPress: finishOrder },
        ], { cancelable: false });
      } else {
        orderLock.current = false;
        setError(detail || t("ui.checkout.orderError"));
      }
    } finally {
      setPlacingOrder(false);
    }
  }, [
    finishOrder,
    paymentMethod,
    paycomEnabled,
    canSubmit,
    selectedAddress,
    selectedItems,
    tokens?.access,
    t,
    useBonuses,
  ]);

  const paymentRows = [
    showCardOption
      ? {
          value: "card",
          title: t("ui.checkout.paymentCard"),
          description: t("ui.checkout.paymentCardDescription"),
          icon: PAYMENT_METHODS.card.icon,
        }
      : null,
    {
      value: "cash",
      title: t("ui.checkout.paymentCash"),
      description: t("ui.checkout.paymentCashDescription"),
      icon: PAYMENT_METHODS.cash.icon,
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

  if (loading) {
    return (
      <View style={styles.screen}>
        <StatusBar style="dark" translucent={false} backgroundColor="#FFFFFF" />
        <CheckoutHeader insets={insets} onBack={goBackToCart} />
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
      <CheckoutHeader insets={insets} onBack={goBackToCart} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 96 + Math.max(12, insets.bottom) },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <DeliverySection addressLabel={addressLabel} onPress={openAddresses} />
        <ItemsSection
          items={selectedItems}
          onOpenProduct={openProduct}
          onShowAll={() => setItemsSheetOpen(true)}
        />
        <PaymentSection
          paymentRows={paymentRows}
          paymentMethod={paymentMethod}
          onChange={setPaymentMethod}
        />
        <BonusSection
          useBonuses={useBonuses}
          onToggle={setUseBonuses}
          availableBonuses={availableBonuses}
        />
        <SummarySection
          totals={totals}
          appliedBonuses={appliedBonuses}
          finalTotal={finalTotal}
          pendingBonuses={useBonuses}
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {selectedItems.length === 0 ? (
          <Text style={styles.emptyText}>{t("ui.checkout.emptyCart")}</Text>
        ) : null}
      </ScrollView>
      <CheckoutItemsSheet
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
