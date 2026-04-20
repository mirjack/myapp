import { useCallback } from "react";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { openBrowserAsync } from "expo-web-browser";

import {
  clearStoredAuthTokens,
  setPendingAuthAction,
  setStoredAuthTokens,
} from "@/lib/auth-storage";
import { setAuthStateCache } from "@/lib/auth-guard-bridge";
import { setCurrentWebPath, setTabBarForcedHidden } from "@/lib/tab-bar-visibility";

import {
  ROUTE_GUARD_PATHS,
} from "./constants";
import { updateHeaderCache } from "./header-cache";
import {
  normalizeStoriesPayload,
  toNumber,
} from "./utils";
import { buildBridgeScript } from "./scripts";

export function useHybridShellMessageHandler({
  core,
  closeNativeSheet,
  flushPendingAuthAction,
  goNativeTab,
  navigateWebPath,
  openNativeProductSheet,
  shouldShowInlineAuthGuard,
}) {
  const { refs, state, setters } = core;

  const onMessage = useCallback(
    (event) => {
      const applyNativeInsetForPath = () => {
        refs.webViewRef.current?.injectJavaScript(`
          (function () {
            try {
              document.documentElement.style.setProperty('--native-header-inset', '0px');
            } catch (e) {}
            true;
          })();
        `);
      };

      const applyPostLoginTransition = (tokensLike) => {
        flushPendingAuthAction(tokensLike).catch(() => {});
        setTabBarForcedHidden(false);
        const target = refs.authReturnPathRef.current;
        refs.authReturnPathRef.current = null;
        if (target && ROUTE_GUARD_PATHS.has(target)) {
          navigateWebPath(target);
          setCurrentWebPath(target);
          applyNativeInsetForPath(target);
          return;
        }
      };

      const syncWebAuthSession = (tokensLike) => {
        const nextTokens = tokensLike || null;
        const tokensString = nextTokens ? JSON.stringify(nextTokens) : null;
        const nativeMessage = nextTokens
          ? { type: "AUTH_SESSION", payload: nextTokens }
          : { type: "AUTH_LOGOUT" };

        setters.setBridgeScript(buildBridgeScript(tokensString, Platform.OS));
        refs.webViewRef.current?.injectJavaScript(`
          (function () {
            try {
              if (typeof window.__handleNativeMessage === "function") {
                window.__handleNativeMessage(${JSON.stringify(JSON.stringify(nativeMessage))});
              }
            } catch (e) {}
            true;
          })();
        `);
      };

      const raw = event?.nativeEvent?.data;
      if (!raw) return;

      let message;
      try {
        message = JSON.parse(raw);
      } catch {
        return;
      }

      if (message?.type === "OPEN_BOTTOM_SHEET") {
        const incoming = message?.payload;
        if (!incoming?.requestId || !incoming?.sheetKey) return;
        if (refs.nativeSheetCloseTimerRef.current) {
          clearTimeout(refs.nativeSheetCloseTimerRef.current);
          refs.nativeSheetCloseTimerRef.current = null;
        }
        setters.setNativeSheet({
          requestId: String(incoming.requestId),
          sheetKey: String(incoming.sheetKey),
          payload: incoming?.payload && typeof incoming.payload === "object" ? incoming.payload : {},
          options: incoming?.options && typeof incoming.options === "object" ? incoming.options : {},
        });
        refs.nativeSheetMetaRef.current.set(String(incoming.requestId), {
          source: incoming.sheetKey === "login_required" ? "web_login_required" : "web",
        });
        setters.setIsNativeSheetVisible(true);
        return;
      }

      if (message?.type === "CLOSE_BOTTOM_SHEET") {
        const requestId = message?.payload?.requestId;
        if (!requestId || requestId === state.nativeSheet?.requestId) {
          closeNativeSheet({ shouldNotify: false });
        }
        return;
      }

      if (message?.type === "OPEN_PRODUCT_SHEET") {
        openNativeProductSheet(message?.payload || {});
        return;
      }

      if (message?.type === "OPEN_STORIES") {
        const storiesPayload = normalizeStoriesPayload(message?.payload);
        if (storiesPayload.items.length > 0) {
          setters.setNativeStories(storiesPayload);
        }
        return;
      }

      if (message?.type === "WEB_FULLSCREEN") {
        const enabled = Boolean(message?.payload?.enabled);
        setters.setIsWebFullscreen(enabled);
        setTabBarForcedHidden(enabled || shouldShowInlineAuthGuard);
        return;
      }

      if (message?.type === "pendingAuthAction") {
        if (!message?.action) {
          refs.pendingAuthActionRef.current = null;
          setPendingAuthAction(null);
          return;
        }
        try {
          const action = JSON.parse(message.action);
          if (!action?.type || action.productId == null) return;
          refs.pendingAuthActionRef.current = action;
          setPendingAuthAction(action);
        } catch {
          // ignore malformed bridge payloads
        }
        return;
      }

      if (message?.type === "AUTH_LOGIN") {
        const tokens = message?.payload;
        if (tokens && typeof tokens === "object") {
          (async () => {
            const tokensString = JSON.stringify(tokens);
            await setStoredAuthTokens(tokensString);
            setters.setIsLoggedIn(true);
            setAuthStateCache(true);
            syncWebAuthSession(tokens);
            applyPostLoginTransition(tokens);
          })().catch(() => {});
        }
        return;
      }

      if (message?.type === "AUTH_LOGOUT") {
        clearStoredAuthTokens();
        setters.setIsLoggedIn(false);
        setAuthStateCache(false);
        syncWebAuthSession(null);
        updateHeaderCache({ walletBalance: 0 });
        setters.setWalletBalance(0);
        return;
      }

      if (message?.type === "HEADER_DATA") {
        const nextBalance = message?.payload?.walletBalance ?? 0;
        const walletBalance = toNumber(nextBalance);
        updateHeaderCache({ walletBalance });
        setters.setWalletBalance(walletBalance);
        if (message?.payload?.isLoggedIn === true) {
          setters.setIsLoggedIn(true);
          setAuthStateCache(true);
        }
        return;
      }

      if (message?.type === "CART_COUNT") {
        const cartCount = Math.max(0, toNumber(message?.payload?.count ?? 0));
        updateHeaderCache({ cartCount });
        setters.setCartCount(cartCount);
        return;
      }

      if (message?.type === "BRANDING_DATA") {
        const brandTitle = message?.payload?.title || "Comfort Market";
        const brandLogo = message?.payload?.logoUrl || null;
        updateHeaderCache({ brandLogo, brandTitle });
        setters.setBrandTitle(brandTitle);
        setters.setBrandLogo(brandLogo);
        setters.setLogoBroken(false);
        return;
      }

      if (message?.type === "OPEN_EXTERNAL_URL") {
        const url = message?.payload?.url;
        if (url) openBrowserAsync(url).catch(() => {});
        return;
      }

      if (message?.type === "HAPTIC") {
        const style = message?.payload?.style;
        const map = {
          light: Haptics.ImpactFeedbackStyle.Light,
          medium: Haptics.ImpactFeedbackStyle.Medium,
          heavy: Haptics.ImpactFeedbackStyle.Heavy,
        };
        Haptics.impactAsync(map[style] ?? Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        return;
      }

      if (message?.type === "NAVIGATE_TAB") {
        if (Platform.OS === "android") return;
        const tab = message?.payload?.tab;
        if (typeof tab === "string") goNativeTab(tab);
        return;
      }

      if (message?.type === "pathChange") {
        const path = message?.path;
        if (typeof path === "string" && path.startsWith("/")) {
          applyNativeInsetForPath(path);
          setters.setCurrentPath(path);
        }
      }
    },
    [
      closeNativeSheet,
      flushPendingAuthAction,
      goNativeTab,
      navigateWebPath,
      openNativeProductSheet,
      refs,
      setters,
      shouldShowInlineAuthGuard,
      state.nativeSheet?.requestId,
    ],
  );

  return { onMessage };
}


