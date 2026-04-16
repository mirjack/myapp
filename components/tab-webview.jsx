import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Platform, View } from "react-native";
import { WebView } from "react-native-webview";
import { useFocusEffect } from "@react-navigation/native";
import { openBrowserAsync } from "expo-web-browser";

const LOADING_BACKGROUND_COLOR = "#F8F8F8";

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

  var style = document.createElement('style');
  style.textContent = '* { -webkit-user-select: none !important; user-select: none !important; }';
  document.head.appendChild(style);
})();
true;
`;

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

export function TabWebView({ url }) {
  const webViewRef = useRef(null);
  const [navState, setNavState] = useState({ canGoBack: false, url });

  const normalizedInitialUrl = useMemo(() => normalizeUrl(url), [url]);
  const normalizedCurrentUrl = useMemo(
    () => normalizeUrl(navState.url),
    [navState.url],
  );
  const canGoBackInWebView =
    navState.canGoBack && normalizedCurrentUrl !== normalizedInitialUrl;

  const handleBackPress = useCallback(() => {
    if (canGoBackInWebView) {
      webViewRef.current?.goBack();
      return true;
    }
    if (Platform.OS === "android") {
      BackHandler.exitApp();
      return true;
    }
    return true;
  }, [canGoBackInWebView]);

  const onNavigationStateChange = useCallback((nextNavState) => {
    setNavState({ canGoBack: nextNavState.canGoBack, url: nextNavState.url });
  }, []);

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

  const webOrigin = useMemo(() => {
    try {
      return new URL(url).origin;
    } catch {
      return null;
    }
  }, [url]);

  const onShouldStartLoadWithRequest = useCallback(
    (request) => {
      const nextUrl = request?.url;
      if (!nextUrl) return true;
      if (webOrigin && nextUrl.startsWith(webOrigin)) return true;
      openBrowserAsync(nextUrl).catch(() => {});
      return false;
    },
    [webOrigin],
  );

  return (
    <WebView
      ref={webViewRef}
      source={{ uri: url }}
      style={{ backgroundColor: LOADING_BACKGROUND_COLOR }}
      containerStyle={{ backgroundColor: LOADING_BACKGROUND_COLOR }}
      originWhitelist={["http://*", "https://*", "about:blank"]}
      onNavigationStateChange={onNavigationStateChange}
      onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
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
  );
}
