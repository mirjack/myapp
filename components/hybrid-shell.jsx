import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BackHandler,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useRootNavigationState, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { openBrowserAsync } from "expo-web-browser";
import * as Haptics from "expo-haptics";
import { WebView } from "react-native-webview";
import { NativeBottomSheet } from "@/components/native-bottom-sheet";
import { NativeStoriesViewer } from "@/components/native-stories-viewer";

import {
  clearStoredAuthTokens,
  getPendingAuthAction,
  getStoredAuthTokens,
  setPendingAuthAction,
  setStoredAuthTokens,
} from "@/lib/auth-storage";
import { setAuthStateCache } from "@/lib/auth-guard-bridge";
import {
  isTabBarVisiblePath,
  setTabBarForcedHidden,
  setCurrentWebPath,
} from "@/lib/tab-bar-visibility";
import {
  isWebViewInternalUrl,
  toWebViewUrl,
  WEBVIEW_BASE_URL,
} from "@/lib/runtime-config";
import {
  addFavorite,
  adjustCartItemByProduct,
  fetchProductById,
  getCartItems,
  mapProduct,
} from "@/lib/native-market-api";

const BASE_URL = WEBVIEW_BASE_URL.replace(/\/$/, "");
const INITIAL_WEB_URL = `${BASE_URL}/`;
const BOTTOM_SHEET_CLOSE_EVENT = "native:bottomSheetClose";
const BOTTOM_SHEET_ACTION_EVENT = "native:bottomSheetAction";
const NATIVE_SHEET_CLOSE_MS = 280;
const PRODUCT_SHEET_KEY = "product_detail";
const ROUTE_GUARD_PATHS = new Set(["/cart", "/favorites", "/profile"]);
const LOGIN_PATH_PREFIXES = ["/login", "/register", "/onboarding"];
const LOADING_BACKGROUND_COLOR = "#F8F8F8";
const HEADER_HEIGHT = 64;
const HEADER_CONTENT_HEIGHT = 67;
const HEADER_SHADOW_SPACE = 18;
const HEADER_WRAP_HEIGHT = HEADER_CONTENT_HEIGHT + HEADER_SHADOW_SPACE;
const ANDROID_TAB_WRAP_HEIGHT = 98;

function normalizeStoriesPayload(payload) {
  const items = Array.isArray(payload?.items)
    ? payload.items.filter((item) => item && typeof item === "object")
    : [];
  const numericStartIndex = Number(payload?.startIndex ?? 0);
  const startIndex = Number.isFinite(numericStartIndex)
    ? Math.max(0, Math.trunc(numericStartIndex))
    : 0;
  return { items, startIndex };
}

function authPromptDescription(path) {
  if (path.startsWith("/cart")) return "Чтобы открыть корзину, авторизуйтесь.";
  if (path.startsWith("/favorites")) {
    return "Чтобы открыть избранное, авторизуйтесь.";
  }
  if (path.startsWith("/profile"))
    return "Чтобы открыть профиль, авторизуйтесь.";
  return "Чтобы продолжить, авторизуйтесь.";
}

function normalizeToTabPath(path) {
  if (!path || path === "/home") return "/";
  if (path.startsWith("/catalog")) return "/catalog";
  if (path.startsWith("/cart")) return "/cart";
  if (path.startsWith("/favorites")) return "/favorites";
  if (path.startsWith("/profile")) return "/profile";
  return "/";
}

const ROOT_PATHS = new Set([
  "/",
  "/catalog",
  "/cart",
  "/favorites",
  "/profile",
]);
const HEADER_VISIBLE_PATHS = [
  "/",
  "/home",
  "/catalog",
  "/cart",
  "/favorites",
  "/favorite",
];
const ANDROID_TAB_ITEMS = [
  { key: "home", label: "Home", path: "/" },
  {
    key: "catalog",
    label: "Catalog",
    path: "/catalog",
    match: ["/search"],
  },
  { key: "cart", label: "Cart", path: "/cart" },
  {
    key: "favorites",
    label: "Favorites",
    path: "/favorites",
    match: ["/favorite"],
  },
  { key: "profile", label: "Profile", path: "/profile" },
];

const PRODUCT_SHEET_REQUEST_ID = "native-product-detail";

function parseTokensString(tokensString) {
  if (!tokensString) return null;
  try {
    return JSON.parse(tokensString);
  } catch {
    return null;
  }
}

function isTabActive(pathname, tab) {
  return (
    pathname === tab.path ||
    (tab.match || []).some(
      (matchPath) =>
        pathname === matchPath || pathname.startsWith(`${matchPath}/`),
    )
  );
}

