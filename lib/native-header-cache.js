import { getAuthSessionVersion, subscribeAuthTokens } from "@/lib/auth-storage";
const headerCache = {
  brandLogo: null,
  brandTitle: "Mio Beauty",
  cartCount: 0,
  walletBalance: 0,
};

export function getHeaderCache() {
  return headerCache;
}

export function updateHeaderCache(nextValues) {
  if (!nextValues || typeof nextValues !== "object") return headerCache;
  Object.assign(headerCache, nextValues);
  return headerCache;
}

let headerSession = getAuthSessionVersion();
subscribeAuthTokens(() => {
  const session = getAuthSessionVersion();
  if (session !== headerSession) {
    headerSession = session;
    headerCache.walletBalance = 0;
    headerCache.cartCount = 0;
  }
});
