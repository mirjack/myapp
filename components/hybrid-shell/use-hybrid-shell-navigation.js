import { useCallback, useEffect, useMemo, useRef } from "react";
import { BackHandler, Platform } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Easing, useSharedValue, withTiming } from "react-native-reanimated";
import { openBrowserAsync } from "expo-web-browser";

import {
  getCurrentWebPath,
  getLastNonProductWebPath,
  isTabBarVisiblePath,
  setCurrentWebPath,
  setTabBarForcedHidden,
} from "@/lib/tab-bar-visibility";
import { isWebViewInternalUrl } from "@/lib/runtime-config";
import { getStoredAuthTokens } from "@/lib/auth-storage";
import { getStoredLanguageCode } from "@/lib/app-preferences";
import {
  buildNativeAccountRoute,
  isNativeAccountPath,
} from "@/lib/native-account-routes";
import {
  buildNativeSupportRoute,
  isSupportChatPath,
} from "@/lib/support-chat-routes";

import {
  ANDROID_TAB_ITEMS,
  HEADER_VISIBLE_PATHS,
  INITIAL_WEB_URL,
  LOGIN_PATH_PREFIXES,
  ROOT_PATHS,
  ROUTE_GUARD_PATHS,
} from "./constants";
import {
  getPathFromUrl,
  isTabActive,
  normalizeToTabPath,
  startsWithAny,
  toNumber,
} from "./utils";
import {
  goNativeTabImpl,
  goToNativeLoginScreenImpl,
} from "./navigation-helpers";
import { buildBridgeScript } from "./scripts";

