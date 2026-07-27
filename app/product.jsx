import { useEffect } from "react";
import { useLocalSearchParams } from "expo-router";

import { HybridShell } from "@/components/hybrid-shell";
import {
  getCurrentWebPath,
  getLastNonProductWebPath,
  setCurrentWebPath,
  setTabBarForcedHidden,
} from "@/lib/tab-bar-visibility";

export default function ProductScreen() {
  const params = useLocalSearchParams();
  const productPathParam = Array.isArray(params?.productPath)
    ? params.productPath[0]
    : params?.productPath;
  const productPath =
    typeof productPathParam === "string" && productPathParam.startsWith("/")
      ? productPathParam
      : "/catalog";

  useEffect(() => {
    setTabBarForcedHidden(true);
  }, []);

  useEffect(
    () => () => {
      const currentPath = getCurrentWebPath();
      if (currentPath.startsWith("/products/")) {
        setCurrentWebPath(getLastNonProductWebPath());
      }
      setTabBarForcedHidden(false);
    },
    [],
  );

  return (
    <HybridShell
      routePath={productPath}
      preferSharedPath={false}
      productScreenMode
    />
  );
}
