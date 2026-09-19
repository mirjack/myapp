const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };
async function setup() {
  const disk = new Map();
  const state = { fetch: async () => { throw new Error('offline'); }, failWrite: false, gate: null };
  const secure = {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
    getItemAsync: async key => disk.get(key) ?? null,
    setItemAsync: async (key, value) => { if (state.gate) await state.gate.promise; if (state.failWrite) throw new Error('disk failed'); disk.set(key, value); },
    deleteItemAsync: async key => { disk.delete(key); },
  };
  const context = vm.createContext({ setTimeout, clearTimeout, AbortController, process: { env: {} }, fetch: (...args) => state.fetch(...args) });
  const modules = new Map();
  async function load(name) {
    if (modules.has(name)) return modules.get(name);
    let module;
    if (name === 'expo-secure-store' || name === '@/lib/runtime-config') {
      const values = name === 'expo-secure-store' ? secure : { TENANT_DOMAIN: 'test.local', STOREFRONT_ORIGIN: 'https://test.local' };
      module = new vm.SyntheticModule(Object.keys(values), function () { for (const [key, value] of Object.entries(values)) this.setExport(key, value); }, { context });
    } else {
      module = new vm.SourceTextModule(fs.readFileSync(path.join(__dirname, '..', name.replace('@/', '') + '.js'), 'utf8'), { context });
    }
    modules.set(name, module);
    await module.link(load);
    return module;
  }
  const session = await load('@/lib/auth-session'); await session.evaluate();
  return { auth: modules.get('@/lib/auth-storage').namespace, session: session.namespace, state, disk };
}
const tokens = (access = 'a', refresh = 'r') => JSON.stringify({ access, refresh });
const ok = (access = 'b') => ({ ok: true, status: 200, json: async () => ({ access, refresh: 'rotated' }) });

test('login survives subsequent storage reads and cold hydration', async () => {
  const { auth, disk } = await setup();
  disk.set('authTokens', tokens());
  assert.equal(JSON.parse(await auth.getStoredAuthTokens()).access, 'a');
  await auth.setStoredAuthTokens(tokens('new'));
  assert.equal(JSON.parse(await auth.getStoredAuthTokens()).access, 'new');
});
test('failed persistence is reported and does not log in', async () => {
  const { auth, state } = await setup(); state.failWrite = true;
  await assert.rejects(auth.setStoredAuthTokens(tokens()), /disk failed/);
  assert.equal(auth.getStoredAuthTokensSync(), null);
});
test('overlapping login and logout cannot resurrect disk session', async () => {
  const { auth, state, disk } = await setup(); state.gate = deferred();
  const login = auth.setStoredAuthTokens(tokens());
  const logout = auth.clearStoredAuthTokens(); state.gate.resolve();
  await Promise.all([login, logout]);
  assert.equal(await auth.getStoredAuthTokens(), null);
  assert.equal(disk.has('authTokens'), false);
});
test('refresh after initially missing credentials works and concurrent callers share request', async () => {
  const { auth, session, state } = await setup();
  assert.equal(await session.refreshAccessToken(), null);
  await auth.setStoredAuthTokens(tokens());
  let count = 0; state.fetch = async () => { count++; return ok(); };
  assert.deepEqual(await Promise.all([session.refreshAccessToken('a'), session.refreshAccessToken('a')]), ['b', 'b']);
  assert.equal(count, 1);
  assert.equal(JSON.parse(await auth.getStoredAuthTokens()).refresh, 'rotated');
});
test('offline refresh preserves session and can retry', async () => {
  const { auth, session, state } = await setup(); await auth.setStoredAuthTokens(tokens());
  await assert.rejects(session.refreshAccessToken('a'), /offline/);
  assert.equal(JSON.parse(await auth.getStoredAuthTokens()).access, 'a');
  state.fetch = async () => ok(); assert.equal(await session.refreshAccessToken('a'), 'b');
});
test('late refresh cannot undo logout or replace a new account', async () => {
  for (const switchAccount of [false, true]) {
    const { auth, session, state } = await setup(); await auth.setStoredAuthTokens(tokens());
    const started = deferred(), response = deferred();
    state.fetch = async () => { started.resolve(); return response.promise; };
    const refresh = session.refreshAccessToken('a'); await started.promise;
    await auth.clearStoredAuthTokens();
    if (switchAccount) await auth.setStoredAuthTokens(tokens('other', 'other-refresh'));
    response.resolve(ok()); assert.equal(await refresh, null);
    assert.equal(auth.parseAuthTokens(await auth.getStoredAuthTokens())?.access ?? null, switchAccount ? 'other' : null);
  }
});
test('explicit refresh rejection expires session while server failure preserves it', async () => {
  for (const status of [401, 503]) {
    const { auth, session, state } = await setup(); await auth.setStoredAuthTokens(tokens());
    state.fetch = async () => ({ ok: false, status });
    if (status === 401) { await session.refreshAccessToken('a'); assert.equal(await auth.getStoredAuthTokens(), null); }
    else { await assert.rejects(session.refreshAccessToken('a')); assert.ok(await auth.getStoredAuthTokens()); }
  }
});

test('a failing observer cannot turn a successful token write into a login failure', async () => {
  const { auth, disk } = await setup();
  auth.subscribeAuthTokens(() => { throw new Error('screen failed'); });
  assert.equal(await auth.setStoredAuthTokens(tokens()), true);
  assert.equal(JSON.parse(disk.get('authTokens')).access, 'a');
  assert.equal(JSON.parse(await auth.getStoredAuthTokens()).access, 'a');
});
