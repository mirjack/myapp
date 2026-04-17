import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

import { getStoredAuthTokens } from "@/lib/auth-storage";
import { getAuthStateCache, setAuthStateCache } from "@/lib/auth-guard-bridge";
import { setTabBarForcedHidden } from "@/lib/tab-bar-visibility";

import { getHeaderCache } from "./header-cache";
import { buildBridgeScript } from "./scripts";

export function useHybridShellState() {
  const cachedHeader = getHeaderCache();
  const webViewRef = useRef(null);
  const pendingPathRef = useRef(null);
  const pendingNativeLoginPathRef = useRef(null);
  const nativeSheetCloseTimerRef = useRef(null);
  const nativeSheetMetaRef = useRef(new Map());
  const nativeGuardOpenRef = useRef(false);
  const iosHomeRedirectTimerRef = useRef(null);
  const authReturnPathRef = useRef(null);
  const productSheetLoadSeqRef = useRef(0);
  const pendingAuthActionRef = useRef(null);

  const [currentPath, setCurrentPath] = useState("/");
  const [canGoBack, setCanGoBack] = useState(false);
  const [isWebReady, setIsWebReady] = useState(false);
  const [bridgeScript, setBridgeScript] = useState(() => buildBridgeScript(null, Platform.OS));
  const [isAuthLoaded, setIsAuthLoaded] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(() => getAuthStateCache());
  const [walletBalance, setWalletBalance] = useState(cachedHeader.walletBalance);
  const [cartCount, setCartCount] = useState(cachedHeader.cartCount);
  const [androidTabBarWidth, setAndroidTabBarWidth] = useState(0);
  const [brandTitle, setBrandTitle] = useState(cachedHeader.brandTitle);
  const [brandLogo, setBrandLogo] = useState(cachedHeader.brandLogo);
  const [logoBroken, setLogoBroken] = useState(false);
  const [nativeSheet, setNativeSheet] = useState(null);
  const [isNativeSheetVisible, setIsNativeSheetVisible] = useState(false);
  const [isWebFullscreen, setIsWebFullscreen] = useState(false);
  const [nativeStories, setNativeStories] = useState(null);

  useEffect(() => {
    let mounted = true;
    getStoredAuthTokens().then((tokensString) => {
      if (!mounted) return;
      const loggedIn = Boolean(tokensString);
      setBridgeScript(buildBridgeScript(tokensString, Platform.OS));
      setIsLoggedIn(loggedIn);
      setIsAuthLoaded(true);
      setAuthStateCache(loggedIn);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(
    () => () => {
      setTabBarForcedHidden(false);
      if (nativeSheetCloseTimerRef.current) {
        clearTimeout(nativeSheetCloseTimerRef.current);
      }
      if (iosHomeRedirectTimerRef.current) {
        clearTimeout(iosHomeRedirectTimerRef.current);
      }
    },
    [],
  );

  return {
    refs: {
      authReturnPathRef,
      iosHomeRedirectTimerRef,
      nativeGuardOpenRef,
      nativeSheetCloseTimerRef,
      nativeSheetMetaRef,
      pendingAuthActionRef,
      pendingNativeLoginPathRef,
      pendingPathRef,
      productSheetLoadSeqRef,
      webViewRef,
    },
    state: {
      androidTabBarWidth,
      brandLogo,
      brandTitle,
      bridgeScript,
      canGoBack,
      cartCount,
      currentPath,
      isLoggedIn,
      isAuthLoaded,
      isNativeSheetVisible,
      isWebFullscreen,
      isWebReady,
      logoBroken,
      nativeSheet,
      nativeStories,
      walletBalance,
    },
    setters: {
      setAndroidTabBarWidth,
      setBrandLogo,
      setBrandTitle,
      setCanGoBack,
      setCartCount,
      setCurrentPath,
      setCurrentWebReady: setIsWebReady,
      setIsLoggedIn,
      setIsNativeSheetVisible,
      setIsWebFullscreen,
      setLogoBroken,
      setNativeSheet,
      setNativeStories,
      setWalletBalance,
    },
  };
}
