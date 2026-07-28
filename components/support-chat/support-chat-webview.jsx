import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import { WebView } from "react-native-webview";
import { openBrowserAsync } from "expo-web-browser";
import { useTranslation } from "react-i18next";

import {
  DISABLE_ZOOM_SCRIPT,
  buildBridgeScript,
} from "@/components/hybrid-shell/scripts";
import { getStoredAuthTokens } from "@/lib/auth-storage";
import { getStoredLanguageCode } from "@/lib/app-preferences";
import { toWebViewUrl, WEBVIEW_BASE_URL } from "@/lib/runtime-config";

const LOADING_BACKGROUND_COLOR = "#F8F8F8";
const SUPPORT_STOREFRONT_FALLBACK_DOMAIN = "mirjeck.cmfrt.uz";

function normalizeStorefrontBaseUrl(rawValue) {
  const input = String(rawValue || "").trim();
  if (!input) return "";

  try {
    const parsed = input.includes("://")
      ? new URL(input)
      : new URL(`https://${input}`);
    parsed.pathname = "/";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function buildSupportUrl(path) {
  try {
    const internalUrl = toWebViewUrl(path);
    if (internalUrl && internalUrl !== WEBVIEW_BASE_URL) {
      return internalUrl;
    }
  } catch {
    // fall through to storefront domain fallback
  }

  const domain =
    process.env.EXPO_PUBLIC_STOREFRONT_DOMAIN ||
    process.env.EXPO_PUBLIC_TENANT_DOMAIN ||
    SUPPORT_STOREFRONT_FALLBACK_DOMAIN;
  const baseUrl = normalizeStorefrontBaseUrl(domain);
  if (!baseUrl) return "";

  try {
    return new URL(path.startsWith("/") ? path : `/${path}`, baseUrl).toString();
  } catch {
    return baseUrl;
  }
}

export function shouldUseSupportWebFallback(errorMessage) {
  const text = String(errorMessage || "").toLowerCase();
  return text.includes("tenant context") || text.includes("tanant context");
}

export function SupportChatWebView({ path = "/chat" }) {
  const { i18n } = useTranslation();
  const webViewRef = useRef(null);
  const [bridgeScript, setBridgeScript] = useState(() =>
    buildBridgeScript(null, Platform.OS, i18n.language),
  );

  const targetUrl = useMemo(() => buildSupportUrl(path), [path]);

  useEffect(() => {
    let mounted = true;
    Promise.all([getStoredAuthTokens(), getStoredLanguageCode()]).then(
      ([tokensString, languageCode]) => {
        if (!mounted) return;
        setBridgeScript(
          buildBridgeScript(tokensString, Platform.OS, languageCode),
        );
      },
    );

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    Promise.all([getStoredAuthTokens(), getStoredLanguageCode()])
      .then(([tokensString, languageCode]) => {
        if (!mounted) return;

        setBridgeScript(
          buildBridgeScript(tokensString, Platform.OS, languageCode),
        );

        webViewRef.current?.injectJavaScript(`
          (function () {
            try {
              if (typeof window.__handleNativeMessage === "function") {
                window.__handleNativeMessage(${JSON.stringify(
                  JSON.stringify({
                    type: "LANGUAGE_CHANGE",
                    payload: { language: i18n.language },
                  }),
                )});
              }
            } catch (e) {}
            true;
          })();
        `);
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [i18n.language]);

  if (!targetUrl) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#FFFFFF",
          paddingHorizontal: 24,
        }}
      >
        <View>
          <ActivityIndicator />
        </View>
      </View>
    );
  }

  return (
    <WebView
      ref={webViewRef}
      source={{ uri: targetUrl }}
      style={{ flex: 1, backgroundColor: LOADING_BACKGROUND_COLOR }}
      containerStyle={{ backgroundColor: LOADING_BACKGROUND_COLOR }}
      originWhitelist={["http://*", "https://*", "about:blank"]}
      injectedJavaScriptBeforeContentLoaded={bridgeScript}
      injectedJavaScript={DISABLE_ZOOM_SCRIPT}
      onShouldStartLoadWithRequest={(request) => {
        const nextUrl = request?.url;
        if (!nextUrl) return true;
        try {
          return new URL(nextUrl).origin === new URL(targetUrl).origin;
        } catch {
          openBrowserAsync(nextUrl).catch(() => {});
          return false;
        }
      }}
      onLoadEnd={() => {
        Promise.all([getStoredAuthTokens(), getStoredLanguageCode()])
          .then(([tokensString, languageCode]) => {
            const tokens = tokensString ? JSON.parse(tokensString) : null;
            webViewRef.current?.injectJavaScript(`
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
                        payload: { language: languageCode },
                      }),
                    )});
                  }
                } catch (e) {}
                true;
              })();
            `);
          })
          .catch(() => {});
      }}
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
