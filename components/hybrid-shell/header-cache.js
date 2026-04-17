const headerCache = {
  brandLogo: null,
  brandTitle: "Comfort Market",
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