export function useHybridShellNavigation({
  routePath,
  router,
  rootNavigationState,
  core,
  interceptSupportChatLinks = true,
}) {
  const { refs, state, setters } = core;
  const initialRoutePathRef = useRef(state.currentPath);
  const lastFocusSyncedPathRef = useRef(null);
  const fullscreenProgress = useSharedValue(0);
  const isChromeFullscreen = state.isWebFullscreen && !state.isNativeSheetVisible;

  const shouldRenderHeader = useMemo(
    () => startsWithAny(state.currentPath, HEADER_VISIBLE_PATHS),
    [state.currentPath],
  );

  const shouldShowInlineAuthGuard = useMemo(() => {
    if (state.isLoggedIn) return false;
    if (startsWithAny(state.currentPath, LOGIN_PATH_PREFIXES)) return false;
    return ROUTE_GUARD_PATHS.has(normalizeToTabPath(routePath || "/"));
  }, [routePath, state.currentPath, state.isLoggedIn]);

  const shouldRenderAndroidTabBar =
    Platform.OS === "android" && isTabBarVisiblePath(state.currentPath);
  const activeAndroidTabIndex = useMemo(() => {
    const foundIndex = ANDROID_TAB_ITEMS.findIndex((tab) =>
      isTabActive(state.currentPath, tab),
    );
    return foundIndex >= 0 ? foundIndex : 0;
  }, [state.currentPath]);
  const activeAndroidTabKey =
    ANDROID_TAB_ITEMS[activeAndroidTabIndex]?.key || "home";

  const formattedWalletBalance = useMemo(
    () =>
      new Intl.NumberFormat("en-US", { useGrouping: true })
        .format(Math.trunc(toNumber(state.walletBalance)))
        .replace(/,/g, " "),
    [state.walletBalance],
  );

  const navigateWebPath = useCallback(
    (path) => {
      const safePath = path?.startsWith("/") ? path : "/";
      const js = `(function(){try{var nextPath=${JSON.stringify(safePath)};if(typeof window.__reactRouter_navigate === "function"){window.__reactRouter_navigate(nextPath);}else if(window.location.pathname !== nextPath){window.__pendingNativePath=nextPath;}}catch(e){}true;})();`;
      if (state.isWebReady && refs.webViewRef.current) {
        refs.webViewRef.current.injectJavaScript(js);
        setters.setCurrentPath(safePath);
      } else {
        refs.pendingPathRef.current = safePath;
        setters.setCurrentPath(safePath);
      }
    },
    [refs.pendingPathRef, refs.webViewRef, setters, state.isWebReady],
  );

  const syncWebContext = useCallback(async () => {
    const [tokensString, storedLanguageCode] = await Promise.all([
      getStoredAuthTokens(),
      getStoredLanguageCode(),
    ]);
    const tokens = tokensString ? JSON.parse(tokensString) : null;
    const nextLanguageCode = storedLanguageCode || state.languageCode || "ru";

    setters.setBridgeScript(
      buildBridgeScript(tokensString, Platform.OS, nextLanguageCode),
    );
    setters.setLanguageCode(nextLanguageCode);

    refs.webViewRef.current?.injectJavaScript(`
      (function () {
        try {
          if (typeof window.__handleNativeMessage === "function") {
            window.__handleNativeMessage(${JSON.stringify(
              JSON.stringify(
                tokens
                  ? { type: "AUTH_SESSION", payload: tokens }
                  : { type: "AUTH_LOGOUT" },
              ),
            )});
            window.__handleNativeMessage(${JSON.stringify(
              JSON.stringify({
                type: "LANGUAGE_CHANGE",
                payload: { language: nextLanguageCode },
              }),
            )});
          }
        } catch (e) {}
        true;
      })();
    `);
  }, [refs.webViewRef, setters, state.languageCode]);

  const goToNativeLoginScreen = useCallback(
    (targetPath) => {
      goToNativeLoginScreenImpl({ refs, rootNavigationState, router, targetPath });
    },
    [refs, rootNavigationState, router],
  );

  const goNativeTab = useCallback(
    (tabKey) => {
      const targetTab = ANDROID_TAB_ITEMS.find((tab) => tab.key === tabKey);
      if (targetTab && isTabActive(state.currentPath, targetTab)) return;
      goNativeTabImpl({ tabKey, navigateWebPath, router });
    },
    [navigateWebPath, router, state.currentPath],
  );

  const openLogin = useCallback(() => {
    const fallbackPath = normalizeToTabPath(routePath || "/");
    const returnPath = ROUTE_GUARD_PATHS.has(fallbackPath) ? fallbackPath : "/";
    if (Platform.OS === "ios") {
      goToNativeLoginScreen(returnPath);
      return;
    }

    refs.authReturnPathRef.current = returnPath;
    if (refs.webViewRef.current) {
      refs.webViewRef.current.injectJavaScript(`(function(){try{window.localStorage.setItem('lastPath', ${JSON.stringify(returnPath)});}catch(e){}true;})();`);
    }
    setCurrentWebPath("/login/phone");
    navigateWebPath("/login/phone");
  }, [goToNativeLoginScreen, navigateWebPath, refs.authReturnPathRef, refs.webViewRef, routePath]);

  const onNavigationStateChange = useCallback((nextNavState) => {
    const nextUrl = nextNavState?.url || INITIAL_WEB_URL;
    const nextPath = getPathFromUrl(nextUrl);
    refs.webViewRef.current?.injectJavaScript(`
      (function () {
        try {
          document.documentElement.style.setProperty('--native-header-inset', '0px');
        } catch (e) {}
        true;
      })();
    `);
    setters.setCurrentPath(nextPath);
    setters.setCanGoBack(Boolean(nextNavState?.canGoBack));
  }, [refs.webViewRef, setters]);

  const onShouldStartLoadWithRequest = useCallback((request) => {
    const nextUrl = request?.url;
    if (!nextUrl) return true;
    if (isWebViewInternalUrl(nextUrl)) {
      try {
        const nextPath = new URL(nextUrl).pathname || "/";
        if (isNativeAccountPath(nextPath)) {
          router.push(buildNativeAccountRoute(nextPath, null));
          setters.setCurrentPath("/profile");
          setCurrentWebPath("/profile");
          return false;
        }
        if (interceptSupportChatLinks && isSupportChatPath(nextPath)) {
          const tabRoutePath = normalizeToTabPath(routePath || "/");
          const fallbackPath =
            state.currentPath &&
            !isSupportChatPath(state.currentPath) &&
            normalizeToTabPath(state.currentPath) === tabRoutePath
              ? state.currentPath
              : tabRoutePath;
          router.push(buildNativeSupportRoute(nextPath, null));
          requestAnimationFrame(() => {
            navigateWebPath(fallbackPath);
            setCurrentWebPath(fallbackPath);
          });
          return false;
        }
      } catch {
        return true;
      }
      return true;
    }
    openBrowserAsync(nextUrl).catch(() => {});
    return false;
  }, [interceptSupportChatLinks, navigateWebPath, routePath, router, setters, state.currentPath]);

  const onWebLoadEnd = useCallback(() => {
    setters.setCurrentWebReady(true);
    syncWebContext().catch(() => {});
    if (refs.webViewRef.current) {
      refs.webViewRef.current.injectJavaScript(`
        (function () {
          try {
            document.documentElement.style.setProperty('--native-header-inset', '0px');
            if (typeof window.__applyNativeHeaderInset === "function") {
              window.__applyNativeHeaderInset();
            }
          } catch (e) {}
          true;
        })();
      `);
    }
    if (refs.pendingPathRef.current && refs.webViewRef.current) {
      const path = refs.pendingPathRef.current;
      refs.pendingPathRef.current = null;
      refs.webViewRef.current.injectJavaScript(`(function(){try{var nextPath=${JSON.stringify(path)};if(typeof window.__reactRouter_navigate === "function"){window.__reactRouter_navigate(nextPath);}else if(window.location.pathname !== nextPath){window.__pendingNativePath=nextPath;}}catch(e){}true;})();`);
    }
  }, [refs.pendingPathRef, refs.webViewRef, setters, syncWebContext]);

  const handleBackPress = useCallback(() => {
    if (
      Platform.OS === "android" &&
      routePath.startsWith("/products/") &&
      state.currentPath.startsWith("/products/")
    ) {
      const previousPath = getLastNonProductWebPath() || "/catalog";
      setters.setCurrentPath(previousPath);
      setCurrentWebPath(previousPath);
      router.back();
      return true;
    }
    if (Platform.OS === "android" && state.currentPath.startsWith("/products/")) {
      const previousPath = getLastNonProductWebPath() || "/catalog";
      navigateWebPath(previousPath);
      setters.setCurrentPath(previousPath);
      setCurrentWebPath(previousPath);
      return true;
    }
    if (state.canGoBack && !ROOT_PATHS.has(state.currentPath)) {
      refs.webViewRef.current?.goBack();
      return true;
    }
    if (Platform.OS === "android") {
      if (startsWithAny(state.currentPath, LOGIN_PATH_PREFIXES)) {
        navigateWebPath("/");
        setCurrentWebPath("/");
        return true;
      }
      if (state.currentPath !== "/" && ROOT_PATHS.has(state.currentPath)) {
        navigateWebPath("/");
        setCurrentWebPath("/");
        return true;
      }
      BackHandler.exitApp();
      return true;
    }
    return true;
  }, [navigateWebPath, refs.webViewRef, routePath, router, setters, state.canGoBack, state.currentPath]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") return;
      const sub = BackHandler.addEventListener("hardwareBackPress", handleBackPress);
      return () => sub.remove();
    }, [handleBackPress]),
  );

  useFocusEffect(
    useCallback(() => {
      const sharedPath = getCurrentWebPath();
      const targetTabPath = normalizeToTabPath(routePath || "/");
      if (normalizeToTabPath(sharedPath) !== targetTabPath) {
        lastFocusSyncedPathRef.current = null;
        return undefined;
      }
      if (lastFocusSyncedPathRef.current === sharedPath) return undefined;

      lastFocusSyncedPathRef.current = sharedPath;
      navigateWebPath(sharedPath);
      syncWebContext().catch(() => {});

      return () => {
        lastFocusSyncedPathRef.current = null;
      };
    }, [navigateWebPath, routePath, syncWebContext]),
  );

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    setTabBarForcedHidden(isChromeFullscreen || shouldShowInlineAuthGuard);
    return () => {
      setTabBarForcedHidden(false);
    };
  }, [isChromeFullscreen, shouldShowInlineAuthGuard]);

  useEffect(() => {
    if (!rootNavigationState?.key) return;
    const pendingPath = refs.pendingNativeLoginPathRef.current;
    if (!pendingPath) return;
    refs.pendingNativeLoginPathRef.current = null;
    router.push({ pathname: "/onboarding/phone", params: { next: pendingPath } });
  }, [refs.pendingNativeLoginPathRef, rootNavigationState?.key, router]);

  useEffect(() => {
    setCurrentWebPath(state.currentPath);
  }, [state.currentPath]);

  useEffect(() => {
    if (!state.isAuthLoaded) return;
    const targetPath = normalizeToTabPath(routePath || "/");
    const sharedPath = getCurrentWebPath();
    const desiredPath =
      normalizeToTabPath(sharedPath) === targetPath
        ? sharedPath
        : normalizeToTabPath(initialRoutePathRef.current) === targetPath
          ? initialRoutePathRef.current
          : routePath;

    navigateWebPath(desiredPath);
  }, [navigateWebPath, routePath, state.isAuthLoaded, state.isLoggedIn]);

  useEffect(() => {
    fullscreenProgress.value = withTiming(isChromeFullscreen ? 1 : 0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [fullscreenProgress, isChromeFullscreen]);

  return {
    activeAndroidTabKey,
    activeAndroidTabIndex,
    formattedWalletBalance,
    fullscreenProgress,
    goNativeTab,
    navigateWebPath,
    onNavigationStateChange,
    onShouldStartLoadWithRequest,
    onWebLoadEnd,
    openLogin,
    shouldRenderAndroidTabBar,
    shouldRenderHeader,
    shouldShowInlineAuthGuard,
  };
}
