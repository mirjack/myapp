export const DISABLE_ZOOM_SCRIPT = `
(function() {
  var meta = document.querySelector('meta[name="viewport"]');
  if (meta) {
    meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
  } else {
    var newMeta = document.createElement('meta');
    newMeta.name = 'viewport';
    newMeta.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
    document.head.appendChild(newMeta);
  }

  var style = document.createElement('style');
  style.textContent = '* { -webkit-user-select: none !important; user-select: none !important; } html, body { -ms-overflow-style: none !important; scrollbar-width: none !important; } html::-webkit-scrollbar, body::-webkit-scrollbar, *::-webkit-scrollbar { width: 0 !important; height: 0 !important; display: none !important; }';
  document.head.appendChild(style);
})();
true;
`;

export function buildBridgeScript(tokensString, nativePlatform) {
  return `
(function () {
  try {
    window.__NATIVE_APP__ = true;
    window.__NATIVE_PLATFORM__ = ${JSON.stringify(nativePlatform)};
    document.documentElement.dataset.nativeApp = 'true';
    document.documentElement.dataset.nativePlatform = ${JSON.stringify(nativePlatform)};

    var nativeHeaderInsetStyleId = 'native-header-inset-style';

    function ensureNativeHeaderInsetStyle() {
      if (document.getElementById(nativeHeaderInsetStyleId)) return;
      var style = document.createElement('style');
      style.id = nativeHeaderInsetStyleId;
      style.textContent = 'html[data-native-app="true"] body { padding-top: 0 !important; box-sizing: border-box !important; }';
      (document.head || document.documentElement).appendChild(style);
    }

    function applyNativeHeaderInset() {
      try {
        ensureNativeHeaderInsetStyle();
        document.documentElement.style.setProperty('--native-header-inset', '0px');
      } catch (e) {}
    }

    window.__applyNativeHeaderInset = applyNativeHeaderInset;
    applyNativeHeaderInset();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', applyNativeHeaderInset, { once: true });
    }

    var nativeTokens = ${JSON.stringify(tokensString ?? null)};
    if (nativeTokens) {
      window.localStorage.setItem('authTokens', nativeTokens);
      try {
        window.dispatchEvent(new CustomEvent('auth:tokens', { detail: JSON.parse(nativeTokens) }));
      } catch (e) {}
    }

    function postTokens() {
      try {
        var tokens = window.localStorage.getItem('authTokens');
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'authTokens',
          tokens: tokens || null,
        }));
      } catch (e) {}
    }

    function postPendingAuthAction() {
      try {
        var action = window.localStorage.getItem('pendingAuthAction');
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'pendingAuthAction',
          action: action || null,
        }));
      } catch (e) {}
    }

    function postPath() {
      try {
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'pathChange',
          path: window.location.pathname || '/',
        }));
      } catch (e) {}
    }

    var originalSetItem = window.localStorage.setItem;
    window.localStorage.setItem = function (key, value) {
      originalSetItem.apply(this, arguments);
      if (key === 'authTokens') postTokens();
      if (key === 'pendingAuthAction') postPendingAuthAction();
    };

    var originalRemoveItem = window.localStorage.removeItem;
    window.localStorage.removeItem = function (key) {
      originalRemoveItem.apply(this, arguments);
      if (key === 'authTokens') postTokens();
      if (key === 'pendingAuthAction') postPendingAuthAction();
    };

    var originalPushState = window.history.pushState;
    window.history.pushState = function () {
      originalPushState.apply(window.history, arguments);
      applyNativeHeaderInset();
      postPath();
    };

    var originalReplaceState = window.history.replaceState;
    window.history.replaceState = function () {
      originalReplaceState.apply(window.history, arguments);
      applyNativeHeaderInset();
      postPath();
    };

    window.addEventListener('popstate', function () {
      applyNativeHeaderInset();
      postPath();
    });

    window.__handleNativeMessage = function (message) {
      try {
        var payload = typeof message === 'string' ? JSON.parse(message) : message;
        if (!payload || !payload.type) return;

        if (payload.type === 'AUTH_LOGOUT') {
          window.localStorage.removeItem('authTokens');
          window.dispatchEvent(new Event('auth:logout'));
        }

        if (payload.type === 'AUTH_TOKENS' && payload.payload) {
          window.localStorage.setItem('authTokens', JSON.stringify(payload.payload));
          window.dispatchEvent(new CustomEvent('auth:tokens', { detail: payload.payload }));
        }
      } catch (e) {}
    };

    postTokens();
    postPendingAuthAction();
    postPath();
  } catch (e) {}
})();
true;
`;
}
