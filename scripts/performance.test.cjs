const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };
const items = quantity => [{ product: { id: 'p' }, quantity }];
async function setup() {
  let session = 1, now = 100000, calls = 0;
  const listeners = new Set();
  let fetch = async () => items(2);
  const context = vm.createContext({ Date: { now: () => now } });
  const dependencies = {
    react: { useEffect: () => {}, useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot() },
    '@/lib/auth-storage': {
      getAuthSessionVersion: () => session,
      subscribeAuthTokens: listener => { listeners.add(listener); return () => listeners.delete(listener); },
      getStoredAuthTokens: async () => JSON.stringify({ access: `token-${session}` }),
      parseAuthTokens: JSON.parse,
    },
    '@/lib/native-market-api': { getCartItems: async () => { calls++; return fetch(); } },
  };
  const module = new vm.SourceTextModule(fs.readFileSync(path.join(__dirname, '../lib/cart-quantities.js'), 'utf8'), { context });
  await module.link(async name => {
    const values = dependencies[name];
    return new vm.SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    }, { context });
  });
  await module.evaluate();
  return {
    cart: module.namespace, calls: () => calls,
    advance: ms => { now += ms; },
    fetch: fn => { fetch = fn; },
    switchSession: () => { session++; listeners.forEach(listener => listener()); },
  };
}

test('100 simultaneous cards share one cart request; subsequent mounts reuse fresh data', async () => {
  const { cart, calls } = await setup();
  await Promise.all(Array.from({ length: 100 }, () => cart.hydrateCartQuantities()));
  await cart.hydrateCartQuantities();
  assert.equal(calls(), 1);
  assert.equal(cart.useCartQuantity('p'), 2);
});
test('expired cache refreshes and explicit force bypasses cache', async () => {
  const { cart, calls, advance } = await setup();
  await cart.hydrateCartQuantities();
  advance(31000); await cart.hydrateCartQuantities();
  await cart.hydrateCartQuantities(undefined, { force: true });
  assert.equal(calls(), 3);
});
test('unchanged cart response preserves external store snapshot identity', async () => {
  const { cart } = await setup();
  cart.syncCartQuantities(items(2)); const before = cart.useCartQuantitiesState();
  cart.syncCartQuantities(items(2));
  assert.equal(cart.useCartQuantitiesState(), before);
});
test('slow hydration does not undo a newer quantity change', async () => {
  const env = await setup(); const response = deferred(), started = deferred();
  env.fetch(async () => { started.resolve(); return response.promise; });
  const pending = env.cart.hydrateCartQuantities(); await started.promise;
  env.cart.setCartQuantity('p', 5); response.resolve(items(1)); await pending;
  assert.equal(env.cart.useCartQuantity('p'), 5);
});
test('account switch resets cache and ignores previous account response', async () => {
  const env = await setup(); const response = deferred(), started = deferred();
  env.cart.syncCartQuantities(items(3));
  env.fetch(async () => { started.resolve(); return response.promise; });
  const pending = env.cart.hydrateCartQuantities(undefined, { force: true }); await started.promise;
  env.switchSession(); assert.equal(env.cart.useCartQuantity('p'), 0);
  response.resolve(items(9)); await pending;
  assert.equal(env.cart.useCartQuantity('p'), 0);
  env.fetch(async () => items(4)); await env.cart.hydrateCartQuantities();
  assert.equal(env.cart.useCartQuantity('p'), 4);
});
test('network failure permits retry and keeps existing quantities', async () => {
  const env = await setup(); env.cart.setCartQuantity('p', 2);
  env.fetch(async () => { throw new Error('offline'); });
  await assert.rejects(env.cart.hydrateCartQuantities());
  assert.equal(env.cart.useCartQuantity('p'), 2);
  env.fetch(async () => items(4)); await env.cart.hydrateCartQuantities();
  assert.equal(env.cart.useCartQuantity('p'), 4);
});
