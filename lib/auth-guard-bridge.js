let isLoggedInCache = false;
const guardListeners = new Set();

export function setAuthStateCache(nextValue) {
  isLoggedInCache = Boolean(nextValue);
}

function getAuthStateCache() {
  return isLoggedInCache;
}

function requestAuthGuard(path) {
  const safePath = typeof path === "string" ? path : "/";
  guardListeners.forEach((listener) => {
    try {
      listener(safePath);
    } catch {
      // no-op
    }
  });
}

function subscribeAuthGuard(listener) {
  if (typeof listener !== "function") {
    return () => {};
  }
  guardListeners.add(listener);
  return () => {
    guardListeners.delete(listener);
  };
}

