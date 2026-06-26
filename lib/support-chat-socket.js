import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

import { getStoredAuthTokens } from "@/lib/auth-storage";
import {
  bootstrapSupportChatHttp,
  createSupportRequestHttp,
  resolveSupportRequestContext,
  resolveSupportTransport,
  resolveSupportUrl,
  sendSupportMessageHttp,
} from "@/lib/support-chat-api";
import {
  findActiveRequestId,
  normalizeChatEntity,
  normalizeMessageEntity,
  normalizeRequestEntity,
} from "@/lib/support-chat-state";

const REPLY_DESTINATIONS = {
  bootstrap: "/user/queue/support/bootstrap",
  request: "/user/queue/support/request",
  message: "/user/queue/support/message",
  errors: "/user/queue/support/errors",
};

const SEND_DESTINATIONS = {
  bootstrap: "/app/customer-support.bootstrap",
  request: "/app/customer-support.create-request",
  message: "/app/customer-support.send-message",
};

let supportClient = null;
let connectionPromise = null;
let replySubscriptionsReady = false;
const streamBindings = new Map();
const realtimeEventListeners = new Set();
const pendingByKind = {
  bootstrap: [],
  request: [],
  message: [],
};
const pendingOrder = [];
const SUPPORT_WS_TRANSPORT = resolveSupportTransport();
const REALTIME_ENABLED =
  SUPPORT_WS_TRANSPORT === "websocket" || SUPPORT_WS_TRANSPORT === "sockjs";
const CONNECT_TIMEOUT_MS = 6000;
const RPC_TIMEOUT_MS = 8000;

function withTimeout(promise, timeoutMs, message) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

function getSupportSocketUrl() {
  return resolveSupportUrl("/ws");
}

function getSupportBrokerUrl() {
  const socketUrl = new URL(getSupportSocketUrl());
  if (socketUrl.protocol === "https:") {
    socketUrl.protocol = "wss:";
  } else if (socketUrl.protocol === "http:") {
    socketUrl.protocol = "ws:";
  }
  return socketUrl.toString();
}

async function getConnectHeaders() {
  const tokensString = await getStoredAuthTokens();
  const accessToken = tokensString ? JSON.parse(tokensString)?.access : null;
  if (!accessToken) {
    throw new Error("Support websocket requires a customer access token");
  }

  const { tenantDomain, origin, referer } = resolveSupportRequestContext();
  const headers = {
    Authorization: `Bearer ${accessToken}`,
  };
  if (tenantDomain) {
    headers["X-Tenant-Domain"] = tenantDomain;
  }
  if (origin) {
    headers.Origin = origin;
  }
  if (referer) {
    headers.Referer = referer;
  }
  return headers;
}

function createSupportWebSocket(url, headers) {
  if (typeof WebSocket === "undefined") {
    throw new Error("WebSocket is not available in this environment");
  }

  try {
    return new WebSocket(url, undefined, { headers });
  } catch {
    return new WebSocket(url);
  }
}

function parsePayload(frame) {
  if (!frame?.body) return null;
  try {
    return JSON.parse(frame.body);
  } catch {
    return null;
  }
}

function emitRealtimeEvent(payload) {
  if (!payload || typeof payload !== "object") return;
  realtimeEventListeners.forEach((listener) => listener(payload));
}

function rejectPending(message) {
  while (pendingOrder.length) {
    const pending = pendingOrder.shift();
    const queue = pendingByKind[pending.kind];
    pendingByKind[pending.kind] = queue.filter((item) => item !== pending);
    clearTimeout(pending.timeoutId);
    pending.reject(new Error(message));
  }
}

function takePending(kind) {
  const next = pendingByKind[kind].shift();
  if (!next) return null;

  const orderIndex = pendingOrder.indexOf(next);
  if (orderIndex >= 0) {
    pendingOrder.splice(orderIndex, 1);
  }

  clearTimeout(next.timeoutId);
  return next;
}

