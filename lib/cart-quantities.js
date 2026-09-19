import { useEffect, useSyncExternalStore } from "react";

import {
  getAuthSessionVersion,
  subscribeAuthTokens,
  getStoredAuthTokens,
  parseAuthTokens,
} from "@/lib/auth-storage";
import { getCartItems } from "@/lib/native-market-api";

const listeners = new Set();
let quantities = {};
let snapshot = {
  quantities,
  revision: 0,
  lastChange: null,
  source: "init",
};
let hydratePromise = null;
let hydratedAt = 0;
let observedSession = getAuthSessionVersion();
const HYDRATION_MAX_AGE_MS = 30000;
const EMPTY_QUANTITIES = {};
const EMPTY_SNAPSHOT = { quantities: EMPTY_QUANTITIES, revision: 0, lastChange: null, source: "init" };

subscribeAuthTokens(() => {
  const session = getAuthSessionVersion();
  if (observedSession === session) return;
  observedSession = session;
  hydratedAt = 0;
  commit({}, { source: "hydrate" });
});

function normalizeProductId(productId) {
  const value = String(productId ?? "");
  return value || null;
}

function emit() {
  snapshot = {
    ...snapshot,
    quantities,
  };
  listeners.forEach((listener) => listener());
}

function commit(nextQuantities, { productId = null, quantity = null, source }) {
  quantities = nextQuantities;
  snapshot = {
    quantities,
    revision: snapshot.revision + 1,
    lastChange:
      productId == null
        ? null
        : {
            productId: String(productId),
            quantity: Math.max(0, Number(quantity) || 0),
          },
    source,
  };
  emit();
}

function subscribeCartQuantities(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getCartQuantity(productId) {
  const id = normalizeProductId(productId);
  if (!id) return 0;
  return Number(quantities[id] ?? 0) || 0;
}

function getCartQuantitiesSnapshot() {
  return quantities;
}

function getCartQuantitiesStateSnapshot() {
  return snapshot;
}

export function setCartQuantity(productId, quantity) {
  const id = normalizeProductId(productId);
  if (!id) return;
  const nextQuantity = Math.max(0, Number(quantity) || 0);

  if (nextQuantity <= 0) {
    if (!quantities[id]) return;
    const next = { ...quantities };
    delete next[id];
    commit(next, { productId: id, quantity: 0, source: "change" });
    return;
  }

  if (quantities[id] === nextQuantity) return;
  commit(
    { ...quantities, [id]: nextQuantity },
    { productId: id, quantity: nextQuantity, source: "change" },
  );
}

export function syncCartQuantities(response, session = getAuthSessionVersion()) {
  if (session !== getAuthSessionVersion()) return quantities;
  const items = Array.isArray(response) ? response : (response?.items ?? []);
  const next = items.reduce((acc, item) => {
    const id = normalizeProductId(item?.product?.id);
    const quantity = Math.max(0, Number(item?.quantity) || 0);
    if (id && quantity > 0) acc[id] = quantity;
    return acc;
  }, {});
  hydratedAt = Date.now();
  if (Object.keys(next).length !== Object.keys(quantities).length ||
      Object.keys(next).some(id => quantities[id] !== next[id])) {
    commit(next, { source: "hydrate" });
  }
  return quantities;
}

export async function hydrateCartQuantities(accessToken, { force = false } = {}) {
  const stored = parseAuthTokens(await getStoredAuthTokens());
  const session = getAuthSessionVersion();
  const token = stored?.access;
  if (!token) return syncCartQuantities([], session);
  if (hydratePromise?.session === session) return hydratePromise.promise;
  if (!force && hydratedAt && Date.now() - hydratedAt < HYDRATION_MAX_AGE_MS) return quantities;

  const revision = snapshot.revision;
  const request = { session, promise: null };
  request.promise = (async () => {
    const response = await getCartItems(token);
    // A slow read must not overwrite a more recent button press or another login.
    if (session === getAuthSessionVersion() && revision === snapshot.revision) {
      syncCartQuantities(response, session);
    }
    return quantities;
  })();
  hydratePromise = request;
  try { return await request.promise; }
  finally { if (hydratePromise === request) hydratePromise = null; }
}

export function useCartQuantity(productId) {
  const id = normalizeProductId(productId);
  const quantity = useSyncExternalStore(
    subscribeCartQuantities,
    () => getCartQuantity(id),
    () => 0,
  );

  useEffect(() => {
    void hydrateCartQuantities().catch(() => {});
  }, []);

  return quantity;
}

function useCartQuantities() {
  const snapshot = useSyncExternalStore(
    subscribeCartQuantities,
    getCartQuantitiesSnapshot,
    () => EMPTY_QUANTITIES,
  );

  useEffect(() => {
    void hydrateCartQuantities().catch(() => {});
  }, []);

  return snapshot;
}

export function useCartQuantitiesState() {
  const state = useSyncExternalStore(
    subscribeCartQuantities,
    getCartQuantitiesStateSnapshot,
    () => EMPTY_SNAPSHOT,
  );

  useEffect(() => {
    void hydrateCartQuantities().catch(() => {});
  }, []);

  return state;
}
