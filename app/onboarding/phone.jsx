import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  View,
} from "react-native";
import { WebView } from "react-native-webview";

import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { openBrowserAsync } from "expo-web-browser";
import { SafeAreaView } from "react-native-safe-area-context";
import { setStoredAuthTokens } from "@/lib/auth-storage";
import { setAuthStateCache } from "@/lib/auth-guard-bridge";
import {
  isWebViewInternalUrl,
  toWebViewUrl,
  WEBVIEW_BASE_URL,
} from "@/lib/runtime-config";

const WEBVIEW_URL = WEBVIEW_BASE_URL;
const LOGIN_WEBVIEW_URL = toWebViewUrl("/login/phone");

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

// Auth token bridge: web → native (kelajakda kerak bo'lsa ishlatish uchun)
const WEBVIEW_BRIDGE_SCRIPT = `
(function () {
  function postTokens() {
    try {
      var tokens = window.localStorage.getItem('authTokens');
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'authTokens',
        tokens: tokens || null,
      }));
    } catch (e) {}
  }

  try {
    var originalSetItem = window.localStorage.setItem;
    window.localStorage.setItem = function (key, value) {
      originalSetItem.apply(this, arguments);
      if (key === 'authTokens') postTokens();
    };

    var originalRemoveItem = window.localStorage.removeItem;
    window.localStorage.removeItem = function (key) {
      originalRemoveItem.apply(this, arguments);
      if (key === 'authTokens') postTokens();
    };
  } catch (e) {}

  postTokens();
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

function toNativeTabsPath(pathname) {
  if (pathname === "/catalog") return "/(tabs)/catalog";
  if (pathname === "/cart") return "/(tabs)/cart";
  if (pathname === "/favorites") return "/(tabs)/favorites";
  if (pathname === "/profile") return "/(tabs)/profile";
  return "/(tabs)";
}

export default function OnboardingPhoneScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const navigation = useNavigation();
  const webViewRef = useRef(null);
  const redirectedRef = useRef(false);
  const nextPath = useMemo(() => normalizeNextPath(params?.next), [params?.next]);
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

  const onNavigationStateChange = useCallback((nextNavState) => {
    setNavState({ canGoBack: nextNavState.canGoBack, url: nextNavState.url });
  }, []);

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

  const onShouldStartLoadWithRequest = useCallback(
    (request) => {
      const nextUrl = request?.url;
      if (!nextUrl) return true;

      if (isWebViewInternalUrl(nextUrl)) {
        return true;
      }

      openBrowserAsync(nextUrl).catch(() => {});
      return false;
    },
    [],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <WebView
        ref={webViewRef}
        source={{ uri: LOGIN_WEBVIEW_URL }}
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

          if (message?.type !== "authTokens") return;
          if (!message?.tokens) return;

          redirectedRef.current = true;
          setStoredAuthTokens(message.tokens);
          setAuthStateCache(true);
          router.replace(toNativeTabsPath(nextPath));
        }}
        injectedJavaScriptBeforeContentLoaded={WEBVIEW_BRIDGE_SCRIPT}
        injectedJavaScript={DISABLE_ZOOM_SCRIPT}
        scalesPageToFit={false}
        setSupportMultipleWindows={false}
        startInLoadingState
        renderLoading={() => (
          <View
            style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
          >
            <ActivityIndicator />
          </View>
        )}
      />
    </SafeAreaView>
  );
}
