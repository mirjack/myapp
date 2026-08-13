import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { NativePageHeader } from "@/components/native-page-header";
import { GuestAuthCard } from "@/components/guest-auth-card";
import { NativeBottomSheet } from "@/components/native-bottom-sheet";
import { getHeaderCache } from "@/lib/native-header-cache";

import {
  clearStoredAuthTokens,
  getStoredAuthTokens,
  getStoredAuthTokensSync,
} from "@/lib/auth-storage";
import {
  isNativeProfileCacheFresh,
  readCachedNativeProfile,
  readCachedNativeProfileSync,
} from "@/lib/native-profile-cache";
import {
  readCachedNativeLoyaltyProfileSync,
} from "@/lib/native-loyalty-cache";
import {
  setCurrentWebPath,
  setTabBarForcedHidden,
} from "@/lib/tab-bar-visibility";
import {
  fetchCurrentUserProfile,
  fetchNativeBranding,
  fetchNativeLoyaltyProfile,
} from "@/lib/native-account-api";
import { applyAppLanguage } from "@/lib/i18n";
import { getStoredLanguageCode } from "@/lib/app-preferences";

import { nativeProfileStyles as styles } from "./native-profile.styles";

function DeveloperMark() {
  return (
    <Svg
      preserveAspectRatio="none"
      overflow="visible"
      width={11.009}
      height={11.008}
      viewBox="0 0 11.009 11.008"
      fill="none"
    >
      <Path
        d="M9.44445 0.104588C10.373 -0.32226 11.3314 0.636085 10.9044 1.56455L9.3048 5.04404C9.17056 5.33596 9.17056 5.67205 9.3048 5.96396L10.9044 9.44346C11.3314 10.3719 10.373 11.3304 9.44445 10.9034L5.96398 9.30381C5.67211 9.16971 5.33589 9.16962 5.04406 9.30381L1.56456 10.9034C0.636012 11.3304 -0.322363 10.3719 0.104602 9.44346L1.70421 5.96396C1.83845 5.67205 1.83845 5.33596 1.70421 5.04404L0.104602 1.56455C-0.322363 0.636059 0.636012 -0.322349 1.56456 0.104588L5.04406 1.7042C5.33592 1.83839 5.67209 1.83833 5.96398 1.7042L9.44445 0.104588Z"
        fill="#121212"
      />
    </Svg>
  );
}

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
  return parts.length > 0 ? parts.join(" ") : "";
}

function extractInitials(user) {
  const fullName = formatFullName(user);
  const value = fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase();
  return value || "MK";
}

function parseLoyaltyNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatLoyaltyValue(value) {
  const parsed = parseLoyaltyNumber(value);
  if (parsed == null) return "";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 })
    .format(Math.round(parsed))
    .replace(/,/g, " ");
}

function pickLoyaltyValue(source, keys, fallback = "") {
  for (const key of keys) {
    const value = source?.[key];
    if (value != null && value !== "") return value;
  }
  return fallback;
}

function normalizeLoyaltyProfile(data = {}) {
  const tiers = Array.isArray(data?.tiers)
    ? data.tiers
    : Array.isArray(data?.tier_levels)
      ? data.tier_levels
      : Array.isArray(data?.levels)
        ? data.levels
        : [];

  return {
    ...data,
    wallet_balance: pickLoyaltyValue(data, ["wallet_balance", "walletBalance"], 0),
    savings_month_amount: pickLoyaltyValue(
      data,
      ["savings_month_amount", "savingsMonthAmount"],
      0,
    ),
    savings_change_percent: pickLoyaltyValue(
      data,
      ["savings_change_percent", "savingsChangePercent"],
      0,
    ),
    total_earned_points: pickLoyaltyValue(
      data,
      ["total_earned_points", "totalEarnedPoints"],
      0,
    ),
    tier_name: pickLoyaltyValue(data, ["tier_name", "current_tier_name"], ""),
    next_tier_name: pickLoyaltyValue(data, ["next_tier_name", "nextTierName"], ""),
    tier_progress_percent: pickLoyaltyValue(
      data,
      ["tier_progress_percent", "tierProgressPercent", "progress_percent"],
      0,
    ),
    points_to_next_tier: pickLoyaltyValue(
      data,
      ["points_to_next_tier", "pointsToNextTier"],
      0,
    ),
    current_tier_position: pickLoyaltyValue(
      data,
      ["current_tier_position", "currentTierPosition"],
      null,
    ),
    tiers,
  };
}

