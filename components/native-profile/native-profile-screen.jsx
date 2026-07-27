import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated from "react-native-reanimated";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";

import { NativeBottomSheet } from "@/components/native-bottom-sheet";
import {
  clearStoredAuthTokens,
  getStoredAuthTokens,
  getStoredAuthTokensSync,
} from "@/lib/auth-storage";
import {
  clearCachedNativeProfile,
  isNativeProfileCacheFresh,
  readCachedNativeProfile,
  readCachedNativeProfileSync,
} from "@/lib/native-profile-cache";
import { setCurrentWebPath } from "@/lib/tab-bar-visibility";
import { getHeaderCache, updateHeaderCache } from "@/components/hybrid-shell/header-cache";
import { setAuthStateCache } from "@/lib/auth-guard-bridge";
import { AndroidTabBar } from "@/components/hybrid-shell/android-tab-bar";
import { applyAppLanguage } from "@/lib/i18n";
import { fetchCurrentUserProfile } from "@/lib/native-account-api";
import { getStoredLanguageCode } from "@/lib/app-preferences";

import { nativeProfileStyles as styles } from "./native-profile.styles";

function parseTokensString(tokensString) {
  if (!tokensString) return null;
  try {
    return JSON.parse(tokensString);
  } catch {
    return null;
  }
}

