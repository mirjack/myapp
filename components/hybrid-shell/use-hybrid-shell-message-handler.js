import { useCallback } from "react";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { openBrowserAsync } from "expo-web-browser";

import {
  getStoredAuthTokens,
  setPendingAuthAction,
  setStoredAuthTokens,
} from "@/lib/auth-storage";
import { setAuthStateCache } from "@/lib/auth-guard-bridge";
import { applyAppLanguage } from "@/lib/i18n";
import {
  getLastNonProductWebPath,
  setCurrentWebPath,
  setTabBarForcedHidden,
} from "@/lib/tab-bar-visibility";
import {
  buildNativeAccountRoute,
  isNativeAccountPath,
} from "@/lib/native-account-routes";
import {
  buildNativeSupportRoute,
  isSupportChatPath,
} from "@/lib/support-chat-routes";

import {
  ROUTE_GUARD_PATHS,
} from "./constants";
import { updateHeaderCache } from "./header-cache";
import {
  normalizeStoriesPayload,
  normalizeToTabPath,
  toNumber,
} from "./utils";
import { buildBridgeScript } from "./scripts";
import { toNativeTabsRoute } from "./navigation-helpers";

export function useHybridShellMessageHandler({
  core,
  closeNativeSheet,
  flushPendingAuthAction,
  goNativeTab,
  interceptSupportChatLinks,
  navigateWebPath,
  openNativeProductSheet,
  productScreenMode = false,
  routePath,
  router,
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

        setters.setBridgeScript(buildBridgeScript(tokensString, Platform.OS, state.languageCode));
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

      const syncWebLanguage = async (nextLanguageCode) => {
        const tokensString = await getStoredAuthTokens();
        setters.setBridgeScript(buildBridgeScript(tokensString, Platform.OS, nextLanguageCode));
        refs.webViewRef.current?.injectJavaScript(`
          (function () {
            try {
              if (typeof window.__handleNativeMessage === "function") {
                window.__handleNativeMessage(${JSON.stringify(JSON.stringify({
                  type: "LANGUAGE_CHANGE",
                  payload: { language: nextLanguageCode },
                }))});
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

      if (message?.type === "OPEN_PRODUCT_SCREEN") {
        const productPath = message?.payload?.productPath;
        if (typeof productPath === "string" && productPath.startsWith("/products/")) {
          router.push({
            pathname: "/product",
            params: { productPath },
          });
          return;
        }
      }

      if (message?.type === "OPEN_CHECKOUT_SCREEN") {
        setCurrentWebPath("/checkout");
        setters.setCurrentPath("/checkout");
        requestAnimationFrame(() => {
          router.replace("/checkout");
        });
        return;
      }

      if (message?.type === "OPEN_CART_SCREEN") {
        setCurrentWebPath("/cart");
        setters.setCurrentPath("/cart");
        requestAnimationFrame(() => {
          router.replace(toNativeTabsRoute("/cart"));
        });
        return;
      }

      if (message?.type === "OPEN_STORIES") {
        const storiesPayload = normalizeStoriesPayload(message?.payload);
        if (storiesPayload.items.length > 0) {
          setters.setNativeStories({
            ...storiesPayload,
            viewerKey: `stories_${Date.now()}_${storiesPayload.startIndex}`,
          });
        }
        return;
      }

      if (message?.type === "WEB_FULLSCREEN") {
        const enabled = Boolean(message?.payload?.enabled);
        setters.setIsWebFullscreen(enabled);
        setTabBarForcedHidden(enabled || shouldShowInlineAuthGuard);
        return;
      }

      if (message?.type === "SET_TAB_BAR_HIDDEN") {
        const hidden = Boolean(message?.payload?.hidden);
        setTabBarForcedHidden(hidden || shouldShowInlineAuthGuard);
        return;
      }

      if (message?.type === "CLOSE_PRODUCT_SCREEN" && productScreenMode) {
        setCurrentWebPath(getLastNonProductWebPath());
        router.back();
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

      if (message?.type === "SET_LANGUAGE") {
        const requestedLanguageCode = message?.payload?.language;
        if (!requestedLanguageCode) return;
        applyAppLanguage(requestedLanguageCode)
          .then((nextLanguageCode) => {
            setters.setLanguageCode(nextLanguageCode);
            syncWebLanguage(nextLanguageCode).catch(() => {});
          })
          .catch(() => {});
        return;
      }

      if (message?.type === "AUTH_LOGOUT") {
        syncWebAuthSession(null);
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

      if (message?.type === "OPEN_TAB_PATH") {
        const path = message?.payload?.path;
        if (typeof path !== "string" || !path.startsWith("/")) return;
        applyNativeInsetForPath(path);
        if (isNativeAccountPath(path)) {
          router.push(buildNativeAccountRoute(path, message?.state));
          setters.setCurrentPath("/profile");
          setCurrentWebPath("/profile");
          return;
        }
        setCurrentWebPath(path);
        if (productScreenMode) {
          const nextNativeRoute = path.startsWith("/checkout")
            ? "/checkout"
            : toNativeTabsRoute(path);
          router.replace(nextNativeRoute);
          return;
        }
        router.navigate(toNativeTabsRoute(path));
        return;
      }

      if (message?.type === "pathChange") {
        const path = message?.path;
        if (typeof path === "string" && path.startsWith("/")) {
          if (productScreenMode && !path.startsWith("/products/")) {
            applyNativeInsetForPath(path);
            setters.setCurrentPath(path);
            setCurrentWebPath(path);
            const nextNativeRoute = path.startsWith("/checkout")
              ? "/checkout"
              : toNativeTabsRoute(path);
            router.replace(nextNativeRoute);
            return;
          }
          if (
            Platform.OS === "ios" &&
            path.startsWith("/checkout") &&
            routePath !== "/checkout"
          ) {
            router.push("/checkout");
            requestAnimationFrame(() => {
              navigateWebPath("/cart");
              setters.setCurrentPath("/cart");
              setCurrentWebPath("/cart");
            });
            return;
          }
          const nextTabPath = normalizeToTabPath(path);
          const currentTabPath = normalizeToTabPath(routePath || "/");
          if (isNativeAccountPath(path)) {
            router.push(buildNativeAccountRoute(path, message?.state));
            setters.setCurrentPath("/profile");
            setCurrentWebPath("/profile");
            return;
          }
          if (interceptSupportChatLinks && isSupportChatPath(path)) {
            const tabRoutePath = normalizeToTabPath(routePath || "/");
            const previousPath =
              state.currentPath &&
              !isSupportChatPath(state.currentPath) &&
              normalizeToTabPath(state.currentPath) === tabRoutePath
                ? state.currentPath
                : tabRoutePath;
            router.push(buildNativeSupportRoute(path, message?.state));
            requestAnimationFrame(() => {
              navigateWebPath(previousPath);
              setCurrentWebPath(previousPath);
            });
            return;
          }
          if (nextTabPath !== currentTabPath) {
            applyNativeInsetForPath(path);
            setters.setCurrentPath(path);
            setCurrentWebPath(path);
            router.navigate(toNativeTabsRoute(path));
            return;
          }
          applyNativeInsetForPath(path);
          setters.setCurrentPath(path);
          setCurrentWebPath(path);
        }
      }
    },
    [
      closeNativeSheet,
      flushPendingAuthAction,
      goNativeTab,
      interceptSupportChatLinks,
      navigateWebPath,
      openNativeProductSheet,
      refs,
      router,
      routePath,
      setters,
      productScreenMode,
      shouldShowInlineAuthGuard,
      state.languageCode,
      state.nativeSheet?.requestId,
      state.currentPath,
    ],
  );

  return { onMessage };
}