function AndroidTabIcon({ tabKey, color }) {
  if (tabKey === "home") {
    return (
      <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
        <Path
          d="M27.7733 10.68L19.04 3.69335C17.3333 2.33335 14.6666 2.32001 12.9732 3.68001L4.23991 10.68C2.98658 11.68 2.22658 13.68 2.49324 15.2533L4.17324 25.3067C4.55991 27.56 6.65324 29.3333 8.93324 29.3333H23.0666C25.32 29.3333 27.4533 27.52 27.84 25.2933L29.52 15.24C29.76 13.68 29 11.68 27.7733 10.68ZM17 24C17 24.5467 16.5466 25 16 25C15.4533 25 15 24.5467 15 24V20C15 19.4533 15.4533 19 16 19C16.5466 19 17 19.4533 17 20V24Z"
          fill={color}
        />
      </Svg>
    );
  }

  if (tabKey === "catalog") {
    return (
      <Svg
        xmlns="http://www.w3.org/2000/svg"
        width="28"
        height="28"
        viewBox="0 0 28 28"
        fill="none"
      >
        <Path
          d="M4.375 7C4.375 6.30381 4.65156 5.63613 5.14384 5.14384C5.63613 4.65156 6.30381 4.375 7 4.375H9.625C10.3212 4.375 10.9889 4.65156 11.4812 5.14384C11.9734 5.63613 12.25 6.30381 12.25 7V9.625C12.25 10.3212 11.9734 10.9889 11.4812 11.4812C10.9889 11.9734 10.3212 12.25 9.625 12.25H7C6.30381 12.25 5.63613 11.9734 5.14384 11.4812C4.65156 10.9889 4.375 10.3212 4.375 9.625V7ZM4.375 18.375C4.375 17.6788 4.65156 17.0111 5.14384 16.5188C5.63613 16.0266 6.30381 15.75 7 15.75H9.625C10.3212 15.75 10.9889 16.0266 11.4812 16.5188C11.9734 17.0111 12.25 17.6788 12.25 18.375V21C12.25 21.6962 11.9734 22.3639 11.4812 22.8562C10.9889 23.3484 10.3212 23.625 9.625 23.625H7C6.30381 23.625 5.63613 23.3484 5.14384 22.8562C4.65156 22.3639 4.375 21.6962 4.375 21V18.375ZM15.75 7C15.75 6.30381 16.0266 5.63613 16.5188 5.14384C17.0111 4.65156 17.6788 4.375 18.375 4.375H21C21.6962 4.375 22.3639 4.65156 22.8562 5.14384C23.3484 5.63613 23.625 6.30381 23.625 7V9.625C23.625 10.3212 23.3484 10.9889 22.8562 11.4812C22.3639 11.9734 21.6962 12.25 21 12.25H18.375C17.6788 12.25 17.0111 11.9734 16.5188 11.4812C16.0266 10.9889 15.75 10.3212 15.75 9.625V7ZM15.75 18.375C15.75 17.6788 16.0266 17.0111 16.5188 16.5188C17.0111 16.0266 17.6788 15.75 18.375 15.75H21C21.6962 15.75 22.3639 16.0266 22.8562 16.5188C23.3484 17.0111 23.625 17.6788 23.625 18.375V21C23.625 21.6962 23.3484 22.3639 22.8562 22.8562C22.3639 23.3484 21.6962 23.625 21 23.625H18.375C17.6788 23.625 17.0111 23.3484 16.5188 22.8562C16.0266 22.3639 15.75 21.6962 15.75 21V18.375Z"
          fill={color}
        />
      </Svg>
    );
  }

  if (tabKey === "cart") {
    return (
      <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
        <Path
          d="M26.6133 11.9472C25.72 10.9605 24.3733 10.3872 22.5066 10.1872V9.17385C22.5066 7.34718 21.7333 5.58718 20.3733 4.36052C19 3.10718 17.2133 2.52052 15.36 2.69385C12.1733 3.00052 9.49328 6.08052 9.49328 9.41385V10.1872C7.62661 10.3872 6.27995 10.9605 5.38661 11.9472C4.09328 13.3872 4.13328 15.3072 4.27995 16.6405L5.21328 24.0672C5.49328 26.6672 6.54661 29.3339 12.2799 29.3339H19.72C25.4533 29.3339 26.5066 26.6672 26.7866 24.0805L27.72 16.6272C27.8666 15.3072 27.8933 13.3872 26.6133 11.9472ZM15.5466 4.54718C16.88 4.42718 18.1466 4.84052 19.1333 5.73385C20.1066 6.61385 20.6533 7.86718 20.6533 9.17385V10.1072H11.3466V9.41385C11.3466 7.04052 13.3066 4.76052 15.5466 4.54718ZM11.2266 17.5339H11.2133C10.4799 17.5339 9.87995 16.9339 9.87995 16.2005C9.87995 15.4672 10.4799 14.8672 11.2133 14.8672C11.9599 14.8672 12.5599 15.4672 12.5599 16.2005C12.5599 16.9339 11.9599 17.5339 11.2266 17.5339ZM20.56 17.5339H20.5466C19.8133 17.5339 19.2133 16.9339 19.2133 16.2005C19.2133 15.4672 19.8133 14.8672 20.5466 14.8672C21.2933 14.8672 21.8933 15.4672 21.8933 16.2005C21.8933 16.9339 21.2933 17.5339 20.56 17.5339Z"
          fill={color}
        />
      </Svg>
    );
  }

  if (tabKey === "favorites") {
    return (
      <Svg
        xmlns="http://www.w3.org/2000/svg"
        width="28"
        height="28"
        viewBox="0 0 28 28"
        fill="none"
      >
        <Path
          d="M24.5 9.625C24.5 6.72583 22.0512 4.375 19.0307 4.375C16.7732 4.375 14.8342 5.68867 14 7.5635C13.1658 5.68867 11.2268 4.375 8.96817 4.375C5.95 4.375 3.5 6.72583 3.5 9.625C3.5 18.0483 14 23.625 14 23.625C14 23.625 24.5 18.0483 24.5 9.625Z"
          fill="#747479"
        />
      </Svg>
    );
  }

  return (
    <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
      <Path
        d="M16 6.66667C13.42 6.66667 11.3333 8.75333 11.3333 11.3333C11.3333 13.8667 13.28 15.92 15.8267 16.0133C15.92 16 16.0133 16 16.0933 16.0133C16.1067 16.0133 16.12 16.0133 16.1333 16.0133C18.6533 15.92 20.6667 13.8667 20.6667 11.3333C20.6667 8.75333 18.58 6.66667 16 6.66667Z"
        fill={color}
      />
      <Path
        d="M21.3867 18.8667C18.5733 17.0667 13.4267 17.0667 10.6133 18.8667C9.28 19.7333 8.53333 20.9333 8.53333 22.2133C8.53333 23.4933 9.28 24.6933 10.6 25.56C12.0933 26.5867 14.04 27.0667 16 27.0667C17.96 27.0667 19.9067 26.5867 21.4 25.56C22.72 24.6933 23.4667 23.4933 23.4667 22.2C23.4533 20.92 22.72 19.72 21.3867 18.8667Z"
        fill={color}
      />
    </Svg>
  );
}

function AndroidTabButton({ tab, isActive, cartCount, onPress }) {
  const scale = useSharedValue(isActive ? 1.1 : 1);

  useEffect(() => {
    scale.value = withTiming(isActive ? 1.1 : 1, {
      duration: 200,
      easing: Easing.out(Easing.quad),
    });
  }, [isActive, scale]);

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: withTiming(1, { duration: 200 }),
  }));

  return (
    <Pressable onPress={onPress} style={styles.androidTabItem}>
      <Animated.View style={iconAnimatedStyle}>
        <View>
          <AndroidTabIcon
            tabKey={tab.key}
            color={isActive ? "#FE946E" : "#757575"}
          />
          {tab.key === "cart" && cartCount > 0 ? (
            <View style={styles.androidCartBadge}>
              <Text style={styles.androidCartBadgeText}>
                {cartCount > 99 ? "99+" : cartCount}
              </Text>
            </View>
          ) : null}
        </View>
      </Animated.View>
      <Text
        style={[
          styles.androidTabLabel,
          isActive ? styles.androidTabLabelActive : null,
        ]}
      >
        {tab.label}
      </Text>
    </Pressable>
  );
}

const DISABLE_ZOOM_SCRIPT = `
(function() {
  var meta = document.querySelector('meta[name="viewport"]');
  if (meta) {
    meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
  } else {
    var newMeta = document.createElement('meta');
    newMeta.name = 'viewport';
    newMeta.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
    document.head.appendChild(newMeta);
  }

  var style = document.createElement('style');
  style.textContent = '* { -webkit-user-select: none !important; user-select: none !important; } html, body { -ms-overflow-style: none !important; scrollbar-width: none !important; } html::-webkit-scrollbar, body::-webkit-scrollbar, *::-webkit-scrollbar { width: 0 !important; height: 0 !important; display: none !important; }';
  document.head.appendChild(style);
})();
true;
`;

function getPathFromUrl(url) {
  try {
    return new URL(url).pathname.replace(/\/+$/, "") || "/";
  } catch {
    return "/";
  }
}