function formatFullName(user) {
  const parts = [user?.firstName, user?.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "Comfort Client";
}

function extractInitials(user) {
  const value = `${user?.firstName?.[0] || ""}${user?.lastName?.[0] || ""}`
    .trim()
    .toUpperCase();
  return value || "CC";
}

function WalletBadge({ amount }) {
  return (
    <LinearGradient
      colors={["#FAF56C", "#7EFDEC"]}
      start={{ x: 0, y: 0.434 }}
      end={{ x: 1, y: 0.566 }}
      style={[styles.walletBadge, styles.profileWalletBadge]}
    >
      <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
        <Path
          d="M8 0C12.4183 0 16 3.58172 16 8C16 12.4183 12.4183 16 8 16C3.58172 16 0 12.4183 0 8C0 3.58172 3.58172 0 8 0ZM11.6787 5.31641C11.9696 4.68384 11.3162 4.03042 10.6836 4.32129L8.31348 5.41113C8.1146 5.50258 7.8854 5.50258 7.68652 5.41113L5.31641 4.32129C4.68384 4.03042 4.03042 4.68384 4.32129 5.31641L5.41113 7.68652C5.50258 7.8854 5.50258 8.1146 5.41113 8.31348L4.32129 10.6836C4.03042 11.3162 4.68384 11.9696 5.31641 11.6787L7.68652 10.5889C7.8854 10.4974 8.1146 10.4974 8.31348 10.5889L10.6836 11.6787C11.3162 11.9696 11.9696 11.3162 11.6787 10.6836L10.5889 8.31348C10.4974 8.1146 10.4974 7.8854 10.5889 7.68652L11.6787 5.31641Z"
          fill="#0B0B0B"
        />
      </Svg>
      <Text style={[styles.walletText, styles.profileWalletText]}>{amount}</Text>
    </LinearGradient>
  );
}

export function NativeProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const logoutRedirectTimerRef = useRef(null);
  const initialTokens = parseTokensString(getStoredAuthTokensSync());
  const initialCachedProfileEntry = readCachedNativeProfileSync(initialTokens?.access || null);
  const initialCachedProfile = initialCachedProfileEntry?.profile || null;
  const [user, setUser] = useState(initialCachedProfile);
  const [error, setError] = useState("");
  const [languageCode, setLanguageCode] = useState("ru");
  const [isLoggedIn, setIsLoggedIn] = useState(Boolean(initialTokens?.access));
  const [sheet, setSheet] = useState(null);
  const [isSheetVisible, setIsSheetVisible] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [activeTabKey, setActiveTabKey] = useState("profile");
  const [scrollViewportHeight, setScrollViewportHeight] = useState(0);
  const [scrollContentHeight, setScrollContentHeight] = useState(0);
  const headerCache = getHeaderCache();
  const walletAmount = useMemo(
    () =>
      new Intl.NumberFormat("en-US", { useGrouping: true })
        .format(Math.trunc(Number(headerCache.walletBalance || 0)))
        .replace(/,/g, " "),
    [headerCache.walletBalance],
  );
  const languageOptions = useMemo(
    () => [
      { code: "ru", label: t("languageNames.ru") },
      { code: "uz", label: t("languageNames.uz") },
      { code: "en", label: t("languageNames.en") },
    ],
    [t],
  );
  const menuItems = useMemo(
    () => [
      { key: "details", label: t("profile.details"), icon: "settings-outline", route: "/account/me" },
      { key: "orders", label: t("profile.orders"), icon: "bag-outline", route: "/account/orders" },
      { key: "addresses", label: t("profile.addresses"), icon: "location-outline", route: "/account/addresses" },
      { key: "support", label: t("profile.support"), icon: "chatbubble-ellipses-outline", route: "/chat" },
      { key: "language", label: t("profile.language"), icon: "language-outline", action: "language", hasValue: true },
      { key: "contact", label: t("profile.contact"), icon: "mail-outline", action: "contact" },
      { key: "logout", label: t("profile.logout"), icon: "log-out-outline", action: "logout", danger: true },
    ],
    [t],
  );
  const formatLanguageLabel = useMemo(
    () => (code) => languageOptions.find((item) => item.code === code)?.label || t("languageNames.ru"),
    [languageOptions, t],
  );
  const isProfileScrollEnabled =
    Platform.OS === "android" || scrollContentHeight > scrollViewportHeight + 4;

  useEffect(() => {
    let isMounted = true;
    setCurrentWebPath("/profile");
    setActiveTabKey("profile");

    getStoredAuthTokens()
      .then(async (tokensString) => {
        if (!isMounted) return;
        const tokens = parseTokensString(tokensString);
        const hasAccessToken = Boolean(tokens?.access);
        setIsLoggedIn(hasAccessToken);

        if (!hasAccessToken) {
          return;
        }

        const cached = await readCachedNativeProfile(tokens.access);
        if (!isMounted) return;
        if (cached?.profile) {
          setUser(cached.profile);
          if (isNativeProfileCacheFresh(cached)) {
            setError("");
            return;
          }
        }

        fetchCurrentUserProfile()
          .then((data) => {
            if (!isMounted) return;
            setUser(data);
            setError("");
          })
          .catch((loadError) => {
            if (!isMounted) return;
            if (loadError?.status === 401) {
              setIsLoggedIn(false);
              setError("");
            } else {
              setError("Failed to load profile.");
            }
          });
      })
      .catch(() => {
        if (!isMounted) return;
        setIsLoggedIn(false);
      });

    getStoredLanguageCode().then((code) => {
      if (isMounted) setLanguageCode(code || "ru");
    });

    return () => {
      isMounted = false;
      if (logoutRedirectTimerRef.current) {
        clearTimeout(logoutRedirectTimerRef.current);
      }
    };
  }, []);

  const goToTab = (tabKey) => {
    const targetMap = {
      home: "/(tabs)",
      catalog: "/(tabs)/catalog",
      cart: "/(tabs)/cart",
      favorites: "/(tabs)/favorites",
      profile: "/(tabs)/profile",
    };
    const nextRoute = targetMap[tabKey];
    const nextWebPath = tabKey === "home" ? "/" : `/${tabKey}`;

    if (tabKey === "profile") {
      setActiveTabKey("profile");
      setCurrentWebPath("/profile");
      return;
    }

    setCurrentWebPath(nextWebPath);
    if (nextRoute) {
      router.replace(nextRoute);
    }
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);

    try {
      const tokensString = await getStoredAuthTokens();
      const tokens = parseTokensString(tokensString);
      await clearCachedNativeProfile(tokens?.access || null);
      await clearStoredAuthTokens();
      setAuthStateCache(false);
      updateHeaderCache({ walletBalance: 0, cartCount: 0 });
      setUser(null);
      setError("");
      setIsLoggedIn(false);
      setActiveTabKey("home");
      setCurrentWebPath("/");
      closeSheet();

      let attempts = 0;
      const tryGoHome = () => {
        attempts += 1;
        setCurrentWebPath("/");
        setActiveTabKey("home");

        try {
          router.replace("/(tabs)");
        } catch {
          if (attempts < 12) {
            logoutRedirectTimerRef.current = setTimeout(tryGoHome, 80);
          }
          return;
        }

        if (attempts < 4) {
          logoutRedirectTimerRef.current = setTimeout(tryGoHome, 80);
        }
      };

      requestAnimationFrame(tryGoHome);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleMenuPress = async (item) => {
    if (item.route) {
      router.push(item.route);
      return;
    }

    if (item.action === "language") {
      setSheet({
        requestId: `profile-language-${Date.now()}`,
        sheetKey: "language_select",
        payload: {
          title: t("profile.chooseLanguage"),
          description: t("profile.chooseLanguageDescription"),
          selectedLang: languageCode,
          options: languageOptions,
        },
        options: {},
      });
      setIsSheetVisible(true);
      return;
    }

    if (item.action === "contact") {
      setSheet({
        requestId: `profile-contact-${Date.now()}`,
        sheetKey: "contact_info",
        payload: {
          title: t("profile.contactTitle"),
          description: t("profile.contactDescription"),
          phoneLabel: "Phone",
          phoneNumber: "+998 55 500 05 05",
          workHours: "Mon-Sun, 09:00 - 21:00",
        },
        options: {},
      });
      setIsSheetVisible(true);
      return;
    }

    if (item.action === "logout") {
      setSheet({
        requestId: `profile-logout-${Date.now()}`,
        sheetKey: "logout_confirm",
        payload: {
          title: t("profile.logoutConfirmTitle"),
          description: t("profile.logoutConfirmDescription"),
          primaryLabel: t("profile.logoutConfirmPrimary"),
          secondaryLabel: t("profile.logoutConfirmSecondary"),
          loadingLabel: t("profile.logoutConfirmLoading"),
          isLoading: false,
        },
        options: {},
      });
      setIsSheetVisible(true);
      return;
    }
  };

  const handleLanguageSelect = async (code) => {
    const nextLanguageCode = await applyAppLanguage(code);
    setLanguageCode(nextLanguageCode);
    setIsSheetVisible(false);
  };

  const closeSheet = () => {
    setIsSheetVisible(false);
    setTimeout(() => {
      setSheet(null);
    }, 280);
  };

  const handleSheetAction = async (actionId, payload) => {
    if (actionId === "select_language" && payload?.code) {
      await handleLanguageSelect(String(payload.code));
      return;
    }

    if (actionId === "cancel_logout") {
      closeSheet();
      return;
    }

    if (actionId === "confirm_logout") {
      setSheet((current) =>
        current?.sheetKey === "logout_confirm"
          ? {
              ...current,
              payload: {
                ...(current.payload || {}),
                isLoading: true,
              },
            }
          : current,
      );
      await handleLogout();
    }
  };

  const openLogin = () => {
    router.push({ pathname: "/onboarding/phone", params: { next: "/profile" } });
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <StatusBar style="dark" translucent={false} backgroundColor="#FFFFFF" />
      <View style={[styles.hybridHeaderWrap, styles.hybridHeaderWrapCompact]}>
        <View style={[styles.hybridHeader, styles.hybridHeaderCompact]}>
          <View style={styles.headerTopRow}>
            <Pressable onPress={() => goToTab("home")} style={styles.brandPressable}>
              <View style={styles.brandCopy}>
                <Text style={styles.brandText}>MIO BEAUTY</Text>
              </View>
            </Pressable>
            {isLoggedIn ? (
              <WalletBadge amount={walletAmount} />
            ) : (
              <Pressable onPress={openLogin} style={styles.loginTopButton}>
                <Text style={styles.loginTopButtonText}>{t("common.login")}</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>

      {!isLoggedIn ? (
        <View style={styles.loginPrompt}>
          <Text style={styles.loginTitle}>{t("profile.authorizeTitle")}</Text>
          <Text style={styles.loginText}>{t("profile.authorizeDescription")}</Text>
          <Pressable onPress={openLogin} style={styles.loginButton}>
            <Text style={styles.loginButtonText}>{t("common.login")}</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          scrollEnabled={isProfileScrollEnabled}
          bounces={false}
          alwaysBounceVertical={false}
          overScrollMode="never"
          onLayout={(event) => {
            setScrollViewportHeight(event.nativeEvent.layout.height);
          }}
          onContentSizeChange={(_, height) => {
            setScrollContentHeight(height);
          }}
          contentContainerStyle={[
            styles.content,
            Platform.OS === "android" ? styles.contentWithAndroidTabBar : null,
          ]}
        >
          <Pressable onPress={() => router.push("/account/me")} style={styles.heroCard}>
            <View style={styles.heroRow}>
              <View style={styles.heroAvatar}>
                <Text style={styles.heroAvatarText}>{extractInitials(user)}</Text>
              </View>
              <View style={styles.heroBody}>
                <View style={styles.heroNameRow}>
                  <Text numberOfLines={1} style={styles.heroName}>
                    {formatFullName(user)}
                  </Text>
                  <View style={styles.heroActionRow}>
                    <Text style={styles.heroActionText}>{t("profile.configure")}</Text>
                    <Ionicons color="#747479" name="chevron-forward" size={16} />
                  </View>
                </View>
                <Text style={styles.heroPhone}>{user?.phoneNumber || ""}</Text>
              </View>
            </View>
          </Pressable>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.menuWrap}>
            {menuItems.map((item) => (
              <Pressable key={item.key} onPress={() => handleMenuPress(item)} style={styles.menuRow}>
                <Ionicons color={item.danger ? "#B72136" : "#131314"} name={item.icon} size={22} />
                <Text style={[styles.menuLabel, item.danger ? styles.menuLabelDanger : null]}>{item.label}</Text>
                {item.hasValue ? <Text style={styles.menuValue}>{formatLanguageLabel(languageCode)}</Text> : null}
                <Ionicons color={item.danger ? "#B72136" : "#747479"} name="chevron-forward" size={16} />
              </Pressable>
            ))}
          </View>
          {Platform.OS === "android" ? <View style={styles.androidTabSpacer} /> : null}
        </ScrollView>
      )}

      {Platform.OS === "android" ? (
        <Animated.View
          style={[
            styles.androidTabBarAnimatedWrap,
            { paddingBottom: Math.max(insets.bottom, 14) },
          ]}
        >
          <AndroidTabBar
            activeTabKey={activeTabKey}
            cartCount={Number(headerCache.cartCount || 0)}
            onTabPress={goToTab}
          />
        </Animated.View>
      ) : null}
      <NativeBottomSheet
        mounted={Boolean(sheet)}
        visible={isSheetVisible}
        sheet={sheet}
        onClose={closeSheet}
        onAction={handleSheetAction}
      />
    </SafeAreaView>
  );
}
