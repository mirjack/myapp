const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
async function load(file, globals = {}) {
  const context = vm.createContext({ URL, AbortController, setTimeout, clearTimeout, btoa, ...globals });
  const module = new vm.SourceTextModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { context });
  await module.link(() => { throw new Error('Unexpected dependency'); }); await module.evaluate();
  return module.namespace;
}
test('Paycom form fields are encoded as documented GET receipt, not a query string', async () => {
  const { buildPaymentRedirectUrl: build } = await load('lib/payment-redirect.js');
  const result = build('https://checkout.paycom.uz', { merchant: 'merchant', amount: 500, 'account[order_id]': 197 });
  assert.equal(Buffer.from(result.split('/').pop(), 'base64').toString('utf8'), 'm=merchant;a=500;ac.order_id=197');
});
test('payment links reject HTTP, foreign hosts, credentials and field injection', async () => {
  const { buildPaymentRedirectUrl: build } = await load('lib/payment-redirect.js');
  for (const url of ['http://checkout.paycom.uz', 'https://checkout.paycom.uz.evil.test', 'javascript:alert(1)', 'https://user:password@checkout.paycom.uz']) assert.throws(() => build(url, {}, 'GET'));
  assert.throws(() => build('https://checkout.paycom.uz', { merchant: 'm;ac.order_id=2', amount: 500, 'account[order_id]': 1 }));
  assert.throws(() => build('https://checkout.paycom.uz', { merchant: 'm', amount: -1, 'account[order_id]': 1 }));
});
test('unsupported fiscal fields are never silently dropped from payment', async () => {
  const { buildPaymentRedirectUrl: build } = await load('lib/payment-redirect.js');
  assert.throws(() => build('https://checkout.paycom.uz', { merchant: 'm', amount: 500, 'account[order_id]': 1, detail: 'receipt' }));
});
test('stalled mutation times out once, without automatic retry', async () => {
  let calls = 0;
  const { fetchWithTimeout } = await load('lib/network-request.js', { fetch: (_url, { signal }) => {
    calls++; return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
  } });
  await assert.rejects(fetchWithTimeout('https://api.test/order', { method: 'POST', timeoutMs: 10 }), error => error.code === 'REQUEST_TIMEOUT');
  assert.equal(calls, 1);
});
test('caller cancellation reaches fetch and is not reported as a timeout', async () => {
  const { fetchWithTimeout } = await load('lib/network-request.js', { fetch: (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('caller canceled')), { once: true });
  }) });
  const controller = new AbortController();
  const request = fetchWithTimeout('https://api.test/products', { signal: controller.signal });
  controller.abort(); await assert.rejects(request, /caller canceled/);
});

test('support data and an in-flight load are cleared when account changes', async () => {
  let session = 1, resolveLoad;
  const listeners = new Set();
  const context = vm.createContext({ setInterval: () => 1, clearInterval: () => {}, setTimeout, clearTimeout, Date });
  const bootstrap = { organizationSlug: 'tenant', chat: { id: 1, requests: [] } };
  let pending = false;
  const dependencies = {
    react: { useEffect: () => {}, useState: () => {} },
    '@/lib/auth-storage': { getAuthSessionVersion: () => session, subscribeAuthTokens: listener => listeners.add(listener) },
    '@/lib/notifications': { scheduleSupportChatNotificationAsync: async () => {} },
    '@/lib/support-chat-api': { closeSupportRequest: async () => {}, rateSupportRequest: async () => {} },
    '@/lib/support-chat-socket': {
      bootstrapSupportChat: async () => pending ? new Promise(resolve => { resolveLoad = resolve; }) : bootstrap,
      createSupportRequest: async () => {}, sendSupportMessage: async () => {},
      subscribeSupportChatDetail: async () => () => {}, subscribeSupportChatList: async () => () => {}, subscribeSupportRealtimeEvents: () => () => {},
    },
  };
  const module = new vm.SourceTextModule(fs.readFileSync(path.join(__dirname, '../lib/support-chat-service.js'), 'utf8'), { context });
  await module.link(async name => {
    if (name === '@/lib/support-chat-state') {
      const state = new vm.SourceTextModule(fs.readFileSync(path.join(__dirname, '../lib/support-chat-state.js'), 'utf8'), { context });
      await state.link(() => {}); return state;
    }
    const values = dependencies[name];
    return new vm.SyntheticModule(Object.keys(values), function () { for (const [key, value] of Object.entries(values)) this.setExport(key, value); }, { context });
  });
  await module.evaluate(); const service = module.namespace.supportChatService;
  await service.load(); assert.equal(service.getSnapshot().bootstrapData.chat.id, 1);
  pending = true; const loadRequest = service.load();
  session++; listeners.forEach(listener => listener());
  assert.equal(service.getSnapshot().bootstrapData, null);
  resolveLoad(bootstrap); await loadRequest;
  assert.equal(service.getSnapshot().bootstrapData, null);
});
