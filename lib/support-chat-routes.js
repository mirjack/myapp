function normalizeRouteState(state) {
  if (!state || typeof state !== "object") return {};
  return state;
}

export function isSupportChatPath(path) {
  return String(path || "").startsWith("/chat");
}

export function buildNativeSupportRoute(path, state) {
  const normalizedPath = String(path || "/chat");
  const routeState = normalizeRouteState(state);
  const segments = normalizedPath.split("/").filter(Boolean);
  const maybeId = segments[1];

  if (maybeId) {
    return {
      pathname: "/chat/[id]",
      params: {
        id: maybeId,
        requestKind: routeState.requestKind || "question",
        requestNumber: routeState.requestNumber || "",
        isDraft: maybeId === "new" ? "1" : "0",
      },
    };
  }

  return { pathname: "/chat" };
}