function startsWithAny(pathname, prefixes) {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function toNumber(value) {
  const str = String(value ?? "0").replace(/\s/g, "");
  const num = Number(str);
  return Number.isFinite(num) ? num : 0;
}

function buildBridgeScript(tokensString, nativePlatform) {
  return `
(function () {
  try {
    window.__NATIVE_APP__ = true;
    window.__NATIVE_PLATFORM__ = ${JSON.stringify(nativePlatform)};
    document.documentElement.dataset.nativeApp = 'true';
    document.documentElement.dataset.nativePlatform = ${JSON.stringify(nativePlatform)};

    var nativeHeaderInsetStyleId = 'native-header-inset-style';
    var nativeHeaderOffset = ${HEADER_CONTENT_HEIGHT};
    var nativeCatalogHeaderOffset = ${HEADER_HEIGHT};
    var nativeHeaderPaths = ${JSON.stringify(HEADER_VISIBLE_PATHS)};

    function hasNativeHeader(pathname) {
      var path = pathname || '/';
      for (var i = 0; i < nativeHeaderPaths.length; i += 1) {
        var prefix = nativeHeaderPaths[i];
        if (path === prefix || path.indexOf(prefix + '/') === 0) return true;
      }
      return false;
    }

    function getNativeHeaderOffset(pathname) {
      var path = pathname || '/';
      if (path === '/catalog' || path.indexOf('/catalog/') === 0 || path === '/search' || path.indexOf('/search/') === 0) {
        return nativeCatalogHeaderOffset;
      }
      return hasNativeHeader(path) ? nativeHeaderOffset : 0;
    }

    function ensureNativeHeaderInsetStyle() {
      if (document.getElementById(nativeHeaderInsetStyleId)) return;
      var style = document.createElement('style');
      style.id = nativeHeaderInsetStyleId;
      style.textContent = 'html[data-native-app="true"] body { padding-top: var(--native-header-inset, 0px) !important; box-sizing: border-box !important; }';
      (document.head || document.documentElement).appendChild(style);
    }

    function applyNativeHeaderInset() {
      try {
        ensureNativeHeaderInsetStyle();
        var offset = getNativeHeaderOffset(window.location.pathname || '/');
        document.documentElement.style.setProperty('--native-header-inset', offset + 'px');
      } catch (e) {}
    }

    window.__applyNativeHeaderInset = applyNativeHeaderInset;
    applyNativeHeaderInset();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', applyNativeHeaderInset, { once: true });
    }

    var nativeTokens = ${JSON.stringify(tokensString ?? null)};
    if (nativeTokens) {
      window.localStorage.setItem('authTokens', nativeTokens);
      try {
        window.dispatchEvent(new CustomEvent('auth:tokens', { detail: JSON.parse(nativeTokens) }));
      } catch (e) {}
    }

    function postTokens() {
      try {
        var tokens = window.localStorage.getItem('authTokens');
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'authTokens',
          tokens: tokens || null,
        }));
      } catch (e) {}
    }

    function postPendingAuthAction() {
      try {
        var action = window.localStorage.getItem('pendingAuthAction');
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'pendingAuthAction',
          action: action || null,
        }));
      } catch (e) {}
    }

    function postPath() {
      try {
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'pathChange',
          path: window.location.pathname || '/',
        }));
      } catch (e) {}
    }

    var originalSetItem = window.localStorage.setItem;
    window.localStorage.setItem = function (key, value) {
      originalSetItem.apply(this, arguments);
      if (key === 'authTokens') postTokens();
      if (key === 'pendingAuthAction') postPendingAuthAction();
    };

    var originalRemoveItem = window.localStorage.removeItem;
    window.localStorage.removeItem = function (key) {
      originalRemoveItem.apply(this, arguments);
      if (key === 'authTokens') postTokens();
      if (key === 'pendingAuthAction') postPendingAuthAction();
    };

    var originalPushState = window.history.pushState;
    window.history.pushState = function () {
      originalPushState.apply(window.history, arguments);
      applyNativeHeaderInset();
      postPath();
    };

    var originalReplaceState = window.history.replaceState;
    window.history.replaceState = function () {
      originalReplaceState.apply(window.history, arguments);
      applyNativeHeaderInset();
      postPath();
    };

    window.addEventListener('popstate', function () {
      applyNativeHeaderInset();
      postPath();
    });

    window.__handleNativeMessage = function (message) {
      try {
        var payload = typeof message === 'string' ? JSON.parse(message) : message;
        if (!payload || !payload.type) return;

        if (payload.type === 'AUTH_LOGOUT') {
          window.localStorage.removeItem('authTokens');
          window.dispatchEvent(new Event('auth:logout'));
        }

        if (payload.type === 'AUTH_TOKENS' && payload.payload) {
          window.localStorage.setItem('authTokens', JSON.stringify(payload.payload));
          window.dispatchEvent(new CustomEvent('auth:tokens', { detail: payload.payload }));
        }
      } catch (e) {}
    };

    postTokens();
    postPendingAuthAction();
    postPath();
  } catch (e) {}
})();
true;
`;
}

export function HybridShell({ routePath = "/" }) {
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const webViewRef = useRef(null);
  const pendingPathRef = useRef(null);
  const pendingNativeLoginPathRef = useRef(null);

  const [currentPath, setCurrentPath] = useState("/");
  const [canGoBack, setCanGoBack] = useState(false);
  const [isWebReady, setIsWebReady] = useState(false);
  const [bridgeScript, setBridgeScript] = useState(() =>
    buildBridgeScript(null, Platform.OS),
  );
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [cartCount, setCartCount] = useState(0);
  const [androidTabBarWidth, setAndroidTabBarWidth] = useState(0);
  const [brandTitle, setBrandTitle] = useState("Comfort Market");
  const [brandLogo, setBrandLogo] = useState(null);
  const [logoBroken, setLogoBroken] = useState(false);
  const [nativeSheet, setNativeSheet] = useState(null);
  const [isNativeSheetVisible, setIsNativeSheetVisible] = useState(false);
  const [isWebFullscreen, setIsWebFullscreen] = useState(false);
  const [nativeStories, setNativeStories] = useState(null);
  const nativeSheetCloseTimerRef = useRef(null);
  const nativeSheetMetaRef = useRef(new Map());
  const nativeGuardOpenRef = useRef(false);
  const iosHomeRedirectTimerRef = useRef(null);
  const authReturnPathRef = useRef(null);
  const productSheetLoadSeqRef = useRef(0);
  const pendingAuthActionRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    getStoredAuthTokens().then((tokensString) => {
      if (!mounted) return;
      const loggedIn = Boolean(tokensString);
      setBridgeScript(buildBridgeScript(tokensString, Platform.OS));
      setIsLoggedIn(loggedIn);
      setAuthStateCache(loggedIn);
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(
    () => () => {
      setTabBarForcedHidden(false);
      if (nativeSheetCloseTimerRef.current) {
        clearTimeout(nativeSheetCloseTimerRef.current);
      }
      if (iosHomeRedirectTimerRef.current) {
        clearTimeout(iosHomeRedirectTimerRef.current);
      }
    },
    [],
  );

  const shouldRenderHeader = useMemo(
    () => startsWithAny(currentPath, HEADER_VISIBLE_PATHS),
    [currentPath],
  );
  const isCatalogPath = useMemo(
    () => startsWithAny(currentPath, ["/catalog", "/search"]),
    [currentPath],
  );
  const shouldApplyTopInset = useMemo(() => {
    if (shouldRenderHeader) return true;
    return (
      Platform.OS === "android" &&
      startsWithAny(currentPath, LOGIN_PATH_PREFIXES)
    );
  }, [currentPath, shouldRenderHeader]);
  const shouldShowInlineAuthGuard = useMemo(() => {
    if (Platform.OS !== "ios") return false;
    if (isLoggedIn) return false;
    if (startsWithAny(currentPath, LOGIN_PATH_PREFIXES)) return false;
    return ROUTE_GUARD_PATHS.has(normalizeToTabPath(routePath || "/"));
  }, [currentPath, isLoggedIn, routePath]);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    setTabBarForcedHidden(isWebFullscreen || shouldShowInlineAuthGuard);
    return () => {
      setTabBarForcedHidden(false);
    };
  }, [isWebFullscreen, shouldShowInlineAuthGuard]);

  const goToNativeLoginScreen = useCallback(
    (targetPath) => {
      const normalized = normalizeToTabPath(targetPath || "/");
      const returnPath = ROUTE_GUARD_PATHS.has(normalized) ? normalized : "/";
      authReturnPathRef.current = returnPath;
      setCurrentWebPath("/login/phone");
      if (!rootNavigationState?.key) {
        pendingNativeLoginPathRef.current = returnPath;
        return;
      }
      router.push({
        pathname: "/onboarding/phone",
        params: { next: returnPath },
      });
    },
    [rootNavigationState?.key, router],
  );

  useEffect(() => {
    if (!rootNavigationState?.key) return;
    const pendingPath = pendingNativeLoginPathRef.current;
    if (!pendingPath) return;
    pendingNativeLoginPathRef.current = null;
    router.push({
      pathname: "/onboarding/phone",
      params: { next: pendingPath },
    });
  }, [rootNavigationState?.key, router]);

  useEffect(() => {
    setCurrentWebPath(currentPath);
  }, [currentPath]);

  const shouldRenderAndroidTabBar =
    Platform.OS === "android" && isTabBarVisiblePath(currentPath);
  const activeAndroidTabIndex = useMemo(() => {
    const foundIndex = ANDROID_TAB_ITEMS.findIndex((tab) =>
      isTabActive(currentPath, tab),
    );
    return foundIndex >= 0 ? foundIndex : 0;
  }, [currentPath]);
  const androidActiveTabIndexAnim = useSharedValue(activeAndroidTabIndex);
  const fullscreenProgress = useSharedValue(0);

  const formattedWalletBalance = useMemo(
    () =>
      new Intl.NumberFormat("en-US", { useGrouping: true })
        .format(toNumber(walletBalance))
        .replace(/,/g, " "),
    [walletBalance],
  );

  const handleBackPress = useCallback(() => {
    if (canGoBack && !ROOT_PATHS.has(currentPath)) {
      webViewRef.current?.goBack();
      return true;
    }

    if (Platform.OS === "android") {
      if (startsWithAny(currentPath, LOGIN_PATH_PREFIXES)) {
        const js = `
          (function () {
            try {
              var nextPath = "/";
              if (typeof window.__reactRouter_navigate === "function") {
                window.__reactRouter_navigate(nextPath);
              } else if (window.location.pathname !== nextPath) {
                window.__pendingNativePath = nextPath;
              }
            } catch (e) {}
            true;
          })();
        `;

        if (isWebReady && webViewRef.current) {
          webViewRef.current.injectJavaScript(js);
          setCurrentPath("/");
        } else {
          pendingPathRef.current = "/";
          setCurrentPath("/");
        }
        setCurrentWebPath("/");
        return true;
      }

      BackHandler.exitApp();
      return true;
    }

    return true;
  }, [canGoBack, currentPath, isWebReady]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") return;
      const sub = BackHandler.addEventListener(
        "hardwareBackPress",
        handleBackPress,
      );
      return () => sub.remove();
    }, [handleBackPress]),
  );

  const onNavigationStateChange = useCallback((nextNavState) => {
    const nextUrl = nextNavState?.url || INITIAL_WEB_URL;
    const nextPath = getPathFromUrl(nextUrl);
    setCurrentPath(nextPath);
    setCanGoBack(Boolean(nextNavState?.canGoBack));
  }, []);

  const onShouldStartLoadWithRequest = useCallback((request) => {
    const nextUrl = request?.url;
    if (!nextUrl) return true;
    if (isWebViewInternalUrl(nextUrl)) return true;

    openBrowserAsync(nextUrl).catch(() => {});
    return false;
  }, []);

  const navigateWebPath = useCallback(
    (path) => {
      const safePath = path?.startsWith("/") ? path : "/";
      const js = `
        (function () {
          try {
            var nextPath = ${JSON.stringify(safePath)};
            if (typeof window.__reactRouter_navigate === "function") {
              window.__reactRouter_navigate(nextPath);
            } else if (window.location.pathname !== nextPath) {
              window.__pendingNativePath = nextPath;
            }
          } catch (e) {}
          true;
        })();
      `;

      if (isWebReady && webViewRef.current) {
        webViewRef.current.injectJavaScript(js);
        setCurrentPath(safePath);
      } else {
        pendingPathRef.current = safePath;
        setCurrentPath(safePath);
      }
    },
    [isWebReady],
  );

  const openNativeAuthGuardSheet = useCallback(
    (targetPath) => {
      if (nativeGuardOpenRef.current) {
        return;
      }
      nativeGuardOpenRef.current = true;
      setTabBarForcedHidden(true);
      authReturnPathRef.current = normalizeToTabPath(targetPath || "/");
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`
          (function () {
            try {
              window.localStorage.setItem('lastPath', ${JSON.stringify(
                normalizeToTabPath(targetPath || "/"),
              )});
            } catch (e) {}
            true;
          })();
        `);
      }

      const requestId = `native_guard_${Date.now()}`;
      if (nativeSheetCloseTimerRef.current) {
        clearTimeout(nativeSheetCloseTimerRef.current);
        nativeSheetCloseTimerRef.current = null;
      }
      nativeSheetMetaRef.current.set(requestId, { source: "native_guard" });
      setNativeSheet({
        requestId,
        sheetKey: "login_required",
        payload: {
          title: "Авторизуйтесь",
          description: authPromptDescription(targetPath || ""),
          imageUrl: `${BASE_URL}/race.png`,
          loginText: "Авторизоваться",
        },
        options: {},
      });
      setIsNativeSheetVisible(true);
      navigateWebPath("/");

      if (Platform.OS === "ios") {
        let attempts = 0;
        const tryGoHomeTab = () => {
          attempts += 1;
          try {
            router.replace("/(tabs)");
            return;
          } catch {
            if (attempts < 12) {
              iosHomeRedirectTimerRef.current = setTimeout(tryGoHomeTab, 80);
            }
          }
        };
        if (iosHomeRedirectTimerRef.current) {
          clearTimeout(iosHomeRedirectTimerRef.current);
        }
        iosHomeRedirectTimerRef.current = setTimeout(tryGoHomeTab, 0);
      }
    },
    [navigateWebPath, router],
  );

  // Android: guard tab o'z HybridShell'ini render qiladi, shuning uchun bu yerda tekshiramiz.
  // iOS: guard tab sahifalari (cart/favorites/profile) mount bo'lganda o'zlari redirect qiladi.
  useEffect(() => {
    const targetPath = normalizeToTabPath(routePath || "/");
    if (Platform.OS === "ios") return;
    if (isLoggedIn) return;
    if (!ROUTE_GUARD_PATHS.has(targetPath)) return;
    openNativeAuthGuardSheet(targetPath);
  }, [isLoggedIn, routePath, openNativeAuthGuardSheet]);

  useEffect(() => {
    if (!isLoggedIn) {
      const targetPath = normalizeToTabPath(routePath || "/");
      if (ROUTE_GUARD_PATHS.has(targetPath)) {
        return;
      }
    }
    navigateWebPath(routePath);
  }, [isLoggedIn, navigateWebPath, routePath]);

  useEffect(() => {
    androidActiveTabIndexAnim.value = withTiming(activeAndroidTabIndex, {
      duration: 250,
      easing: Easing.out(Easing.cubic),
    });
  }, [activeAndroidTabIndex, androidActiveTabIndexAnim]);

  useEffect(() => {
    fullscreenProgress.value = withTiming(isWebFullscreen ? 1 : 0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [fullscreenProgress, isWebFullscreen]);

  const goNativeTab = useCallback(
    (tabKey) => {
      Haptics.selectionAsync().catch(() => {});

      if (Platform.OS === "android") {
        if (
          !isLoggedIn &&
          (tabKey === "cart" || tabKey === "favorites" || tabKey === "profile")
        ) {
          openNativeAuthGuardSheet(`/${tabKey}`);
          return;
        }
        if (tabKey === "home") navigateWebPath("/");
        if (tabKey === "catalog") navigateWebPath("/catalog");
        if (tabKey === "cart") navigateWebPath("/cart");
        if (tabKey === "favorites") navigateWebPath("/favorites");
        if (tabKey === "profile") navigateWebPath("/profile");
        return;
      }

      if (tabKey === "home") router.navigate("/(tabs)");
      if (tabKey === "catalog") router.navigate("/(tabs)/catalog");
      if (tabKey === "cart") router.navigate("/(tabs)/cart");
      if (tabKey === "favorites") router.navigate("/(tabs)/favorites");
      if (tabKey === "profile") router.navigate("/(tabs)/profile");
    },
    [isLoggedIn, navigateWebPath, openNativeAuthGuardSheet, router],
  );

  const openLogin = useCallback(() => {
    const fallbackPath = normalizeToTabPath(routePath || "/");
    const returnPath = ROUTE_GUARD_PATHS.has(fallbackPath) ? fallbackPath : "/";
    if (Platform.OS === "ios") {
      goToNativeLoginScreen(returnPath);
      return;
    }
    authReturnPathRef.current = returnPath;
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        (function () {
          try {
            window.localStorage.setItem('lastPath', ${JSON.stringify(returnPath)});
          } catch (e) {}
          true;
        })();
      `);
    }
    setCurrentWebPath("/login/phone");
    navigateWebPath("/login/phone");
  }, [goToNativeLoginScreen, navigateWebPath, routePath]);

  const queuePendingAuthAction = useCallback((action) => {
    if (!action?.type || action.productId == null) return;
    pendingAuthActionRef.current = action;
    setPendingAuthAction(action);
  }, []);

  const emitToWeb = useCallback((eventName, detail) => {
    if (!webViewRef.current) return;
    const payload = JSON.stringify(detail || {});
    webViewRef.current.injectJavaScript(`
      (function () {
        try {
          window.dispatchEvent(new CustomEvent(${JSON.stringify(eventName)}, { detail: ${payload} }));
        } catch (e) {}
        true;
      })();
    `);
  }, []);

  const flushPendingAuthAction = useCallback(
    async (tokens) => {
      if (!tokens?.access) return;
      const action =
        pendingAuthActionRef.current ?? (await getPendingAuthAction());
      if (!action?.type || action.productId == null) return;
      pendingAuthActionRef.current = null;
      await setPendingAuthAction(null);

      try {
        if (action.type === "cart") {
          const updated = await adjustCartItemByProduct(
            tokens.access,
            action.productId,
            Number(action.delta) || 1,
          );
          const nextQuantity = Math.max(0, Number(updated?.quantity ?? 0));
          setCartCount((prevCount) =>
            Math.max(0, prevCount + (Number(action.delta) || 1)),
          );
          emitToWeb("cart:updated", {
            productId: action.productId,
            quantity: nextQuantity,
          });
          return;
        }

        if (action.type === "favorite") {
          await addFavorite(tokens.access, action.productId);
          emitToWeb("favorites:updated", { productId: action.productId });
        }
      } catch {
        // Keep auth success smooth even if the queued product action fails.
      }
    },
    [emitToWeb],
  );

  const updateNativeProductSheetPayload = useCallback((updater) => {
    setNativeSheet((current) => {
      if (!current || current.sheetKey !== PRODUCT_SHEET_KEY) return current;
      const nextPayload =
        typeof updater === "function"
          ? updater(current.payload || {})
          : updater || {};
      return {
        ...current,
        payload: {
          ...(current.payload || {}),
          ...nextPayload,
        },
      };
    });
  }, []);

  const refreshNativeProductQuantity = useCallback(
    async (productId, seq) => {
      const tokensString = await getStoredAuthTokens();
      const tokens = parseTokensString(tokensString);
      if (!tokens?.access) {
        if (seq === productSheetLoadSeqRef.current) {
          updateNativeProductSheetPayload({ quantity: 0 });
        }
        return;
      }
      try {
        const response = await getCartItems(tokens.access);
        const items = Array.isArray(response)
          ? response
          : (response?.items ?? []);
        const found = items.find(
          (entry) => String(entry.product?.id) === String(productId),
        );
        if (seq === productSheetLoadSeqRef.current) {
          updateNativeProductSheetPayload({ quantity: found?.quantity ?? 0 });
        }
      } catch {
        if (seq === productSheetLoadSeqRef.current) {
          updateNativeProductSheetPayload({ quantity: 0 });
        }
      }
    },
    [updateNativeProductSheetPayload],
  );

  const openNativeProductSheet = useCallback(
    async ({ productId, product }) => {
      const resolvedId = productId ?? product?.id;
      if (!resolvedId) return;
      const requestId = PRODUCT_SHEET_REQUEST_ID;
      const seq = productSheetLoadSeqRef.current + 1;
      productSheetLoadSeqRef.current = seq;

      if (nativeSheetCloseTimerRef.current) {
        clearTimeout(nativeSheetCloseTimerRef.current);
        nativeSheetCloseTimerRef.current = null;
      }

      const initialProduct =
        product && typeof product === "object" ? mapProduct(product) : null;
      setNativeSheet({
        requestId,
        sheetKey: PRODUCT_SHEET_KEY,
        payload: {
          productId: String(resolvedId),
          product: initialProduct,
          fallbackProduct: initialProduct,
          quantity: 0,
          isLoading: true,
          isCartPending: false,
          error: null,
        },
        options: { hideClose: false },
      });
      nativeSheetMetaRef.current.set(requestId, { source: PRODUCT_SHEET_KEY });
      setIsNativeSheetVisible(true);

      refreshNativeProductQuantity(resolvedId, seq);
      try {
        const data = await fetchProductById(resolvedId);
        if (seq !== productSheetLoadSeqRef.current) return;
        updateNativeProductSheetPayload((current) => ({
          product:
            data ||
            current.product ||
            current.fallbackProduct ||
            initialProduct,
          isLoading: false,
          error:
            data || current.product || current.fallbackProduct || initialProduct
              ? null
              : "Product not found.",
        }));
      } catch {
        if (seq !== productSheetLoadSeqRef.current) return;
        updateNativeProductSheetPayload((current) => ({
          product: current.product || current.fallbackProduct || initialProduct,
          isLoading: false,
          error:
            current.product || current.fallbackProduct || initialProduct
              ? null
              : "Failed to load product information.",
        }));
      }
    },
    [refreshNativeProductQuantity, updateNativeProductSheetPayload],
  );

  const closeNativeSheet = useCallback(
    ({ shouldNotify = true } = {}) => {
      setIsNativeSheetVisible(false);
      const requestId = nativeSheet?.requestId;
      const meta = requestId ? nativeSheetMetaRef.current.get(requestId) : null;
      if (nativeSheetCloseTimerRef.current) {
        clearTimeout(nativeSheetCloseTimerRef.current);
      }
      nativeSheetCloseTimerRef.current = setTimeout(() => {
        setNativeSheet(null);
        if (requestId) {
          nativeSheetMetaRef.current.delete(requestId);
        }
        nativeGuardOpenRef.current = false;
        if (meta?.source === "native_guard") {
          setTabBarForcedHidden(false);
          if (Platform.OS === "ios") {
            let attempts = 0;
            const tryGoHomeTab = () => {
              attempts += 1;
              try {
                router.replace("/(tabs)");
                return;
              } catch {
                if (attempts < 12) {
                  iosHomeRedirectTimerRef.current = setTimeout(
                    tryGoHomeTab,
                    80,
                  );
                }
              }
            };
            if (iosHomeRedirectTimerRef.current) {
              clearTimeout(iosHomeRedirectTimerRef.current);
            }
            iosHomeRedirectTimerRef.current = setTimeout(tryGoHomeTab, 0);
          }
          navigateWebPath("/");
          return;
        }
        if (shouldNotify && requestId) {
          emitToWeb(BOTTOM_SHEET_CLOSE_EVENT, { requestId });
        }
      }, NATIVE_SHEET_CLOSE_MS);
    },
    [emitToWeb, nativeSheet?.requestId, navigateWebPath, router],
  );

  const handleNativeSheetAction = useCallback(
    async (actionId, payload) => {
      if (!nativeSheet?.requestId || !actionId) return;
      const meta = nativeSheetMetaRef.current.get(nativeSheet.requestId);
      if (meta?.source === PRODUCT_SHEET_KEY) {
        const productId = nativeSheet?.payload?.productId;
        if (actionId === "catalog") {
          closeNativeSheet({ shouldNotify: false });
          goNativeTab("catalog");
          return;
        }

        const delta =
          actionId === "add_to_cart" || actionId === "increment"
            ? 1
            : actionId === "decrement"
              ? -1
              : 0;
        if (!productId || !delta) return;
        const currentQuantity = Math.max(
          0,
          Number(nativeSheet?.payload?.quantity || 0),
        );
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
          const updated = await adjustCartItemByProduct(
            tokens.access,
            productId,
            delta,
          );
          const nextQuantity = Math.max(
            0,
            updated?.quantity ?? currentQuantity + delta,
          );
          updateNativeProductSheetPayload({
            quantity: nextQuantity,
            isCartPending: false,
          });
          setCartCount((prevCount) => Math.max(0, prevCount + delta));
          emitToWeb("cart:updated", { productId, quantity: nextQuantity });
        } catch {
          updateNativeProductSheetPayload({ isCartPending: false });
        }
        return;
      }

      if (meta?.source === "native_guard" && actionId === "login") {
        setTabBarForcedHidden(false);
        if (webViewRef.current) {
          const target = authReturnPathRef.current;
          webViewRef.current.injectJavaScript(`
            (function () {
              try {
                window.localStorage.setItem('lastPath', ${JSON.stringify(
                  target || "/",
                )});
              } catch (e) {}
              true;
            })();
          `);
        }
        setIsNativeSheetVisible(false);
        if (nativeSheetCloseTimerRef.current) {
          clearTimeout(nativeSheetCloseTimerRef.current);
        }
        nativeSheetCloseTimerRef.current = setTimeout(() => {
          nativeSheetMetaRef.current.delete(nativeSheet.requestId);
          setNativeSheet(null);
          nativeGuardOpenRef.current = false;
          navigateWebPath("/login/phone");
        }, NATIVE_SHEET_CLOSE_MS);
        return;
      }

      if (meta?.source === "web_login_required" && actionId === "login") {
        emitToWeb(BOTTOM_SHEET_CLOSE_EVENT, {
          requestId: nativeSheet.requestId,
        });
        setIsNativeSheetVisible(false);
        if (nativeSheetCloseTimerRef.current) {
          clearTimeout(nativeSheetCloseTimerRef.current);
        }
        const requestId = nativeSheet.requestId;
        nativeSheetMetaRef.current.delete(requestId);
        setNativeSheet(null);
        nativeGuardOpenRef.current = false;
        openLogin();
        nativeSheetCloseTimerRef.current = setTimeout(() => {
          nativeSheetMetaRef.current.delete(requestId);
          nativeGuardOpenRef.current = false;
        }, NATIVE_SHEET_CLOSE_MS);
        return;
      }

      emitToWeb(BOTTOM_SHEET_ACTION_EVENT, {
        requestId: nativeSheet.requestId,
        actionId,
        payload: payload ?? null,
      });
      if (nativeSheet.sheetKey === "catalog_filter" && actionId === "apply") {
        closeNativeSheet({ shouldNotify: false });
      }
    },
    [
      closeNativeSheet,
      emitToWeb,
      goNativeTab,
      nativeSheet,
      navigateWebPath,
      openLogin,
      queuePendingAuthAction,
      updateNativeProductSheetPayload,
    ],
  );

  const onMessage = useCallback(
    (event) => {
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
        if (nativeSheetCloseTimerRef.current) {
          clearTimeout(nativeSheetCloseTimerRef.current);
          nativeSheetCloseTimerRef.current = null;
        }
        setNativeSheet({
          requestId: String(incoming.requestId),
          sheetKey: String(incoming.sheetKey),
          payload:
            incoming?.payload && typeof incoming.payload === "object"
              ? incoming.payload
              : {},
          options:
            incoming?.options && typeof incoming.options === "object"
              ? incoming.options
              : {},
        });
        nativeSheetMetaRef.current.set(String(incoming.requestId), {
          source:
            incoming.sheetKey === "login_required"
              ? "web_login_required"
              : "web",
        });
        setIsNativeSheetVisible(true);
        return;
      }

      if (message?.type === "CLOSE_BOTTOM_SHEET") {
        const requestId = message?.payload?.requestId;
        if (!requestId || requestId === nativeSheet?.requestId) {
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
          setNativeStories(storiesPayload);
        }
        return;
      }

      if (message?.type === "WEB_FULLSCREEN") {
        const enabled = Boolean(message?.payload?.enabled);
        setIsWebFullscreen(enabled);
        setTabBarForcedHidden(enabled || shouldShowInlineAuthGuard);
        return;
      }

      if (message?.type === "authTokens") {
        const loggedIn = Boolean(message?.tokens);
        setStoredAuthTokens(message?.tokens ?? null);
        setIsLoggedIn(loggedIn);
        setAuthStateCache(loggedIn);
        if (loggedIn) {
          const tokens = parseTokensString(message.tokens);
          flushPendingAuthAction(tokens).catch(() => {});
          setTabBarForcedHidden(false);
          const target = authReturnPathRef.current;
          authReturnPathRef.current = null;
          if (target && ROUTE_GUARD_PATHS.has(target)) {
            navigateWebPath(target);
            setCurrentWebPath(target);
          }
        }
        return;
      }

      if (message?.type === "pendingAuthAction") {
        if (!message?.action) {
          pendingAuthActionRef.current = null;
          setPendingAuthAction(null);
          return;
        }
        try {
          const action = JSON.parse(message.action);
          if (!action?.type || action.productId == null) return;
          pendingAuthActionRef.current = action;
          setPendingAuthAction(action);
        } catch {
          // ignore malformed bridge payloads
        }
        return;
      }

      if (message?.type === "AUTH_LOGIN") {
        const tokens = message?.payload;
        if (tokens && typeof tokens === "object") {
          setTabBarForcedHidden(false);
          setStoredAuthTokens(JSON.stringify(tokens));
          setIsLoggedIn(true);
          setAuthStateCache(true);
          flushPendingAuthAction(tokens).catch(() => {});
          const target = authReturnPathRef.current;
          authReturnPathRef.current = null;
          if (target && ROUTE_GUARD_PATHS.has(target)) {
            navigateWebPath(target);
            setCurrentWebPath(target);
          }
        }
        return;
      }

      if (message?.type === "AUTH_LOGOUT") {
        clearStoredAuthTokens();
        setIsLoggedIn(false);
        setAuthStateCache(false);
        setWalletBalance(0);
        return;
      }

      if (message?.type === "HEADER_DATA") {
        const nextBalance = message?.payload?.walletBalance ?? 0;
        setWalletBalance(toNumber(nextBalance));
        setIsLoggedIn(Boolean(message?.payload?.isLoggedIn));
        return;
      }

      if (message?.type === "CART_COUNT") {
        setCartCount(Math.max(0, toNumber(message?.payload?.count ?? 0)));
        return;
      }

      if (message?.type === "BRANDING_DATA") {
        setBrandTitle(message?.payload?.title || "Comfort Market");
        setBrandLogo(message?.payload?.logoUrl || null);
        setLogoBroken(false);
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
        Haptics.impactAsync(
          map[style] ?? Haptics.ImpactFeedbackStyle.Light,
        ).catch(() => {});
        return;
      }

      if (message?.type === "NAVIGATE_TAB") {
        const tab = message?.payload?.tab;
        if (typeof tab === "string") goNativeTab(tab);
        return;
      }

      if (message?.type === "pathChange") {
        const path = message?.path;
        if (typeof path === "string" && path.startsWith("/")) {
          setCurrentPath(path);
        }
      }
    },
    [
      closeNativeSheet,
      flushPendingAuthAction,
      goNativeTab,
      nativeSheet?.requestId,
      navigateWebPath,
      openNativeProductSheet,
      shouldShowInlineAuthGuard,
    ],
  );

  const androidItemWidth = useMemo(() => {
    const innerWidth = Math.max(0, androidTabBarWidth - 8);
    return innerWidth / ANDROID_TAB_ITEMS.length;
  }, [androidTabBarWidth]);

  const androidActiveBgStyle = useAnimatedStyle(() => ({
    width: androidItemWidth,
    transform: [
      { translateX: 4 + androidActiveTabIndexAnim.value * androidItemWidth },
    ],
    opacity: androidItemWidth > 0 ? 1 : 0,
  }));

  const headerAnimatedStyle = useAnimatedStyle(
    () => ({
      height:
        (isCatalogPath ? HEADER_HEIGHT : HEADER_WRAP_HEIGHT) *
        (1 - fullscreenProgress.value),
      opacity: 1 - fullscreenProgress.value,
      transform: [
        {
          translateY:
            -(isCatalogPath ? HEADER_HEIGHT : HEADER_WRAP_HEIGHT) *
            fullscreenProgress.value,
        },
      ],
    }),
    [isCatalogPath],
  );

  const androidTabWrapAnimatedStyle = useAnimatedStyle(() => ({
    height: ANDROID_TAB_WRAP_HEIGHT * (1 - fullscreenProgress.value),
    opacity: 1 - fullscreenProgress.value,
    transform: [
      { translateY: ANDROID_TAB_WRAP_HEIGHT * fullscreenProgress.value },
    ],
  }));

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={shouldApplyTopInset ? ["top"] : []}
    >
      <StatusBar
        style={
          isWebFullscreen
            ? "light"
            : Platform.OS === "android"
              ? "dark"
              : "auto"
        }
        backgroundColor={isWebFullscreen ? "#000000" : "transparent"}
      />
      <View style={styles.mainContent}>
        {shouldRenderHeader ? (
          <Animated.View
            style={[
              styles.headerAnimatedWrap,
              isCatalogPath ? styles.catalogHeaderAnimatedWrap : null,
              headerAnimatedStyle,
            ]}
          >
            {isCatalogPath ? null : (
              <View pointerEvents="none" style={styles.headerShadowSurface} />
            )}
            <View
              style={[
                styles.header,
                isCatalogPath ? styles.catalogHeader : null,
              ]}
            >
              <Pressable
                onPress={() => goNativeTab("home")}
                style={styles.brandPressable}
              >
                {!logoBroken && brandLogo ? (
                  <Image
                    source={{ uri: brandLogo }}
                    style={styles.brandLogo}
                    resizeMode="contain"
                    onError={() => setLogoBroken(true)}
                  />
                ) : (
                  <Text style={styles.brandText}>
                    {brandTitle || "Comfort Market"}
                  </Text>
                )}
              </Pressable>

              {isLoggedIn ? (
                <View style={styles.walletBadge}>
                  <Text style={styles.walletIcon}>*</Text>
                  <Text style={styles.walletText}>
                    {formattedWalletBalance}
                  </Text>
                </View>
              ) : (
                <Pressable onPress={openLogin} style={styles.loginButton}>
                  <Text style={styles.loginButtonText}>Login</Text>
                </Pressable>
              )}
            </View>
          </Animated.View>
        ) : null}

        <View style={styles.webviewWrap}>
          <WebView
            ref={webViewRef}
            source={{ uri: toWebViewUrl("/") }}
            style={styles.webview}
            containerStyle={styles.webview}
            originWhitelist={["http://*", "https://*", "about:blank"]}
            pullToRefreshEnabled
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            onMessage={onMessage}
            onLoadEnd={() => {
              setIsWebReady(true);
              if (pendingPathRef.current && webViewRef.current) {
                const path = pendingPathRef.current;
                pendingPathRef.current = null;
                webViewRef.current.injectJavaScript(`
                (function () {
                  try {
                    var nextPath = ${JSON.stringify(path)};
                    if (typeof window.__reactRouter_navigate === "function") {
                      window.__reactRouter_navigate(nextPath);
                    } else if (window.location.pathname !== nextPath) {
                      window.__pendingNativePath = nextPath;
                    }
                  } catch (e) {}
                  true;
                })();
              `);
              }
            }}
            onNavigationStateChange={onNavigationStateChange}
            onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
            onError={() => {
              if (Platform.OS === "ios") {
                webViewRef.current?.reload();
              }
            }}
            onHttpError={() => {
              if (Platform.OS === "ios") {
                webViewRef.current?.reload();
              }
            }}
            onContentProcessDidTerminate={() => {
              webViewRef.current?.reload();
            }}
            onRenderProcessGone={() => {
              if (Platform.OS === "android") {
                webViewRef.current?.reload();
              }
            }}
            injectedJavaScriptBeforeContentLoaded={bridgeScript}
            injectedJavaScript={DISABLE_ZOOM_SCRIPT}
            scalesPageToFit={false}
            setSupportMultipleWindows={false}
          />
          {shouldShowInlineAuthGuard ? (
            <View style={styles.inlineGuardOverlay}>
              <View style={styles.inlineGuardCard}>
                <Image
                  source={{ uri: `${BASE_URL}/race.png` }}
                  style={styles.inlineGuardImage}
                  resizeMode="contain"
                />
                <Text style={styles.inlineGuardTitle}>Авторизуйтесь</Text>
                <Text style={styles.inlineGuardText}>
                  {authPromptDescription(routePath || "/")}
                </Text>
                <Pressable style={styles.inlineGuardButton} onPress={openLogin}>
                  <Text style={styles.inlineGuardButtonText}>
                    Авторизоваться
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      </View>

      <NativeBottomSheet
        mounted={Boolean(nativeSheet)}
        visible={isNativeSheetVisible}
        sheet={nativeSheet}
        onClose={() => closeNativeSheet()}
        onAction={handleNativeSheetAction}
      />

      {shouldRenderAndroidTabBar ? (
        <Animated.View
          style={[
            styles.androidTabBarAnimatedWrap,
            androidTabWrapAnimatedStyle,
          ]}
        >
          <View style={styles.androidTabBarWrap}>
            <View
              style={styles.androidTabBar}
              onLayout={(event) => {
                setAndroidTabBarWidth(event.nativeEvent.layout.width);
              }}
            >
              <Animated.View
                style={[styles.androidTabActivePill, androidActiveBgStyle]}
              />
              {ANDROID_TAB_ITEMS.map((tab) => {
                const isActive = isTabActive(currentPath, tab);

                return (
                  <AndroidTabButton
                    key={tab.key}
                    tab={tab}
                    isActive={isActive}
                    cartCount={cartCount}
                    onPress={() => goNativeTab(tab.key)}
                  />
                );
              })}
            </View>
          </View>
        </Animated.View>
      ) : null}

      <NativeStoriesViewer
        items={nativeStories?.items ?? []}
        startIndex={nativeStories?.startIndex ?? 0}
        visible={Boolean(nativeStories)}
        onClose={() => {
          setNativeStories(null);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  mainContent: {
    flex: 1,
    position: "relative",
  },
  webviewWrap: {
    flex: 1,
    backgroundColor: LOADING_BACKGROUND_COLOR,
  },
  webview: {
    backgroundColor: LOADING_BACKGROUND_COLOR,
  },
  headerAnimatedWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: HEADER_WRAP_HEIGHT,
    overflow: "hidden",
    backgroundColor: "transparent",
    zIndex: 30,
    elevation: 30,
  },
  catalogHeaderAnimatedWrap: {
    height: HEADER_HEIGHT,
  },
  inlineGuardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  inlineGuardCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 28,
    // backgroundColor: "#F7F7F8",
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: "center",
  },
  inlineGuardImage: {
    width: 180,
    height: 140,
    marginBottom: 16,
  },
  inlineGuardTitle: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "700",
    color: "#131314",
    textAlign: "center",
  },
  inlineGuardText: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 21,
    color: "#58595E",
    textAlign: "center",
  },
  inlineGuardButton: {
    marginTop: 18,
    borderRadius: 58,
    backgroundColor: "#FE946E",
    paddingHorizontal: 22,
    paddingVertical: 11,
  },
  inlineGuardButtonText: {
    color: "#fff",
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "600",
  },
  header: {
    height: HEADER_CONTENT_HEIGHT,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
  },
  headerShadowSurface: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: HEADER_CONTENT_HEIGHT,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    backgroundColor: "#fff",
    shadowColor: "#00001E",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 9,
    elevation: 5,
  },
  catalogHeader: {
    height: HEADER_HEIGHT,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  brandPressable: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 42,
    justifyContent: "center",
  },
  brandLogo: {
    width: 42,
    height: 42,
  },
  brandText: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "600",
    color: "#131314",
  },
  walletBadge: {
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 96,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: "#FAF56C",
  },
  walletIcon: {
    color: "#131314",
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "700",
  },
  walletText: {
    color: "#131314",
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "600",
  },
  loginButton: {
    borderRadius: 58,
    backgroundColor: "#FE946E",
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  loginButtonText: {
    color: "#fff",
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "600",
  },
  androidTabBarWrap: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 24,
    backgroundColor: "#F8F8F8",
  },
  androidTabBarAnimatedWrap: {
    height: ANDROID_TAB_WRAP_HEIGHT,
    overflow: "hidden",
    backgroundColor: "#F8F8F8",
  },
  androidTabBar: {
    position: "relative",
    height: 66,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.78)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.92)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 50,
    padding: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  androidTabActivePill: {
    position: "absolute",
    top: 4,
    left: 0,
    height: 58,
    borderRadius: 999,
    backgroundColor: "rgba(230,230,235,0.90)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.85)",
  },

  androidTabItem: {
    flex: 1,
    height: "100%",
    zIndex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  androidTabLabel: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "600",
    color: "#757575",
    marginTop: 2,
  },
  androidTabLabelActive: {
    color: "#FE946E",
  },
  androidCartBadge: {
    position: "absolute",
    top: -6,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: "#131314",
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  androidCartBadgeText: {
    color: "#fff",
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "700",
  },
});
