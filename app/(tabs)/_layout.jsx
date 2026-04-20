import { useRef } from "react";
import { Platform } from "react-native";
import { Tabs, usePathname } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  Icon,
  Label,
  NativeTabs,
  VectorIcon,
} from "expo-router/unstable-native-tabs";
import { useIsTabBarVisible } from "@/lib/tab-bar-visibility";
import { HybridShell } from "@/components/hybrid-shell";

const IOS_NATIVE_TABS_MIN_VERSION = 26;

function getIosMajorVersion() {
  if (Platform.OS !== "ios") return 0;
  if (typeof Platform.Version === "number") return Platform.Version;
  const parsed = Number.parseInt(String(Platform.Version || "0"), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function TabsLayout() {
  const isTabBarVisible = useIsTabBarVisible();
  const pathname = usePathname();
  const lastStableAndroidPathRef = useRef("/");

  const resolveAndroidRoutePath = () => {
    let nextPath = "/";
    if (!pathname || pathname === "/home") {
      nextPath = "/";
    } else if (pathname === "/(tabs)") {
      nextPath = null;
    } else if (pathname.startsWith("/catalog")) {
      nextPath = "/catalog";
    } else if (pathname.startsWith("/cart")) {
      nextPath = "/cart";
    } else if (pathname.startsWith("/favorites")) {
      nextPath = "/favorites";
    } else if (pathname.startsWith("/profile")) {
      nextPath = "/profile";
    }

    if (!nextPath) return lastStableAndroidPathRef.current;
    lastStableAndroidPathRef.current = nextPath;
    return nextPath;
  };

  if (Platform.OS === "android") {
    return <HybridShell routePath={resolveAndroidRoutePath()} />;
  }

  if (getIosMajorVersion() < IOS_NATIVE_TABS_MIN_VERSION) {
    return (
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: "#FE946E",
          tabBarInactiveTintColor: "#757575",
          tabBarStyle: {
            backgroundColor: "#FFFFFF",
            borderTopColor: "rgba(17, 24, 39, 0.10)",
            display: isTabBarVisible ? "flex" : "none",
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
            title: "Home",
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
            title: "Catalog",
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
            title: "Cart",
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
            title: "Favorites",
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
            title: "Profile",
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
      hidden={!isTabBarVisible}
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
        <Label>Home</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="catalog">
        <Icon
          src={{
            default: <VectorIcon family={Ionicons} name="grid-outline" />,
            selected: <VectorIcon family={Ionicons} name="grid" />,
          }}
        />
        <Label>Catalog</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="cart">
        <Icon
          src={{
            default: <VectorIcon family={Ionicons} name="bag-outline" />,
            selected: <VectorIcon family={Ionicons} name="bag" />,
          }}
        />
        <Label>Cart</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="favorites">
        <Icon
          src={{
            default: <VectorIcon family={Ionicons} name="heart-outline" />,
            selected: <VectorIcon family={Ionicons} name="heart" />,
          }}
        />
        <Label>Favorites</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon
          src={{
            default: <VectorIcon family={Ionicons} name="person-outline" />,
            selected: <VectorIcon family={Ionicons} name="person" />,
          }}
        />
        <Label>Profile</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
