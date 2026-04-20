import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

import { setCurrentWebPath, setTabBarForcedHidden } from "@/lib/tab-bar-visibility";

import { BASE_URL, ROUTE_GUARD_PATHS } from "./constants";
import { authPromptDescription, normalizeToTabPath } from "./utils";

const TAB_NATIVE_ROUTES = {
  home: "/(tabs)",
  catalog: "/(tabs)/catalog",
  cart: "/(tabs)/cart",
  favorites: "/(tabs)/favorites",
  profile: "/(tabs)/profile",
};

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
    const nextWebPath = tabKey === "home" ? "/" : `/${tabKey}`;
    navigateWebPath(nextWebPath);
    return;
  }

  const nextRoute = TAB_NATIVE_ROUTES[tabKey];
  if (nextRoute) router.replace(nextRoute);
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
