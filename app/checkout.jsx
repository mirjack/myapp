import { useEffect } from "react";

import { HybridShell } from "@/components/hybrid-shell";
import { setCurrentWebPath, setTabBarForcedHidden } from "@/lib/tab-bar-visibility";

export default function CheckoutScreen() {
  useEffect(() => () => {
    setCurrentWebPath("/cart");
    setTabBarForcedHidden(false);
  }, []);

  return <HybridShell routePath="/checkout" preferSharedPath={false} />;
}
