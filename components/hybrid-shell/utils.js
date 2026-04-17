export function normalizeStoriesPayload(payload) {
  const items = Array.isArray(payload?.items)
    ? payload.items.filter((item) => item && typeof item === "object")
    : [];
  const numericStartIndex = Number(payload?.startIndex ?? 0);
  const startIndex = Number.isFinite(numericStartIndex)
    ? Math.max(0, Math.trunc(numericStartIndex))
    : 0;
  return { items, startIndex };
}

export function authPromptDescription(path) {
  if (path.startsWith("/cart")) return "Чтобы открыть корзину, авторизуйтесь.";
  if (path.startsWith("/favorites")) {
    return "Чтобы открыть избранное, авторизуйтесь.";
  }
  if (path.startsWith("/profile")) {
    return "Чтобы открыть профиль, авторизуйтесь.";
  }
  return "Чтобы продолжить, авторизуйтесь.";
}

export function normalizeToTabPath(path) {
  if (!path || path === "/home") return "/";
  if (path.startsWith("/catalog")) return "/catalog";
  if (path.startsWith("/cart")) return "/cart";
  if (path.startsWith("/favorites")) return "/favorites";
  if (path.startsWith("/profile")) return "/profile";
  return "/";
}

export function parseTokensString(tokensString) {
  if (!tokensString) return null;
  try {
    return JSON.parse(tokensString);
  } catch {
    return null;
  }
}

export function isTabActive(pathname, tab) {
  return (
    pathname === tab.path ||
    (tab.match || []).some(
      (matchPath) => pathname === matchPath || pathname.startsWith(`${matchPath}/`),
    )
  );
}

export function getPathFromUrl(url) {
  try {
    return new URL(url).pathname.replace(/\/+$/, "") || "/";
  } catch {
    return "/";
  }
}

export function startsWithAny(pathname, prefixes) {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function toNumber(value) {
  const str = String(value ?? "0").replace(/\s/g, "");
  const num = Number(str);
  return Number.isFinite(num) ? num : 0;
}