function ensureReplySubscriptions() {
  if (!supportClient?.connected || replySubscriptionsReady) return;

  supportClient.subscribe(REPLY_DESTINATIONS.bootstrap, (frame) => {
    const pending = takePending("bootstrap");
    if (!pending) return;
    const payload = parsePayload(frame);
    pending.resolve({
      ...payload,
      organizationSlug: payload?.organizationSlug ?? null,
      chat: normalizeChatEntity(payload?.chat),
      requestTypes: Array.isArray(payload?.requestTypes)
        ? payload.requestTypes
        : [],
      problemTypes: Array.isArray(payload?.problemTypes)
        ? payload.problemTypes
        : [],
      activeRequestId:
        payload?.activeRequestId ?? findActiveRequestId(payload?.chat),
    });
  });

  supportClient.subscribe(REPLY_DESTINATIONS.request, (frame) => {
    const payload = normalizeRequestEntity(parsePayload(frame));
    const pending = takePending("request");
    if (pending) {
      pending.resolve(payload);
      return;
    }
    emitRealtimeEvent(payload);
  });

  supportClient.subscribe(REPLY_DESTINATIONS.message, (frame) => {
    const payload = normalizeMessageEntity(parsePayload(frame));
    const pending = takePending("message");
    if (pending) {
      pending.resolve(payload);
      return;
    }
    emitRealtimeEvent(payload);
  });

  supportClient.subscribe(REPLY_DESTINATIONS.errors, (frame) => {
    const payload = parsePayload(frame);
    const message = payload?.message || "Support websocket request failed";
    const pending = pendingOrder.shift();
    if (!pending) return;
    pendingByKind[pending.kind] = pendingByKind[pending.kind].filter(
      (item) => item !== pending,
    );
    clearTimeout(pending.timeoutId);
    pending.reject(new Error(message));
  });

  replySubscriptionsReady = true;
}

function resubscribeStreams() {
  streamBindings.forEach((binding, destination) => {
    binding.subscription?.unsubscribe();
    binding.subscription = createStreamSubscription(destination, binding);
  });
}

function createStreamSubscription(destination, binding) {
  return supportClient.subscribe(destination, (frame) => {
    const payload = parsePayload(frame);
    binding.listeners.forEach((listener) => listener(payload));
  });
}

