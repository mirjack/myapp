import { useEffect, useSyncExternalStore } from "react";

import {
  getStoredAuthTokens,
  getStoredAuthTokensSync,
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

export async function hydrateCartQuantities(accessToken, { force = false } = {}) {
  if (!force && hydratePromise) return hydratePromise;

  hydratePromise = (async () => {
    const token =
      accessToken ||
      parseAuthTokens(getStoredAuthTokensSync())?.access ||
      parseAuthTokens(await getStoredAuthTokens())?.access;

    if (!token) {
      commit({}, { source: "hydrate" });
      return quantities;
    }

    const response = await getCartItems(token);
    const items = Array.isArray(response) ? response : (response?.items ?? []);
    const nextQuantities = items.reduce((acc, item) => {
      const id = normalizeProductId(item?.product?.id);
      const quantity = Math.max(0, Number(item?.quantity) || 0);
      if (id && quantity > 0) acc[id] = quantity;
      return acc;
    }, {});
    commit(nextQuantities, { source: "hydrate" });
    return quantities;
  })().finally(() => {
    hydratePromise = null;
  });

  return hydratePromise;
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
    () => ({}),
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
    () => ({
      quantities: {},
      revision: 0,
      lastChange: null,
      source: "init",
    }),
  );

  useEffect(() => {
    void hydrateCartQuantities().catch(() => {});
  }, []);

  return state;
}
