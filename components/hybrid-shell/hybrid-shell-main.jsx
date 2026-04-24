import { useMemo } from "react";
import { Image, Platform, Pressable, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRootNavigationState, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { WebView } from "react-native-webview";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";

import { NativeBottomSheet } from "@/components/native-bottom-sheet";
import { NativeStoriesViewer } from "@/components/native-stories-viewer";

import {
  ANDROID_TAB_ITEMS,
  ANDROID_TAB_WRAP_HEIGHT,
  BASE_URL,
  INITIAL_WEB_URL,
} from "./constants";
import { AndroidTabButton } from "./android-tab-button";
import { DISABLE_ZOOM_SCRIPT } from "./scripts";
import { styles } from "./styles";
import { isTabActive, authPromptDescription } from "./utils";
import { useHybridShellState } from "./use-hybrid-shell-state";
import { useHybridShellNavigation } from "./use-hybrid-shell-navigation";
import { useHybridShellSheets } from "./use-hybrid-shell-sheets";
import { useHybridShellMessageHandler } from "./use-hybrid-shell-message-handler";

export function HybridShell({ routePath = "/" }) {
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const insets = useSafeAreaInsets();
  const core = useHybridShellState();

  const navigation = useHybridShellNavigation({
    routePath,
    router,
    rootNavigationState,
    core,
  });

  const sheets = useHybridShellSheets({
    core,
    navigateWebPath: navigation.navigateWebPath,
    goNativeTab: navigation.goNativeTab,
    openLogin: navigation.openLogin,
    router,
  });

  const { onMessage } = useHybridShellMessageHandler({
    core,
    closeNativeSheet: sheets.closeNativeSheet,
    flushPendingAuthAction: sheets.flushPendingAuthAction,
    goNativeTab: navigation.goNativeTab,
    navigateWebPath: navigation.navigateWebPath,
    openNativeProductSheet: sheets.openNativeProductSheet,
    shouldShowInlineAuthGuard: navigation.shouldShowInlineAuthGuard,
  });

  const androidItemWidth = useMemo(() => {
    const innerWidth = Math.max(0, core.state.androidTabBarWidth - 8);
    return innerWidth / ANDROID_TAB_ITEMS.length;
  }, [core.state.androidTabBarWidth]);
  const isNativeSheetVisible = core.state.isNativeSheetVisible;
  const fullscreenProgress = navigation.fullscreenProgress;
  const androidActiveTabIndexAnim = navigation.androidActiveTabIndexAnim;
  const forceShowHeaderForSheet =
    isNativeSheetVisible && Boolean(core.state.nativeSheet);
  const shouldShowHeaderContent =
    forceShowHeaderForSheet || navigation.shouldRenderHeader;
  const isUserRoute = core.state.currentPath.startsWith("/user");
  const shouldUseHeaderOffset = shouldShowHeaderContent && !isUserRoute;
  const statusBarBackgroundColor = useMemo(() => {
    if (core.state.isWebFullscreen) return "#000000";
    if (isUserRoute) return "#FFFFFF";
    return "transparent";
  }, [core.state.isWebFullscreen, isUserRoute]);

  const androidActiveBgStyle = useAnimatedStyle(() => ({
    width: androidItemWidth,
    transform: [
      { translateX: 4 + androidActiveTabIndexAnim.value * androidItemWidth },
    ],
    opacity: androidItemWidth > 0 ? 1 : 0,
  }));

  const androidTabWrapAnimatedStyle = useAnimatedStyle(() => {
    const progress = isNativeSheetVisible ? 0 : fullscreenProgress.value;
    return {
      height: ANDROID_TAB_WRAP_HEIGHT * (1 - progress),
      opacity: 1 - progress,
      transform: [{ translateY: ANDROID_TAB_WRAP_HEIGHT * progress }],
    };
  }, [isNativeSheetVisible]);

  return (
    <View
      style={[
        styles.safeArea,
        { paddingTop: insets.top, backgroundColor: isUserRoute ? "#FFFFFF" : "#fff" },
      ]}
    >
      <StatusBar
        style={
          core.state.isWebFullscreen
            ? "light"
            : Platform.OS === "android"
              ? "dark"
              : "auto"
        }
        translucent={false}
        backgroundColor={statusBarBackgroundColor}
      />
      <View style={styles.mainContent}>
        <View
          style={[
            styles.headerAnimatedWrap,
            shouldShowHeaderContent ? null : styles.headerHiddenWrap,
          ]}
        >
          {shouldShowHeaderContent ? (
            <View style={styles.header}>
              <Pressable
                onPress={() => navigation.goNativeTab("home")}
                style={styles.brandPressable}
              >
                {!core.state.logoBroken && core.state.brandLogo ? (
                  <Image
                    source={{ uri: core.state.brandLogo }}
                    style={styles.brandLogo}
                    resizeMode="contain"
                    onError={() => core.setters.setLogoBroken(true)}
                  />
                ) : (
                  <Text style={styles.brandText}>
                    {core.state.brandTitle || "Comfort Market"}
                  </Text>
                )}
              </Pressable>

              {core.state.isLoggedIn ? (
                <Pressable onPress={sheets.openNativeWalletSheet}>
                  <LinearGradient
                    colors={["#FAF56C", "#7EFDEC"]}
                    start={{ x: 0, y: 0.434 }}
                    end={{ x: 1, y: 0.566 }}
                    style={styles.walletBadge}
                  >
                    <Svg
                      style={styles.cashbackIcon}
                      width={16}
                      height={16}
                      viewBox="0 0 16 16"
                      fill="none"
                    >
                      <Path
                        d="M8 0C12.4183 0 16 3.58172 16 8C16 12.4183 12.4183 16 8 16C3.58172 16 0 12.4183 0 8C0 3.58172 3.58172 0 8 0ZM11.6787 5.31641C11.9696 4.68384 11.3162 4.03042 10.6836 4.32129L8.31348 5.41113C8.1146 5.50258 7.8854 5.50258 7.68652 5.41113L5.31641 4.32129C4.68384 4.03042 4.03042 4.68384 4.32129 5.31641L5.41113 7.68652C5.50258 7.8854 5.50258 8.1146 5.41113 8.31348L4.32129 10.6836C4.03042 11.3162 4.68384 11.9696 5.31641 11.6787L7.68652 10.5889C7.8854 10.4974 8.1146 10.4974 8.31348 10.5889L10.6836 11.6787C11.3162 11.9696 11.9696 11.3162 11.6787 10.6836L10.5889 8.31348C10.4974 8.1146 10.4974 7.8854 10.5889 7.68652L11.6787 5.31641Z"
                        fill="#0B0B0B"
                      />
                    </Svg>
                    <Text style={styles.walletText}>
                      {navigation.formattedWalletBalance}
                    </Text>
                  </LinearGradient>
                </Pressable>
              ) : (
                <Pressable
                  onPress={navigation.openLogin}
                  style={styles.loginButton}
                >
                  <Text style={styles.loginButtonText}>Login</Text>
                </Pressable>
              )}
            </View>
          ) : null}
        </View>

        <View
          style={[
            styles.webviewWrap,
            !shouldUseHeaderOffset
              ? styles.webviewWrapNoHeaderOffset
              : null,
            isUserRoute ? styles.userWebviewWrap : null,
          ]}
        >
          <WebView
            ref={core.refs.webViewRef}
            source={{ uri: INITIAL_WEB_URL }}
            style={[styles.webview, isUserRoute ? styles.userWebview : null]}
            containerStyle={[
              styles.webview,
              isUserRoute ? styles.userWebview : null,
            ]}
            originWhitelist={["http://*", "https://*", "about:blank"]}
            pullToRefreshEnabled
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            onMessage={onMessage}
            onLoadEnd={navigation.onWebLoadEnd}
            onNavigationStateChange={navigation.onNavigationStateChange}
            onShouldStartLoadWithRequest={
              navigation.onShouldStartLoadWithRequest
            }
            onError={() => {
              if (Platform.OS === "ios") core.refs.webViewRef.current?.reload();
            }}
            onHttpError={() => {
              if (Platform.OS === "ios") core.refs.webViewRef.current?.reload();
            }}
            onContentProcessDidTerminate={() => {
              core.refs.webViewRef.current?.reload();
            }}
            onRenderProcessGone={() => {
              if (Platform.OS === "android")
                core.refs.webViewRef.current?.reload();
            }}
            injectedJavaScriptBeforeContentLoaded={core.state.bridgeScript}
            injectedJavaScript={DISABLE_ZOOM_SCRIPT}
            scalesPageToFit={false}
            setSupportMultipleWindows={false}
          />

          {navigation.shouldShowInlineAuthGuard ? (
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
                <Pressable
                  style={styles.inlineGuardButton}
                  onPress={navigation.openLogin}
                >
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
        mounted={Boolean(core.state.nativeSheet)}
        visible={core.state.isNativeSheetVisible}
        sheet={core.state.nativeSheet}
        onClose={() => sheets.closeNativeSheet()}
        onAction={sheets.handleNativeSheetAction}
      />

      {navigation.shouldRenderAndroidTabBar ? (
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
                core.setters.setAndroidTabBarWidth(
                  event.nativeEvent.layout.width,
                );
              }}
            >
              <Animated.View
                style={[styles.androidTabActivePill, androidActiveBgStyle]}
              />
              {ANDROID_TAB_ITEMS.map((tab) => {
                const isActive = isTabActive(core.state.currentPath, tab);
                return (
                  <AndroidTabButton
                    key={tab.key}
                    tab={tab}
                    isActive={isActive}
                    cartCount={core.state.cartCount}
                    onPress={() => navigation.goNativeTab(tab.key)}
                  />
                );
              })}
            </View>
          </View>
        </Animated.View>
      ) : null}

      <NativeStoriesViewer
        items={core.state.nativeStories?.items ?? []}
        startIndex={core.state.nativeStories?.startIndex ?? 0}
        visible={Boolean(core.state.nativeStories)}
        onClose={() => {
          core.setters.setNativeStories(null);
        }}
      />
    </View>
  );
}