const CONTACT_ICONS = {
  telegram: "paper-plane-outline",
  instagram: "logo-instagram",
  youtube: "logo-youtube",
  phone: "call-outline",
};

const CONTACT_ORDER = ["telegram", "instagram", "youtube", "phone"];

function DeveloperCredit() {
  const openBrandSite = () => {
    Linking.openURL("https://cmfrt.uz").catch(() => {});
  };

    return (
      <Pressable
        onPress={openBrandSite}
        style={styles.developerCreditLink}
      >
        <Text style={styles.developerCreditText}>Powered by</Text>
        <View style={styles.developerCreditBadge}>
          <View style={styles.developerCreditIconWrap}>
            <DeveloperMark />
          </View>
          <Text style={styles.developerCreditBrand}>CMFRT</Text>
        </View>
      </Pressable>
  );
}

function ProfileCardSkeleton() {
  return (
    <View style={styles.profileCard}>
      <View style={styles.profileCardRow}>
        <View style={styles.skeletonAvatar} />
        <View style={styles.profileBody}>
          <View style={[styles.skeletonLine, styles.skeletonNameLine]} />
          <View style={[styles.skeletonLine, styles.skeletonPhoneLine]} />
        </View>
        <View style={styles.skeletonActionLine} />
      </View>
    </View>
  );
}

