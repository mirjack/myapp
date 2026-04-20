import { useCallback } from "react";
import { LayoutAnimation, Platform, UIManager } from "react-native";

import { getPendingAuthAction, getStoredAuthTokens, setPendingAuthAction } from "@/lib/auth-storage";
import { addFavorite, adjustCartItemByProduct, fetchProductById, getCartItems, mapProduct } from "@/lib/native-market-api";
import { setTabBarForcedHidden } from "@/lib/tab-bar-visibility";

import { BOTTOM_SHEET_ACTION_EVENT, BOTTOM_SHEET_CLOSE_EVENT, NATIVE_SHEET_CLOSE_MS, PRODUCT_SHEET_KEY, PRODUCT_SHEET_REQUEST_ID } from "./constants";
import { parseTokensString } from "./utils";

const isNewArchitectureEnabled = Boolean(global?.nativeFabricUIManager);

if (Platform.OS === "android" && !isNewArchitectureEnabled) {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

function configureProductSheetLayout() {
  LayoutAnimation.configureNext({
    duration: 180,
    create: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity,
    },
    update: {
      type: LayoutAnimation.Types.easeInEaseOut,
    },
    delete: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity,
    },
  });
}

export function useHybridShellSheets({ core, navigateWebPath, goNativeTab, openLogin, router }) {
  const { refs, state, setters } = core;

  const queuePendingAuthAction = useCallback((action) => {
    if (!action?.type || action.productId == null) return;
    refs.pendingAuthActionRef.current = action;
    setPendingAuthAction(action);
  }, [refs.pendingAuthActionRef]);

  const emitToWeb = useCallback((eventName, detail) => {
    if (!refs.webViewRef.current) return;
    const payload = JSON.stringify(detail || {});
    refs.webViewRef.current.injectJavaScript(`(function(){try{window.dispatchEvent(new CustomEvent(${JSON.stringify(eventName)}, { detail: ${payload} }));}catch(e){}true;})();`);
  }, [refs.webViewRef]);

  const flushPendingAuthAction = useCallback(async (tokens) => {
    if (!tokens?.access) return;
    const action = refs.pendingAuthActionRef.current ?? (await getPendingAuthAction());
    if (!action?.type || action.productId == null) return;
    refs.pendingAuthActionRef.current = null;
    await setPendingAuthAction(null);

    try {
      if (action.type === "cart") {
        const updated = await adjustCartItemByProduct(tokens.access, action.productId, Number(action.delta) || 1);
        const nextQuantity = Math.max(0, Number(updated?.quantity ?? 0));
        setters.setCartCount((prevCount) => Math.max(0, prevCount + (Number(action.delta) || 1)));
        emitToWeb("cart:updated", { productId: action.productId, quantity: nextQuantity });
        return;
      }
      if (action.type === "favorite") {
        await addFavorite(tokens.access, action.productId);
        emitToWeb("favorites:updated", { productId: action.productId });
      }
    } catch {
      // Keep auth success smooth even if the queued product action fails.
    }
  }, [emitToWeb, refs.pendingAuthActionRef, setters]);

  const updateNativeProductSheetPayload = useCallback((updater) => {
    setters.setNativeSheet((current) => {
      if (!current || current.sheetKey !== PRODUCT_SHEET_KEY) return current;
      const nextPayload = typeof updater === "function" ? updater(current.payload || {}) : updater || {};
      return { ...current, payload: { ...(current.payload || {}), ...nextPayload } };
    });
  }, [setters]);

  const refreshNativeProductQuantity = useCallback(async (productId, seq) => {
    const tokensString = await getStoredAuthTokens();
    const tokens = parseTokensString(tokensString);
    if (!tokens?.access) {
      configureProductSheetLayout();
      if (seq === refs.productSheetLoadSeqRef.current) updateNativeProductSheetPayload({ quantity: 0, isQuantityLoading: false });
      return;
    }

    try {
      const response = await getCartItems(tokens.access);
      const items = Array.isArray(response) ? response : (response?.items ?? []);
      const found = items.find((entry) => String(entry.product?.id) === String(productId));
      configureProductSheetLayout();
      if (seq === refs.productSheetLoadSeqRef.current) updateNativeProductSheetPayload({ quantity: found?.quantity ?? 0, isQuantityLoading: false });
    } catch {
      configureProductSheetLayout();
      if (seq === refs.productSheetLoadSeqRef.current) updateNativeProductSheetPayload({ quantity: 0, isQuantityLoading: false });
    }
  }, [refs.productSheetLoadSeqRef, updateNativeProductSheetPayload]);

  const openNativeProductSheet = useCallback(async ({ productId, product, quantity }) => {
    const resolvedId = productId ?? product?.id;
    if (!resolvedId) return;
    const initialQuantity = Math.max(
      0,
      Number(quantity ?? product?.cartQuantity ?? product?.quantity ?? 0) || 0,
    );
    const requestId = PRODUCT_SHEET_REQUEST_ID;
    const seq = refs.productSheetLoadSeqRef.current + 1;
    refs.productSheetLoadSeqRef.current = seq;

    if (refs.nativeSheetCloseTimerRef.current) {
      clearTimeout(refs.nativeSheetCloseTimerRef.current);
      refs.nativeSheetCloseTimerRef.current = null;
    }

    const initialProduct = product && typeof product === "object" ? mapProduct(product) : null;
    setters.setNativeSheet({
      requestId,
      sheetKey: PRODUCT_SHEET_KEY,
      payload: {
        productId: String(resolvedId), product: initialProduct, fallbackProduct: initialProduct,
        quantity: initialQuantity, isLoading: true, isQuantityLoading: initialQuantity <= 0, isCartPending: false, error: null,
      },
      options: { hideClose: false },
    });
    refs.nativeSheetMetaRef.current.set(requestId, { source: PRODUCT_SHEET_KEY });
    setters.setIsNativeSheetVisible(true);

    refreshNativeProductQuantity(resolvedId, seq);
    try {
      const data = await fetchProductById(resolvedId);
      if (seq !== refs.productSheetLoadSeqRef.current) return;
      updateNativeProductSheetPayload((current) => ({
        product: data || current.product || current.fallbackProduct || initialProduct,
        isLoading: false,
        error: data || current.product || current.fallbackProduct || initialProduct ? null : "Product not found.",
      }));
    } catch {
      if (seq !== refs.productSheetLoadSeqRef.current) return;
      updateNativeProductSheetPayload((current) => ({
        product: current.product || current.fallbackProduct || initialProduct,
        isLoading: false,
        error: current.product || current.fallbackProduct || initialProduct ? null : "Failed to load product information.",
      }));
    }
  }, [refs, refreshNativeProductQuantity, setters, updateNativeProductSheetPayload]);

  const openNativeWalletSheet = useCallback(() => {
    const requestId = `native_wallet_${Date.now()}`;
    if (refs.nativeSheetCloseTimerRef.current) {
      clearTimeout(refs.nativeSheetCloseTimerRef.current);
      refs.nativeSheetCloseTimerRef.current = null;
    }

    refs.nativeSheetMetaRef.current.set(requestId, { source: "native_wallet" });
    setters.setNativeSheet({
      requestId,
      sheetKey: "wallet_info",
      payload: {
        title: "Cashback balance",
        description: "Bonuses for your orders",
        youHaveLabel: "You have",
        conversionNote: "1 bonus = 1 sum",
        howToSpendTitle: "How to spend bonuses",
        howToSpendDescription:
          "Apply bonuses during checkout and pay part of your order with them.",
        amount: Number(state.walletBalance || 0),
      },
      options: {},
    });
    setters.setIsNativeSheetVisible(true);
  }, [refs, setters, state.walletBalance]);

  const closeNativeSheet = useCallback(({ shouldNotify = true } = {}) => {
    setters.setIsNativeSheetVisible(false);
    const requestId = state.nativeSheet?.requestId;
    const meta = requestId ? refs.nativeSheetMetaRef.current.get(requestId) : null;
    if (refs.nativeSheetCloseTimerRef.current) clearTimeout(refs.nativeSheetCloseTimerRef.current);

    refs.nativeSheetCloseTimerRef.current = setTimeout(() => {
      setters.setNativeSheet(null);
      if (requestId) refs.nativeSheetMetaRef.current.delete(requestId);
      refs.nativeGuardOpenRef.current = false;

      if (meta?.source === "native_guard") {
        setTabBarForcedHidden(false);
        if (Platform.OS === "ios") {
          let attempts = 0;
          const tryGoHomeTab = () => {
            attempts += 1;
            try { router.replace("/(tabs)"); return; } catch {
              if (attempts < 12) refs.iosHomeRedirectTimerRef.current = setTimeout(tryGoHomeTab, 80);
            }
          };
          if (refs.iosHomeRedirectTimerRef.current) clearTimeout(refs.iosHomeRedirectTimerRef.current);
          refs.iosHomeRedirectTimerRef.current = setTimeout(tryGoHomeTab, 0);
        }
        navigateWebPath("/");
        return;
      }

      if (shouldNotify && requestId) emitToWeb(BOTTOM_SHEET_CLOSE_EVENT, { requestId });
    }, NATIVE_SHEET_CLOSE_MS);
  }, [emitToWeb, navigateWebPath, refs, router, setters, state.nativeSheet?.requestId]);

  const handleNativeSheetAction = useCallback(async (actionId, payload) => {
    if (!state.nativeSheet?.requestId || !actionId) return;
    const meta = refs.nativeSheetMetaRef.current.get(state.nativeSheet.requestId);

    if (meta?.source === PRODUCT_SHEET_KEY) {
      const productId = state.nativeSheet?.payload?.productId;
      if (actionId === "catalog") {
        closeNativeSheet({ shouldNotify: false });
        setTimeout(() => goNativeTab("catalog"), NATIVE_SHEET_CLOSE_MS);
        return;
      }

      const delta = actionId === "add_to_cart" || actionId === "increment" ? 1 : actionId === "decrement" ? -1 : 0;
      if (!productId || !delta) return;
      const currentQuantity = Math.max(0, Number(state.nativeSheet?.payload?.quantity || 0));
      if (delta < 0 && currentQuantity <= 0) return;

      const tokensString = await getStoredAuthTokens();
      const tokens = parseTokensString(tokensString);
      if (!tokens?.access) {
        queuePendingAuthAction({ type: "cart", productId, delta });
        closeNativeSheet({ shouldNotify: false });
        openLogin();
        return;
      }

      updateNativeProductSheetPayload({ isCartPending: true });
      try {
        const updated = await adjustCartItemByProduct(tokens.access, productId, delta);
        const nextQuantity = Math.max(0, updated?.quantity ?? currentQuantity + delta);
        configureProductSheetLayout();
        updateNativeProductSheetPayload({ quantity: nextQuantity, isCartPending: false });
        setters.setCartCount((prevCount) => Math.max(0, prevCount + delta));
        emitToWeb("cart:updated", { productId, quantity: nextQuantity });
      } catch {
        updateNativeProductSheetPayload({ isCartPending: false });
      }
      return;
    }

    if (meta?.source === "native_guard" && actionId === "login") {
      setTabBarForcedHidden(false);
      if (refs.webViewRef.current) {
        const target = refs.authReturnPathRef.current;
        refs.webViewRef.current.injectJavaScript(`(function(){try{window.localStorage.setItem('lastPath', ${JSON.stringify(target || "/")});}catch(e){}true;})();`);
      }
      setters.setIsNativeSheetVisible(false);
      if (refs.nativeSheetCloseTimerRef.current) clearTimeout(refs.nativeSheetCloseTimerRef.current);
      refs.nativeSheetCloseTimerRef.current = setTimeout(() => {
        refs.nativeSheetMetaRef.current.delete(state.nativeSheet.requestId);
        setters.setNativeSheet(null);
        refs.nativeGuardOpenRef.current = false;
        navigateWebPath("/login/phone");
      }, NATIVE_SHEET_CLOSE_MS);
      return;
    }

    if (meta?.source === "web_login_required" && actionId === "login") {
      emitToWeb(BOTTOM_SHEET_CLOSE_EVENT, { requestId: state.nativeSheet.requestId });
      setters.setIsNativeSheetVisible(false);
      if (refs.nativeSheetCloseTimerRef.current) clearTimeout(refs.nativeSheetCloseTimerRef.current);
      const requestId = state.nativeSheet.requestId;
      refs.nativeSheetMetaRef.current.delete(requestId);
      setters.setNativeSheet(null);
      refs.nativeGuardOpenRef.current = false;
      openLogin();
      refs.nativeSheetCloseTimerRef.current = setTimeout(() => {
        refs.nativeSheetMetaRef.current.delete(requestId);
        refs.nativeGuardOpenRef.current = false;
      }, NATIVE_SHEET_CLOSE_MS);
      return;
    }

    emitToWeb(BOTTOM_SHEET_ACTION_EVENT, { requestId: state.nativeSheet.requestId, actionId, payload: payload ?? null });
    if (state.nativeSheet.sheetKey === "catalog_filter" && actionId === "apply") {
      closeNativeSheet({ shouldNotify: false });
    }
  }, [closeNativeSheet, emitToWeb, goNativeTab, navigateWebPath, openLogin, queuePendingAuthAction, refs, setters, state.nativeSheet, updateNativeProductSheetPayload]);

  return {
    closeNativeSheet,
    flushPendingAuthAction,
    handleNativeSheetAction,
    openNativeProductSheet,
    openNativeWalletSheet,
  };
}
