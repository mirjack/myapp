import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

import { setCurrentWebPath } from "@/lib/tab-bar-visibility";

import { ROUTE_GUARD_PATHS } from "./constants";
import { normalizeToTabPath } from "./utils";

const TAB_NATIVE_ROUTES = {
  home: "/",
  catalog: "/catalog",
  cart: "/cart",
  favorites: "/favorites",
  profile: "/(tabs)/profile",
};

export function toNativeTabsRoute(pathname) {
  const normalized = normalizeToTabPath(pathname || "/");
  if (normalized === "/catalog") return TAB_NATIVE_ROUTES.catalog;
  if (normalized === "/cart") return TAB_NATIVE_ROUTES.cart;
  if (normalized === "/favorites") return TAB_NATIVE_ROUTES.favorites;
  if (normalized === "/profile") return TAB_NATIVE_ROUTES.profile;
  return TAB_NATIVE_ROUTES.home;
}

export function goNativeTabImpl({ tabKey, navigateWebPath, router }) {
  Haptics.selectionAsync().catch(() => {});

  if (Platform.OS === "android") {
    if (tabKey === "profile") {
      router.navigate(TAB_NATIVE_ROUTES.profile);
      return;
    }

    const nextWebPath = tabKey === "home" ? "/" : `/${tabKey}`;
    navigateWebPath(nextWebPath);
    return;
  }

  const nextRoute = TAB_NATIVE_ROUTES[tabKey];
  if (nextRoute) router.navigate(nextRoute);
}

export function goToNativeLoginScreenImpl({
  refs,
  rootNavigationState,
  router,
  targetPath,
}) {
  const normalized = normalizeToTabPath(targetPath || "/");
  const returnPath = ROUTE_GUARD_PATHS.has(normalized) ? normalized : "/";
  refs.authReturnPathRef.current = returnPath;
  setCurrentWebPath("/login/phone");

  if (!rootNavigationState?.key) {
    refs.pendingNativeLoginPathRef.current = returnPath;
    return;
  }

  router.push({ pathname: "/onboarding/phone", params: { next: returnPath } });
}
