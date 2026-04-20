import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Platform, View } from "react-native";
import { WebView } from "react-native-webview";

import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { openBrowserAsync } from "expo-web-browser";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getPendingAuthAction,
  setPendingAuthAction,
  setStoredAuthTokens,
} from "@/lib/auth-storage";
import { setAuthStateCache } from "@/lib/auth-guard-bridge";
import {
  addFavorite,
  adjustCartItemByProduct,
} from "@/lib/native-market-api";
import {
  isWebViewInternalUrl,
  toWebViewUrl,
  WEBVIEW_BASE_URL,
} from "@/lib/runtime-config";

const WEBVIEW_URL = WEBVIEW_BASE_URL;
const LOGIN_WEBVIEW_URL = toWebViewUrl("/login/phone");
const LOADING_BACKGROUND_COLOR = "#F8F8F8";

// Zoom o'chirish uchun viewport meta tag
const DISABLE_ZOOM_SCRIPT = `
(function() {
  var meta = document.querySelector('meta[name="viewport"]');
  if (meta) {
    meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
  } else {
    var newMeta = document.createElement('meta');
    newMeta.name = 'viewport';
    newMeta.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';
    document.head.appendChild(newMeta);
  }
})();
true;
`;

const WEBVIEW_BRIDGE_SCRIPT = `
(function () {
  try {
    window.__NATIVE_APP__ = true;
    window.__NATIVE_PLATFORM__ = "${Platform.OS}";
    document.documentElement.dataset.nativeApp = 'true';
    document.documentElement.dataset.nativePlatform = "${Platform.OS}";
    try { window.localStorage.removeItem('authTokens'); } catch (e) {}
  } catch (e) {}
})();
true;
`;

function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    const path = parsed.pathname.replace(/\/+$/, "");
    parsed.pathname = path === "" ? "/" : path;
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return String(url ?? "").replace(/\/+$/, "");
  }
}

function normalizeNextPath(next) {
  const raw = Array.isArray(next) ? next[0] : next;
  if (typeof raw !== "string" || !raw.startsWith("/")) return "/";
  if (raw.startsWith("/cart")) return "/cart";
  if (raw.startsWith("/favorites")) return "/favorites";
  if (raw.startsWith("/profile")) return "/profile";
  if (raw.startsWith("/catalog")) return "/catalog";
  return "/";
}

function getPathnameFromUrl(url) {
  try {
    return new URL(String(url || "")).pathname || "/";
  } catch {
    return "/";
  }
}

function normalizeWebPath(pathname) {
  const raw = String(pathname || "/");
  if (raw === "/home") return "/";
  if (raw.startsWith("/catalog")) return "/catalog";
  if (raw.startsWith("/cart")) return "/cart";
  if (raw.startsWith("/favorites")) return "/favorites";
  if (raw.startsWith("/profile")) return "/profile";
  return "/";
}

function isLoginFlowPath(pathname) {
  const path = String(pathname || "/");
  return (
    path.startsWith("/login") ||
    path.startsWith("/register") ||
    path.startsWith("/onboarding")
  );
}

function toNativeTabsPath(pathname) {
  if (pathname === "/catalog") return "/(tabs)/catalog";
  if (pathname === "/cart") return "/(tabs)/cart";
  if (pathname === "/favorites") return "/(tabs)/favorites";
  if (pathname === "/profile") return "/(tabs)/profile";
  return "/(tabs)";
}

function parseTokensString(tokensString) {
  if (!tokensString) return null;
  try {
    return JSON.parse(tokensString);
  } catch {
    return null;
  }
}

async function flushPendingAuthAction(tokensString) {
  const tokens = parseTokensString(tokensString);
  if (!tokens?.access) return;
  const action = await getPendingAuthAction();
  if (!action?.type || action.productId == null) return;
  await setPendingAuthAction(null);

  try {
    if (action.type === "cart") {
      await adjustCartItemByProduct(
        tokens.access,
        action.productId,
        Number(action.delta) || 1,
      );
      return;
    }

    if (action.type === "favorite") {
      await addFavorite(tokens.access, action.productId);
    }
  } catch {
    // Login should still finish even if the queued product action fails.
  }
}

export default function OnboardingPhoneScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const navigation = useNavigation();
  const webViewRef = useRef(null);
  const redirectedRef = useRef(false);
  const nextPath = useMemo(
    () => normalizeNextPath(params?.next),
    [params?.next],
  );
  const [navState, setNavState] = useState({
    canGoBack: false,
    url: LOGIN_WEBVIEW_URL,
  });

  const normalizedHomeUrl = useMemo(() => normalizeUrl(WEBVIEW_URL), []);
  const normalizedCurrentUrl = useMemo(
    () => normalizeUrl(navState.url),
    [navState.url],
  );
  const canGoBackInWebView =
    navState.canGoBack && normalizedCurrentUrl !== normalizedHomeUrl;

  const handleBackPress = useCallback(() => {
    if (canGoBackInWebView) {
      webViewRef.current?.goBack();
      return true;
    }

    if (Platform.OS === "android") {
      BackHandler.exitApp();
      return true;
    }

    if (typeof router.canGoBack === "function" && router.canGoBack()) {
      router.back();
      return true;
    }

    return true;
  }, [canGoBackInWebView, router]);

  const onNavigationStateChange = useCallback(
    (nextNavState) => {
      setNavState({ canGoBack: nextNavState.canGoBack, url: nextNavState.url });
      if (redirectedRef.current) return;

      const currentWebPath = getPathnameFromUrl(nextNavState?.url);
      if (isLoginFlowPath(currentWebPath)) return;

      redirectedRef.current = true;
      router.replace(toNativeTabsPath(normalizeWebPath(currentWebPath)));
    },
    [router],
  );

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

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

  const onShouldStartLoadWithRequest = useCallback((request) => {
    const nextUrl = request?.url;
    if (!nextUrl) return true;

    if (isWebViewInternalUrl(nextUrl)) {
      return true;
    }

    openBrowserAsync(nextUrl).catch(() => {});
    return false;
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <WebView
        ref={webViewRef}
        source={{ uri: LOGIN_WEBVIEW_URL }}
        style={{ backgroundColor: LOADING_BACKGROUND_COLOR }}
        containerStyle={{ backgroundColor: LOADING_BACKGROUND_COLOR }}
        onNavigationStateChange={onNavigationStateChange}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        onMessage={(event) => {
          const raw = event?.nativeEvent?.data;
          if (!raw || redirectedRef.current) return;

          let message;
          try {
            message = JSON.parse(raw);
          } catch {
            return;
          }

          if (message?.type !== "AUTH_LOGIN") return;
          const tokens = message?.payload;
          if (!tokens?.access) return;

          redirectedRef.current = true;
          (async () => {
            const tokensString = JSON.stringify(tokens);
            await setStoredAuthTokens(tokensString);
            flushPendingAuthAction(tokensString).catch(() => {});
            setAuthStateCache(true);
            router.replace(toNativeTabsPath(nextPath));
          })().catch(() => {
            redirectedRef.current = false;
          });
        }}
        injectedJavaScriptBeforeContentLoaded={WEBVIEW_BRIDGE_SCRIPT}
        injectedJavaScript={DISABLE_ZOOM_SCRIPT}
        scalesPageToFit={false}
        setSupportMultipleWindows={false}
        startInLoadingState
        renderLoading={() => (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: LOADING_BACKGROUND_COLOR,
            }}
          >
            <ActivityIndicator />
          </View>
        )}
      />
    </SafeAreaView>
  );
}

