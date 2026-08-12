import { Platform } from "react-native";
import { Tabs, usePathname, useSegments } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import {
  Icon,
  Label,
  NativeTabs,
  VectorIcon,
} from "expo-router/unstable-native-tabs";

import { useIsTabBarVisible } from "@/lib/tab-bar-visibility";

const IOS_NATIVE_TABS_MIN_VERSION = 26;

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
  const normalizedPathname = String(pathname || "/").replace(/\/+$/, "") || "/";
  const isNestedProfileRoute =
    normalizedPathname.startsWith("/profile/") ||
    (segments[0] === "(tabs)" &&
      segments[1] === "profile" &&
      segments[2] &&
      segments[2] !== "index");
  const shouldShowTabBar = isTabBarVisible && !isNestedProfileRoute;

  if (getIosMajorVersion() < IOS_NATIVE_TABS_MIN_VERSION) {
    return (
      <Tabs
        screenOptions={{
          animation: "fade",
          headerShown: false,
          lazy: true,
          freezeOnBlur: true,
          tabBarActiveTintColor: "#FE946E",
          tabBarInactiveTintColor: "#757575",
          tabBarStyle: {
            backgroundColor: "#FFFFFF",
            borderTopColor: "rgba(17, 24, 39, 0.10)",
            display: shouldShowTabBar ? "flex" : "none",
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "600",
          },
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
