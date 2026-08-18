import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Tabs, usePathname, useRouter, useSegments } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { useEffect, useRef, useState } from "react";
import {
  Icon,
  Label,
  NativeTabs,
  VectorIcon,
} from "expo-router/unstable-native-tabs";

import { useIsTabBarVisible } from "@/lib/tab-bar-visibility";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeTabIcon } from "@/components/native-tab-icons";

const IOS_NATIVE_TABS_MIN_VERSION = 26;

const ANDROID_TABS = [
  { key: "index", path: "/(tabs)", icons: ["home-outline", "home"], label: "tabs.home" },
  { key: "catalog", path: "/(tabs)/catalog", icons: ["grid-outline", "grid"], label: "tabs.catalog" },
  { key: "cart", path: "/(tabs)/cart", icons: ["bag-outline", "bag"], label: "tabs.cart" },
  { key: "favorites", path: "/(tabs)/favorites", icons: ["heart-outline", "heart"], label: "tabs.favorites" },
  { key: "profile", path: "/(tabs)/profile", icons: ["person-outline", "person"], label: "tabs.profile" },
];

function getIosMajorVersion() {
  if (Platform.OS !== "ios") return 0;
  if (typeof Platform.Version === "number") return Platform.Version;
  const parsed = Number.parseInt(String(Platform.Version || "0"), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function TabsBody() {
  const isTabBarVisible = useIsTabBarVisible();
  const pathname = usePathname();
  const segments = useSegments();
  const { t } = useTranslation();
  const router = useRouter();
  const normalizedPathname = String(pathname || "/").replace(/\/+$/, "") || "/";
  const isNestedProfileRoute =
    normalizedPathname.startsWith("/profile/") ||
    (segments[0] === "(tabs)" &&
      segments[1] === "profile" &&
      segments[2] &&
      segments[2] !== "index");
  const shouldShowTabBar = isTabBarVisible && !isNestedProfileRoute;
  const activeKey =
    segments[1] === "catalog"
      ? "catalog"
      : segments[1] === "cart"
        ? "cart"
        : segments[1] === "favorites"
          ? "favorites"
          : segments[1] === "profile"
            ? "profile"
            : "index";
  const handleTabPress = (tab) => {
    // Replacing the already active root tab remounts its stack and replays
    // the transition animation, especially on the profile stack.
    if (tab.key === activeKey && !isNestedProfileRoute) return;
    router.replace(tab.path);
  };
  const androidBar = (
    <AndroidTabBar
      activeKey={activeKey}
      hidden={!shouldShowTabBar}
      labels={Object.fromEntries(ANDROID_TABS.map((tab) => [tab.key, t(tab.label)]))}
      onPress={handleTabPress}
    />
  );

  if (getIosMajorVersion() < IOS_NATIVE_TABS_MIN_VERSION) {
    return (
      <View style={styles.tabsRoot}>
        <Tabs
        screenOptions={{
          animation: "fade",
          headerShown: false,
          lazy: true,
          freezeOnBlur: true,
          tabBarStyle: { display: "none" },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t("tabs.home"),
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "home" : "home-outline"}
                size={22}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="catalog"
          options={{
            title: t("tabs.catalog"),
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "grid" : "grid-outline"}
                size={22}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="cart"
          options={{
            title: t("tabs.cart"),
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "bag" : "bag-outline"}
                size={22}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="favorites"
          options={{
            title: t("tabs.favorites"),
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "heart" : "heart-outline"}
                size={22}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: t("tabs.profile"),
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "person" : "person-outline"}
                size={22}
                color={color}
              />
            ),
          }}
        />
        </Tabs>
        {Platform.OS === "android" ? androidBar : null}
      </View>
    );
  }

  return (
    <NativeTabs
      hidden={!shouldShowTabBar}
      disableTransparentOnScrollEdge
      blurEffect="none"
      backgroundColor="#FFFFFF"
      shadowColor="rgba(17, 24, 39, 0.10)"
      iconColor={{ default: "#757575", selected: "#FE946E" }}
      labelStyle={{
        default: { color: "#757575", fontSize: 11, fontWeight: "500" },
        selected: { color: "#FE946E", fontSize: 11, fontWeight: "600" },
      }}
    >
      <NativeTabs.Trigger name="index">
        <Icon
          src={{
            default: <VectorIcon family={Ionicons} name="home-outline" />,
            selected: <VectorIcon family={Ionicons} name="home" />,
          }}
        />
        <Label>{t("tabs.home")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="catalog">
        <Icon
          src={{
            default: <VectorIcon family={Ionicons} name="grid-outline" />,
            selected: <VectorIcon family={Ionicons} name="grid" />,
          }}
        />
        <Label>{t("tabs.catalog")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="cart">
        <Icon
          src={{
            default: <VectorIcon family={Ionicons} name="bag-outline" />,
            selected: <VectorIcon family={Ionicons} name="bag" />,
          }}
        />
        <Label>{t("tabs.cart")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="favorites">
        <Icon
          src={{
            default: <VectorIcon family={Ionicons} name="heart-outline" />,
            selected: <VectorIcon family={Ionicons} name="heart" />,
          }}
        />
        <Label>{t("tabs.favorites")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon
          src={{
            default: <VectorIcon family={Ionicons} name="person-outline" />,
            selected: <VectorIcon family={Ionicons} name="person" />,
          }}
        />
        <Label>{t("tabs.profile")}</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

export default function TabsLayout() {
  return <TabsBody />;
}

const styles = StyleSheet.create({
  tabsRoot: { flex: 1 },
  androidBarOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: "transparent",
    zIndex: 40,
    elevation: 40,
  },
  androidBar: {
    position: "relative",
    height: 66,
    borderRadius: 999,
    padding: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.96)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 12,
  },
  androidTab: {
    flex: 1,
    height: 58,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    zIndex: 1,
  },
  androidTabActive: {},
  androidActivePill: {
    position: "absolute",
    top: 4,
    left: 4,
    height: 58,
    borderRadius: 999,
    backgroundColor: "rgba(230,230,235,0.90)",
    zIndex: 0,
  },
  androidTabLabel: { fontSize: 10, fontWeight: "600" },
});

function AndroidTabBar({ activeKey, hidden, labels, onPress }) {
  const insets = useSafeAreaInsets();
  const [barWidth, setBarWidth] = useState(0);
  const activeIndex = Math.max(
    0,
    ANDROID_TABS.findIndex((tab) => tab.key === activeKey),
  );
  const activePosition = useRef(new Animated.Value(activeIndex)).current;

  useEffect(() => {
    Animated.timing(activePosition, {
      toValue: activeIndex,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [activeIndex, activePosition]);

  const activeTranslateX = activePosition.interpolate({
    inputRange: [0, 1, 2, 3, 4],
    outputRange: [0, 1, 2, 3, 4].map(
      (index) => index * Math.max(0, (barWidth - 8) / 5),
    ),
  });
  const tabWidth = Math.max(0, (barWidth - 8) / 5);

  if (hidden) return null;

  return (
    <View style={[styles.androidBarOverlay, { paddingBottom: Math.max(insets.bottom, 14) }]}>
      <View
        onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
        style={styles.androidBar}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.androidActivePill,
            { width: tabWidth, transform: [{ translateX: activeTranslateX }] },
          ]}
        />
        {ANDROID_TABS.map((tab) => {
          const active = tab.key === activeKey;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => onPress(tab)}
              style={[styles.androidTab, active ? styles.androidTabActive : null]}
            >
              <NativeTabIcon
                type={tab.key === "index" ? "home" : tab.key}
                size={28}
                color={active ? "#FE946E" : "#757575"}
              />
              <Text style={[styles.androidTabLabel, { color: active ? "#FE946E" : "#757575" }]}>
                {labels[tab.key]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
