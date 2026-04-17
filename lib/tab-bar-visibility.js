import { useSyncExternalStore } from "react";

const TAB_BAR_VISIBLE_PATHS = new Set([
  "/",
  "/home",
  "/catalog",
  "/cart",
  "/favorite",
  "/favorites",
  "/profile",
]);

let currentWebPath = "/";
let isTabBarForcedHidden = false;
const listeners = new Set();

function normalizePath(path) {
  const safePath = String(path || "/").trim();
  const trimmed = safePath.replace(/\/+$/, "");
  return trimmed || "/";
}

function emit() {
  listeners.forEach((listener) => listener());
}

export function setCurrentWebPath(path) {
  const nextPath = normalizePath(path);
  if (nextPath === currentWebPath) return;
  currentWebPath = nextPath;
  emit();
}

export function isTabBarVisiblePath(path) {
  return TAB_BAR_VISIBLE_PATHS.has(normalizePath(path));
}

export function setTabBarForcedHidden(nextHidden) {
  const nextValue = Boolean(nextHidden);
  if (nextValue === isTabBarForcedHidden) return;
  isTabBarForcedHidden = nextValue;
  emit();
}

function subscribe(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return !isTabBarForcedHidden && isTabBarVisiblePath(currentWebPath);
}

export function useIsTabBarVisible() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
