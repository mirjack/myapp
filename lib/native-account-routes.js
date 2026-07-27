function normalizeRouteState(state) {
  if (!state || typeof state !== "object") return {};
  return state;
}

const NATIVE_ACCOUNT_PATHS = ["/profile", "/profile/me", "/user", "/orders", "/addresses"];

export function isNativeAccountPath(path) {
  const normalized = String(path || "");
  return NATIVE_ACCOUNT_PATHS.some((prefix) => normalized.startsWith(prefix));
}

export function buildNativeAccountRoute(path, state) {
  const normalizedPath = String(path || "/profile");
  const routeState = normalizeRouteState(state);

  if (normalizedPath === "/profile" || normalizedPath.startsWith("/profile?")) {
    return { pathname: "/(tabs)/profile" };
  }

  if (normalizedPath.startsWith("/orders")) {
    return {
      pathname: "/account/orders",
      params: {
        tab: routeState.tab || "",
      },
    };
  }

  if (normalizedPath.startsWith("/addresses")) {
    return {
      pathname: "/account/addresses",
      params: {
        returnTo: routeState.returnTo || "/profile",
      },
    };
  }

  return { pathname: "/account/me" };
}
