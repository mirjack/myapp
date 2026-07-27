import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

import { setCurrentWebPath, setTabBarForcedHidden } from "@/lib/tab-bar-visibility";

import { BASE_URL, ROUTE_GUARD_PATHS } from "./constants";
import { authPromptDescription, normalizeToTabPath } from "./utils";

const TAB_NATIVE_ROUTES = {
  home: "/",
  catalog: "/catalog",
  cart: "/cart",
  favorites: "/favorites",
  profile: "/profile",
};

export function toNativeTabsRoute(pathname) {
  const normalized = normalizeToTabPath(pathname || "/");
  if (normalized === "/catalog") return TAB_NATIVE_ROUTES.catalog;
  if (normalized === "/cart") return TAB_NATIVE_ROUTES.cart;
  if (normalized === "/favorites") return TAB_NATIVE_ROUTES.favorites;
  if (normalized === "/profile") return TAB_NATIVE_ROUTES.profile;
  return TAB_NATIVE_ROUTES.home;
}

export function openNativeAuthGuardSheetImpl({ refs, setters, navigateWebPath, targetPath }) {
  if (refs.nativeGuardOpenRef.current) return;
  refs.nativeGuardOpenRef.current = true;
  setTabBarForcedHidden(true);
  refs.authReturnPathRef.current = normalizeToTabPath(targetPath || "/");

  if (refs.webViewRef.current) {
    refs.webViewRef.current.injectJavaScript(`(function(){try{window.localStorage.setItem('lastPath', ${JSON.stringify(normalizeToTabPath(targetPath || "/"))});}catch(e){}true;})();`);
  }

  const requestId = `native_guard_${Date.now()}`;
  if (refs.nativeSheetCloseTimerRef.current) {
    clearTimeout(refs.nativeSheetCloseTimerRef.current);
    refs.nativeSheetCloseTimerRef.current = null;
  }

  refs.nativeSheetMetaRef.current.set(requestId, { source: "native_guard" });
  setters.setNativeSheet({
    requestId,
    sheetKey: "login_required",
    payload: {
      title: "Авторизуйтесь",
      description: authPromptDescription(targetPath || ""),
      imageUrl: `${BASE_URL}/race.png`,
      loginText: "Авторизоваться",
    },
    options: {},
  });
  setters.setIsNativeSheetVisible(true);
  navigateWebPath("/");
}

export function goNativeTabImpl({ tabKey, isLoggedIn, navigateWebPath, openNativeAuthGuardSheet, router }) {
  Haptics.selectionAsync().catch(() => {});

  if (Platform.OS === "android") {
    if (!isLoggedIn && (tabKey === "cart" || tabKey === "favorites" || tabKey === "profile")) {
      openNativeAuthGuardSheet(`/${tabKey}`);
      return;
    }
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

export function goToNativeLoginScreenImpl({ refs, rootNavigationState, router, targetPath }) {
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