export async function ensureSupportSocketConnected() {
  if (!REALTIME_ENABLED) {
    throw new Error("Support realtime is disabled");
  }

  if (supportClient?.connected) {
    ensureReplySubscriptions();
    return supportClient;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = withTimeout(
    getConnectHeaders().then(
      (connectHeaders) =>
        new Promise((resolve, reject) => {
          let settled = false;

          supportClient = new Client({
            ...(SUPPORT_WS_TRANSPORT === "sockjs"
              ? { webSocketFactory: () => new SockJS(getSupportSocketUrl()) }
              : {
                  webSocketFactory: () =>
                    createSupportWebSocket(
                      getSupportBrokerUrl(),
                      connectHeaders,
                    ),
                }),
            connectHeaders,
            reconnectDelay: 5000,
            heartbeatIncoming: 10000,
            heartbeatOutgoing: 10000,
            debug: () => {},
            onConnect: () => {
              settled = true;
              ensureReplySubscriptions();
              resubscribeStreams();
              resolve(supportClient);
            },
            onStompError: (frame) => {
              const message =
                frame?.headers?.message || "Support websocket broker error";
              if (!settled) {
                settled = true;
                reject(new Error(message));
                return;
              }
              rejectPending(message);
            },
            onWebSocketClose: () => {
              if (!settled) {
                settled = true;
                reject(new Error("Support websocket connection closed"));
                return;
              }
              replySubscriptionsReady = false;
              streamBindings.forEach((binding) => {
                binding.subscription = null;
              });
              rejectPending("Support websocket connection closed");
            },
            onWebSocketError: () => {
              if (!settled) {
                settled = true;
                reject(new Error("Support websocket connection failed"));
                return;
              }
              rejectPending("Support websocket connection failed");
            },
          });

          supportClient.activate();
        }),
    ),
    CONNECT_TIMEOUT_MS,
    "Support websocket connection timed out",
  ).finally(() => {
    connectionPromise = null;
  });

  return connectionPromise;
}

async function sendRpc(kind, destination, payload) {
  const client = await ensureSupportSocketConnected();

  return withTimeout(
    new Promise((resolve, reject) => {
      const pending = {
        kind,
        resolve,
        reject,
        timeoutId: setTimeout(() => {
          pendingByKind[kind] = pendingByKind[kind].filter(
            (item) => item !== pending,
          );
          const orderIndex = pendingOrder.indexOf(pending);
          if (orderIndex >= 0) {
            pendingOrder.splice(orderIndex, 1);
          }
          reject(new Error("Support websocket response timed out"));
        }, RPC_TIMEOUT_MS),
      };

      pendingByKind[kind].push(pending);
      pendingOrder.push(pending);

      client.publish({
        destination,
        body: JSON.stringify(payload || {}),
        headers: { "content-type": "application/json" },
      });
    }),
    RPC_TIMEOUT_MS + 500,
    "Support websocket response timed out",
  );
}

export async function bootstrapSupportChat() {
  if (!REALTIME_ENABLED) {
    return bootstrapSupportChatHttp();
  }

  try {
    return await sendRpc("bootstrap", SEND_DESTINATIONS.bootstrap, {});
  } catch {
    return bootstrapSupportChatHttp();
  }
}

export async function createSupportRequest({
  requestType,
  problemTypeId,
  text,
}) {
  if (!REALTIME_ENABLED) {
    return createSupportRequestHttp({ requestType, problemTypeId, text });
  }

  try {
    return await sendRpc("request", SEND_DESTINATIONS.request, {
      requestType,
      problemTypeId: problemTypeId ?? null,
      text,
    });
  } catch {
    return createSupportRequestHttp({ requestType, problemTypeId, text });
  }
}

export async function sendSupportMessage({ requestId, text }) {
  if (!REALTIME_ENABLED) {
    return sendSupportMessageHttp({ requestId, text });
  }

  try {
    return await sendRpc("message", SEND_DESTINATIONS.message, {
      requestId: requestId ?? null,
      text,
    });
  } catch {
    return sendSupportMessageHttp({ requestId, text });
  }
}

async function bindStream(destination, callback) {
  if (!REALTIME_ENABLED) {
    return () => {};
  }

  try {
    await ensureSupportSocketConnected();
  } catch {
    // Realtime updates are optional. Keep chat usable via HTTP fallback.
    return () => {};
  }

  const existing = streamBindings.get(destination);
  if (existing) {
    existing.listeners.add(callback);
    if (!existing.subscription && supportClient?.connected) {
      existing.subscription = createStreamSubscription(destination, existing);
    }
    return () => {
      existing.listeners.delete(callback);
      if (existing.listeners.size === 0) {
        existing.subscription?.unsubscribe();
        streamBindings.delete(destination);
      }
    };
  }

  const binding = {
    listeners: new Set([callback]),
    subscription: null,
  };
  binding.subscription = createStreamSubscription(destination, binding);

  streamBindings.set(destination, binding);

  return () => {
    binding.listeners.delete(callback);
    if (binding.listeners.size === 0) {
      binding.subscription?.unsubscribe();
      streamBindings.delete(destination);
    }
  };
}

export function subscribeSupportChatList(organizationSlug, callback) {
  return bindStream(`/user/queue/support/chat/${organizationSlug}`, callback);
}

export function subscribeSupportChatDetail(
  organizationSlug,
  chatId,
  callback,
) {
  return bindStream(
    `/user/queue/support/chat/${organizationSlug}/${chatId}`,
    callback,
  );
}

export function subscribeSupportRealtimeEvents(callback) {
  realtimeEventListeners.add(callback);
  return () => {
    realtimeEventListeners.delete(callback);
  };
}