function LoyaltyCardSkeleton() {
  return (
    <View style={styles.loyaltyCard}>
      <View style={styles.loyaltyContent}>
        <View style={styles.loyaltyTop}>
          <View style={[styles.skeletonLineDark, styles.skeletonCaptionLine]} />
          <View style={[styles.skeletonLineDark, styles.skeletonLevelLine]} />
        </View>
        <View style={[styles.skeletonLineDark, styles.skeletonHintLine]} />
        <View>
          <View style={styles.skeletonProgressTrack}>
            <View style={styles.skeletonProgressFill} />
          </View>
          <View style={styles.skeletonTierLabels}>
            {[0, 1, 2].map((item) => (
              <View key={item} style={styles.skeletonTierLabelLine} />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

function getChannelLabel(type, t) {
  const labels = {
    telegram: "Telegram",
    instagram: "Instagram",
    youtube: "YouTube",
    phone: t("profile.contact"),
  };
  return labels[type] || type;
}

function normalizeContactUrl(type, value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  if (type === "telegram") {
    if (raw.startsWith("http")) return raw;
    const handle = raw.replace(/^@/, "");
    return `https://t.me/${handle}`;
  }

  if (type === "instagram") {
    if (raw.startsWith("http")) return raw;
    const handle = raw.replace(/^@/, "");
    return `https://instagram.com/${handle}`;
  }

  if (type === "youtube") {
    if (/^https?:\/\//i.test(raw)) return raw;

    const withoutProtocol = raw.replace(/^\/\//, "");
    if (/^(?:www\.)?youtube\.com\//i.test(withoutProtocol)) {
      return `https://${withoutProtocol}`;
    }
    if (/^(?:www\.)?youtu\.be\//i.test(withoutProtocol)) {
      return `https://${withoutProtocol}`;
    }

    const handle = raw.replace(/^@/, "");
    return `https://www.youtube.com/@${handle}`;
  }

  if (type === "phone") {
    return raw.startsWith("tel:") ? raw : `tel:${raw}`;
  }

  return raw;
}

function formatContactValue(type, value) {
  const raw = String(value || "").trim();
  if (
    !raw ||
    (type !== "telegram" && type !== "instagram" && type !== "youtube")
  ) {
    return raw;
  }

  const username = raw
    .replace(
      /^https?:\/\/(?:www\.)?(?:t\.me|telegram\.me|instagram\.com|youtube\.com)\//i,
      "",
    )
    .replace(/^https?:\/\/(?:www\.)?youtu\.be\//i, "")
    .replace(/^@/, "")
    .replace(/[/?#].*$/, "")
    .trim();

  return username ? `@${username}` : raw;
}

export function NativeProfileScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const initialTokens = parseTokensString(getStoredAuthTokensSync());
  const initialCachedProfileEntry = readCachedNativeProfileSync(
    initialTokens?.access || null,
  );
  const initialCachedProfile = initialCachedProfileEntry?.profile || null;
  const initialCachedLoyaltyProfile = readCachedNativeLoyaltyProfileSync(
    initialTokens?.access || null,
  )?.profile || null;
  const hasInitialCachedProfileRef = useRef(Boolean(initialCachedProfile));
  const hasInitialCachedLoyaltyProfileRef = useRef(Boolean(initialCachedLoyaltyProfile));
  const [user, setUser] = useState(initialCachedProfile);
  const [isUserLoading, setIsUserLoading] = useState(
    Boolean(initialTokens?.access && !initialCachedProfile),
  );
  const [error, setError] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(Boolean(initialTokens?.access));
  const [languageCode, setLanguageCode] = useState("ru");
  const [loyaltyProfile, setLoyaltyProfile] = useState(initialCachedLoyaltyProfile);
  const [isLoyaltyLoading, setIsLoyaltyLoading] = useState(
    Boolean(initialTokens?.access && !initialCachedLoyaltyProfile),
  );
  const [brandingContacts, setBrandingContacts] = useState({});
  const [sheet, setSheet] = useState(null);
  const [isSheetVisible, setIsSheetVisible] = useState(false);
  const [scrollViewportHeight, setScrollViewportHeight] = useState(0);
  const [scrollContentHeight, setScrollContentHeight] = useState(0);
  const languageOptions = useMemo(
    () => [
      { code: "ru", label: t("languageNames.ru") },
      { code: "uz", label: t("languageNames.uz") },
      { code: "en", label: t("languageNames.en") },
    ],
    [t],
  );
  const primaryMenuItems = useMemo(
    () => [
      {
        key: "edit-profile",
        label: t("profile.editProfile"),
        icon: "person-outline",
        route: "/(tabs)/profile/me",
      },
      {
        key: "orders",
        label: t("profile.orders"),
        icon: "bag-handle-outline",
        route: "/(tabs)/profile/orders",
      },
      {
        key: "addresses",
        label: t("profile.addresses"),
        icon: "location-outline",
        route: "/(tabs)/profile/addresses",
      },
      {
        key: "chats",
        label: t("profile.chats"),
        icon: "chatbubble-ellipses-outline",
        route: "/(tabs)/profile/chat",
      },
      {
        key: "notifications",
        label: t("profile.notifications"),
        icon: "notifications-outline",
      },
      {
        key: "language",
        label: t("profile.language"),
        icon: "language-outline",
        action: "language",
        value: languageOptions.find((item) => item.code === languageCode)?.label,
      },
    ],
    [languageCode, languageOptions, t],
  );
  const secondaryMenuItems = useMemo(
    () => [
      {
        key: "privacy",
        label: t("profile.privacy"),
        icon: "shield-checkmark-outline",
      },
      {
        key: "terms",
        label: t("profile.terms"),
        icon: "ribbon-outline",
      },
    ],
    [t],
  );
  const fullName = formatFullName(user);
  const isProfileScrollEnabled =
    Platform.OS === "android" || scrollContentHeight > scrollViewportHeight + 4;
  const tierName = loyaltyProfile?.tier_name ?? "";
  const nextTier = loyaltyProfile?.next_tier_name ?? "";
  const rawProgress = parseLoyaltyNumber(loyaltyProfile?.tier_progress_percent);
  const progress = rawProgress == null ? null : Math.min(Math.max(rawProgress, 0), 100);
  const rawPointsToNextTier =
    loyaltyProfile?.points_to_next_tier == null
      ? ""
      : formatLoyaltyValue(loyaltyProfile.points_to_next_tier);
  const tiers = Array.isArray(loyaltyProfile?.tiers) ? loyaltyProfile.tiers : [];
  const currentTierIndex = tiers.findIndex(
    (tier) =>
      tier.is_current ||
      tier.name === tierName ||
      tier.position === loyaltyProfile?.current_tier_position,
  );
  const isLastTier = currentTierIndex >= 0 && currentTierIndex === tiers.length - 1;
  const displayedProgress = isLastTier
    ? 100
    : currentTierIndex >= 0 && tiers.length > 1
      ? ((currentTierIndex + (progress ?? 0) / 100) / (tiers.length - 1)) * 100
      : progress;
  const animatedProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const target = displayedProgress == null ? 0 : displayedProgress;
    animatedProgress.stopAnimation();
    animatedProgress.setValue(0);
    Animated.timing(animatedProgress, {
      toValue: target,
      duration: 1100,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [animatedProgress, displayedProgress]);

  const animatedProgressWidth = animatedProgress.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });
  const pointsToNextTier = isLastTier ? "" : rawPointsToNextTier;
  const tierTrail = currentTierIndex >= 0
    ? tiers.slice(isLastTier ? Math.max(0, currentTierIndex - 2) : currentTierIndex)
    : [tierName, nextTier].filter(Boolean).map((name) => ({ name }));
  const currentLevelLabel =
    tierTrail[0]?.name ||
    tierName ||
    nextTier ||
    t("profile.currentLevel");
  const headerCache = getHeaderCache();

  useEffect(() => {
    let isMounted = true;
    setCurrentWebPath("/profile");

    getStoredAuthTokens()
      .then(async (tokensString) => {
        if (!isMounted) return;
        const tokens = parseTokensString(tokensString);
        const hasAccessToken = Boolean(tokens?.access);
        setIsLoggedIn(hasAccessToken);

        if (!hasAccessToken) {
          setUser(null);
          setIsUserLoading(false);
          setLoyaltyProfile(null);
          setIsLoyaltyLoading(false);
          setBrandingContacts({});
          return;
        }

        setIsUserLoading(!hasInitialCachedProfileRef.current);
        setIsLoyaltyLoading(!hasInitialCachedLoyaltyProfileRef.current);

        const cachedLoyalty = await readCachedNativeLoyaltyProfileSync(tokens.access);
        if (!isMounted) return;
        if (cachedLoyalty?.profile) {
          setLoyaltyProfile((current) => current || normalizeLoyaltyProfile(cachedLoyalty.profile));
          setIsLoyaltyLoading(false);
        }

        const cached = await readCachedNativeProfile(tokens.access);
        if (!isMounted) return;
        if (cached?.profile) {
          setUser(cached.profile);
          setIsUserLoading(false);
          if (isNativeProfileCacheFresh(cached)) {
            setError("");
          }
        }

        if (!isNativeProfileCacheFresh(cached)) {
          fetchCurrentUserProfile()
            .then((data) => {
              if (!isMounted) return;
              setUser(data);
              setIsUserLoading(false);
              setError("");
            })
            .catch((loadError) => {
              if (!isMounted) return;
              setIsUserLoading(false);
              if (loadError?.status === 401) {
                setError("");
              } else {
                setError(t("profile.loadError"));
              }
            });
        }

        fetchNativeLoyaltyProfile()
          .then((data) => {
            if (!isMounted) return;
            if (data) {
              setLoyaltyProfile(normalizeLoyaltyProfile(data));
            }
            setIsLoyaltyLoading(false);
          })
          .catch(() => {
            if (!isMounted) return;
            setIsLoyaltyLoading(false);
            // Keep existing cached tier if refresh fails.
          });

        fetchNativeBranding()
          .then((data) => {
            if (!isMounted) return;
            setBrandingContacts(data?.organization?.contacts || {});
          })
          .catch(() => {
            if (!isMounted) return;
            setBrandingContacts({});
          });
      })
      .catch(() => {
        if (!isMounted) return;
        setIsUserLoading(false);
        setIsLoyaltyLoading(false);
        setError("");
      });

    getStoredLanguageCode().then((code) => {
      if (isMounted) {
        setLanguageCode(code || "ru");
      }
    });

    return () => {
      isMounted = false;
    };
  }, [t]);

  const openLogin = () => {
    router.push({
      pathname: "/onboarding/phone",
      params: { next: "/profile" },
    });
  };

  const closeSheet = () => {
    setIsSheetVisible(false);
    setTimeout(() => setSheet(null), 240);
  };

  const handleLogout = async () => {
    await clearStoredAuthTokens();
    setUser(null);
    setIsUserLoading(false);
    setError("");
    setLoyaltyProfile(null);
    setIsLoyaltyLoading(false);
    setBrandingContacts({});
    setIsLoggedIn(false);
    setCurrentWebPath("/");
    closeSheet();
    router.replace("/(tabs)");
  };

  const handleSheetAction = async (actionId, payload) => {
    if (actionId === "select_language" && payload?.code) {
      const nextLanguageCode = await applyAppLanguage(String(payload.code));
      setLanguageCode(nextLanguageCode);
      closeSheet();
      return;
    }

    if (actionId === "cancel_logout") {
      closeSheet();
      return;
    }

    if (actionId === "confirm_logout") {
      await handleLogout();
    }
  };

  const handleMenuPress = (item) => {
    if (item.route) {
      if (
        String(item.route).startsWith("/account/") ||
        String(item.route).startsWith("/(tabs)/profile/")
      ) {
        setTabBarForcedHidden(true);
      }
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
  };

  const openLoyaltyInfo = () => {
    router.push("/loyalty-info");
  };

  const openContactChannel = (url) => {
    if (!url) return;
    Linking.openURL(String(url)).catch(() => {});
  };

  const displayContactChannels = CONTACT_ORDER.map((type) => {
    const rawValue = brandingContacts?.[type];
    const value = String(rawValue || "").trim();
    const url = normalizeContactUrl(type, value);
    return {
      id: type,
      type,
      label: getChannelLabel(type, t),
      value: formatContactValue(type, value),
      url,
      };
  }).filter((channel) => Boolean(channel.url));

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" translucent={false} backgroundColor="#FFFFFF" />
      <View style={styles.nativePageHeaderWrap}>
        <NativePageHeader
          title={t("tabs.profile")}
          isLoggedIn={isLoggedIn}
          walletBalance={headerCache.walletBalance}
          onLoginPress={isLoggedIn ? undefined : openLogin}
        />
      </View>

      {!isLoggedIn ? (
        <GuestAuthCard
          icon="person-outline"
          title={t("profile.authorizeTitle")}
          description={t("profile.authorizeDescription")}
          actionLabel={t("common.login")}
          onAction={openLogin}
        />
      ) : (
        <ScrollView
          style={styles.scroll}
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
          {isUserLoading ? (
            <ProfileCardSkeleton />
          ) : (
            <Pressable
              onPress={() => {
                setTabBarForcedHidden(true);
                router.push("/(tabs)/profile/me");
              }}
              style={styles.profileCard}
            >
              <View style={styles.profileCardRow}>
                <View style={styles.profileAvatar}>
                  {user?.avatarUrl ? (
                    <Image
                      source={{ uri: user.avatarUrl }}
                      style={styles.profileAvatarImage}
                    />
                  ) : (
                    <Text style={styles.profileAvatarText}>
                      {extractInitials(user)}
                    </Text>
                  )}
                </View>
                <View style={styles.profileBody}>
                  <Text numberOfLines={1} style={styles.profileName}>
                    {fullName || t("profile.defaultName")}
                  </Text>
                  <Text numberOfLines={1} style={styles.profilePhone}>
                    {user?.phoneNumber || "\u2014"}
                  </Text>
                </View>
                <View style={styles.profileAction}>
                  <Text style={styles.profileActionText}>
                    {t("profile.configure")}
                  </Text>
                  <Ionicons color="#7C7C7C" name="chevron-forward" size={16} />
                </View>
              </View>
            </Pressable>
          )}

          {isLoyaltyLoading ? (
            <LoyaltyCardSkeleton />
          ) : (
            <Pressable onPress={openLoyaltyInfo} style={styles.loyaltyCard}>
              <LinearGradient
                colors={["rgba(3,229,254,0.12)", "rgba(3,241,170,0.07)", "rgba(18,18,18,0)"]}
                end={{ x: 0, y: 1 }}
                pointerEvents="none"
                start={{ x: 1, y: 0 }}
                style={styles.loyaltyGlow}
              />
              <View style={styles.loyaltyContent}>
                <View style={styles.loyaltyTop}>
                  <Text style={styles.loyaltyCaption}>
                    {t("profile.currentLevel")}
                  </Text>
                  <View style={styles.loyaltyLevelTrail}>
                    {(tierTrail.length > 0 ? tierTrail : [{ name: currentLevelLabel }]).map(
                      (tier, index) => {
                        const tierIndex = tiers.indexOf(tier);
                        const isCurrentTier = tierIndex === currentTierIndex || index === 0;
                        return (
                          <View key={tier.id ?? `${tier.name}-${index}`} style={styles.loyaltyLevelItem}>
                            {index > 0 ? (
                              <Ionicons color="rgba(255,255,255,0.3)" name="chevron-forward" size={16} />
                            ) : null}
                            <Text
                              numberOfLines={1}
                              style={[
                                styles.loyaltyLevelText,
                                isCurrentTier ? styles.loyaltyLevelTextActive : null,
                              ]}
                            >
                              {tier.name ?? ""}
                            </Text>
                          </View>
                        );
                      },
                    )}
                  </View>
                </View>

                <Text style={styles.loyaltyHint}>
                  {isLastTier
                    ? t("profile.lastTierReached")
                    : pointsToNextTier
                      ? t("profile.pointsToNextTier", {
                          points: pointsToNextTier,
                        })
                      : ""}
                </Text>

                {tiers.length > 0 ? (
                  <View>
                    <View style={styles.loyaltyProgressTrack}>
                      <Animated.View
                        style={[
                          styles.loyaltyProgressFill,
                          {
                            width: animatedProgressWidth,
                          },
                        ]}
                      />
                      <View style={styles.loyaltyDotsRow}>
                        {tiers.map((tier, index) => (
                          <View
                            key={tier.id ?? `${tier.name}-${index}`}
                            style={[
                              styles.loyaltyDot,
                              index <= currentTierIndex
                                ? styles.loyaltyDotActive
                                : null,
                            ]}
                          />
                        ))}
                      </View>
                    </View>
                    <View style={styles.loyaltyTierLabels}>
                      {tiers.map((tier, index) => (
                        <Text
                          key={tier.id ?? `${tier.name}-label-${index}`}
                          style={styles.loyaltyTierLabel}
                          numberOfLines={1}
                        >
                          {tier.name ?? ""}
                        </Text>
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            </Pressable>
          )}

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.menuWrap}>
            {primaryMenuItems.map((item, index) => (
              <Pressable
                key={item.key}
                onPress={() => handleMenuPress(item)}
                style={({ pressed }) => [
                  styles.menuRow,
                  pressed ? styles.menuRowActive : null,
                  index > 0 ? styles.menuRowBorder : null,
                ]}
              >
                <Ionicons color="#0B0B0B" name={item.icon} size={20} />
                <Text style={styles.menuLabel}>{item.label}</Text>
                {item.value ? (
                  <Text style={styles.menuValue}>{item.value}</Text>
                ) : null}
                <Ionicons
                  color="#7C7C7C"
                  name="chevron-forward"
                  size={16}
                />
              </Pressable>
            ))}
          </View>

          <View style={styles.menuWrap}>
            {displayContactChannels.map((channel, index) => {
              const IconName = CONTACT_ICONS[channel.type] ?? "open-outline";
              const hasUrl = Boolean(channel.url);

              return (
                <Pressable
                  key={channel.id}
                  disabled={!hasUrl}
                  onPress={() => openContactChannel(channel.url)}
                  style={({ pressed }) => [
                    styles.contactRow,
                    index > 0 ? styles.contactRowBorder : null,
                    pressed && hasUrl ? styles.menuRowActive : null,
                    !hasUrl ? styles.contactRowDisabled : null,
                  ]}
                >
                  <Ionicons color="#0B0B0B" name={IconName} size={20} />
                  <View style={styles.contactBody}>
                    <Text style={styles.contactLabel}>{channel.label}</Text>
                    <Text style={styles.contactValue}>
                      {channel.value || t("profile.contactDescription")}
                    </Text>
                  </View>
                  <Ionicons
                    color={hasUrl ? "#7C7C7C" : "#D0D0D6"}
                    name={hasUrl ? "open-outline" : "remove-outline"}
                    size={16}
                  />
                </Pressable>
              );
            })}
          </View>

          <View style={styles.menuWrap}>
            {secondaryMenuItems.map((item, index) => (
              <Pressable
                key={item.key}
                onPress={() => handleMenuPress(item)}
                style={({ pressed }) => [
                  styles.menuRow,
                  pressed ? styles.menuRowActive : null,
                  index > 0 ? styles.menuRowBorder : null,
                ]}
              >
                <Ionicons color="#0B0B0B" name={item.icon} size={20} />
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Ionicons
                  color="#7C7C7C"
                  name="chevron-forward"
                  size={16}
                />
              </Pressable>
            ))}
          </View>

          <View style={styles.menuWrap}>
            <Pressable
              onPress={() => {
                setSheet({
                  requestId: `profile-logout-${Date.now()}`,
                  sheetKey: "logout_confirm",
                  payload: {
                    title: t("profile.logoutConfirmTitle"),
                    description: t("profile.logoutConfirmDescription"),
                    primaryLabel: t("profile.logoutConfirmPrimary"),
                    secondaryLabel: t("profile.logoutConfirmSecondary"),
                    loadingLabel: t("profile.logoutConfirmLoading"),
                  },
                  options: {},
                });
                setIsSheetVisible(true);
              }}
              style={({ pressed }) => [
                styles.menuRow,
                pressed ? styles.menuRowActive : null,
              ]}
            >
              <Ionicons color="#FF425A" name="log-out-outline" size={20} />
              <Text style={styles.menuLabelDanger}>{t("profile.logout")}</Text>
              <Ionicons color="#FF425A" name="chevron-forward" size={16} />
            </Pressable>
          </View>
          <View style={styles.creditWrap}>
            <DeveloperCredit />
          </View>
          {Platform.OS === "android" ? (
            <View style={styles.androidTabSpacer} />
          ) : null}
        </ScrollView>
      )}

      {/*
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
      */}
      <NativeBottomSheet
        mounted={Boolean(sheet)}
        visible={isSheetVisible}
        sheet={sheet}
        onClose={closeSheet}
        onAction={handleSheetAction}
      />
    </View>
  );
}
