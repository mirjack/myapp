import { useEffect, useState } from "react";

import {
  closeSupportRequest,
  rateSupportRequest,
} from "@/lib/support-chat-api";
import {
  bootstrapSupportChat,
  createSupportRequest,
  sendSupportMessage,
  subscribeSupportChatDetail,
  subscribeSupportChatList,
  subscribeSupportRealtimeEvents,
} from "@/lib/support-chat-socket";
import {
  applySupportEventToChat,
  findActiveRequestId,
  getRequestById,
  normalizeChatEntity,
  normalizeMessageEntity,
} from "@/lib/support-chat-state";

function createInitialSnapshot() {
  return {
    bootstrapData: null,
    error: "",
    loading: false,
  };
}

function createSupportChatService() {
  let snapshot = createInitialSnapshot();
  const listeners = new Set();
  let listUnsubscribe = null;
  let detailUnsubscribe = null;
  let listViewCount = 0;
  let detailViewCount = 0;
  let activeDetailRequestId = null;
  let loadSequence = 0;
  let failedMessages = new Map();
  let lastBootstrapAt = 0;
  let realtimeFollowTimer = null;
  let eventSyncTimer = null;
  let activeChatWatchTimer = null;
  const readMarkers = new Map();

  const FRESH_BOOTSTRAP_MS = 15000;
  const REALTIME_FOLLOW_MS = 10000;
  const ACTIVE_CHAT_WATCH_MS = 2000;

  function emit() {
    listeners.forEach((listener) => listener(snapshot));
  }

  function setSnapshot(nextSnapshot) {
    snapshot = nextSnapshot;
    emit();
  }

  function updateSnapshot(recipe) {
    setSnapshot(recipe(snapshot));
  }

  function rebuildFailedMessageIndex(chat) {
    const nextFailedMessages = new Map();

    for (const request of chat?.requests || []) {
      for (const message of request?.messages || []) {
        if (message?._sendStatus !== "failed") continue;
        nextFailedMessages.set(String(message.id), {
          requestId: request?.id ?? null,
          text: message?.text || "",
        });
      }
    }

    failedMessages = nextFailedMessages;
  }

  function updateBootstrapData(recipe) {
    updateSnapshot((currentSnapshot) => {
      const currentBootstrap = currentSnapshot.bootstrapData;
      const nextBootstrap = applyLocalReadState(recipe(currentBootstrap));
      rebuildFailedMessageIndex(nextBootstrap?.chat);
      return {
        ...currentSnapshot,
        bootstrapData: nextBootstrap,
      };
    });
  }

  function ensureBootstrapShape(data) {
    const nextData = data || {};
    return {
      ...nextData,
      organizationSlug: nextData.organizationSlug ?? null,
      requestTypes: Array.isArray(nextData.requestTypes)
        ? nextData.requestTypes
        : [],
      problemTypes: Array.isArray(nextData.problemTypes)
        ? nextData.problemTypes
        : [],
      chat: nextData.chat ?? { id: null, sender: null, requests: [] },
      activeRequestId:
        nextData.activeRequestId ?? findActiveRequestId(nextData.chat),
    };
  }

  function resolveIncomingSupportPayload(payload) {
    if (!payload || typeof payload !== "object") {
      return { type: "unknown", value: payload };
    }

    if (payload.chat && typeof payload.chat === "object") {
      return {
        type: "chat",
        value: {
          chat: normalizeChatEntity(payload.chat),
          activeRequestId:
            payload?.activeRequestId ?? findActiveRequestId(payload.chat),
        },
      };
    }

    if (payload.request && typeof payload.request === "object") {
      return resolveIncomingSupportPayload(payload.request);
    }

    if (payload.message && typeof payload.message === "object") {
      return resolveIncomingSupportPayload(payload.message);
    }

    if (payload.data && typeof payload.data === "object") {
      return resolveIncomingSupportPayload(payload.data);
    }

    if (payload.payload && typeof payload.payload === "object") {
      return resolveIncomingSupportPayload(payload.payload);
    }

    return { type: "event", value: payload };
  }

  function getLatestSupportMessageTime(request, customerId) {
    const latestSupportMessage = [...(request?.messages || [])]
      .filter(
        (message) =>
          Number(message?.sender?.id) !== Number(customerId) &&
          String(message?.text || "").trim(),
      )
      .sort((left, right) => {
        const leftTs = Date.parse(left?.time || "") || 0;
        const rightTs = Date.parse(right?.time || "") || 0;
        return rightTs - leftTs;
      })[0];

    return latestSupportMessage?.time || null;
  }

  function markRequestReadInStore(requestId, chat = snapshot.bootstrapData?.chat) {
    const customerId = chat?.sender?.id ?? null;
    const request = getRequestById(chat, requestId);
    const latestSupportTime = getLatestSupportMessageTime(request, customerId);
    if (!latestSupportTime) return;
    readMarkers.set(String(requestId), latestSupportTime);
  }

  function applyLocalReadState(bootstrapData) {
    if (!bootstrapData?.chat?.requests?.length) {
      return bootstrapData;
    }

    const customerId = bootstrapData.chat?.sender?.id ?? null;
    const nextRequests = (bootstrapData.chat.requests || []).map((request) => {
      const requestKey = String(request?.id ?? "");
      const readMarkerTime = readMarkers.get(requestKey);
      const shouldForceRead =
        detailViewCount > 0 &&
        activeDetailRequestId !== null &&
        Number(request?.id) === Number(activeDetailRequestId);

      const nextMessages = (request.messages || []).map((message) => {
        const isSupportMessage =
          Number(message?.sender?.id) !== Number(customerId) &&
          String(message?.text || "").trim();
        if (!isSupportMessage) {
          return message;
        }

        const isReadByMarker =
          readMarkerTime &&
          (Date.parse(message?.time || "") || 0) <=
            (Date.parse(readMarkerTime || "") || 0);

        return {
          ...message,
          _isViewed: shouldForceRead || Boolean(isReadByMarker),
        };
      });

      return {
        ...request,
        messages: nextMessages,
      };
    });

    return ensureBootstrapShape({
      ...bootstrapData,
      chat: {
        ...(bootstrapData.chat || {}),
        requests: nextRequests,
      },
    });
  }

  function applyIncomingPayload(payload) {
    if (eventSyncTimer) {
      clearTimeout(eventSyncTimer);
    }
    eventSyncTimer = setTimeout(() => {
      eventSyncTimer = null;
      if (!snapshot.bootstrapData || snapshot.loading) return;
      void hydrate(() => bootstrapSupportChat(), false).catch(() => {});
    }, 250);

    updateBootstrapData((currentBootstrap) => {
      if (!currentBootstrap) return currentBootstrap;

      const resolvedPayload = resolveIncomingSupportPayload(payload);
      const nextChat =
        resolvedPayload.type === "chat"
          ? normalizeChatEntity(resolvedPayload.value.chat)
          : applySupportEventToChat(currentBootstrap.chat, resolvedPayload.value);
      const nextRequestId =
        resolvedPayload.value?.requestId ??
        resolvedPayload.value?.id ??
        currentBootstrap.activeRequestId;

      if (
        detailViewCount > 0 &&
        activeDetailRequestId !== null &&
        Number(nextRequestId) === Number(activeDetailRequestId)
      ) {
        markRequestReadInStore(activeDetailRequestId, nextChat);
      }

      return ensureBootstrapShape({
        ...currentBootstrap,
        chat: nextChat,
        activeRequestId:
          resolvedPayload.type === "chat"
            ? resolvedPayload.value.activeRequestId ??
              findActiveRequestId(nextChat)
            : findActiveRequestId(nextChat),
      });
    });
  }

  async function resubscribeStreams() {
    listUnsubscribe?.();
    listUnsubscribe = null;
    detailUnsubscribe?.();
    detailUnsubscribe = null;

    const organizationSlug = snapshot.bootstrapData?.organizationSlug;
    const chatId = snapshot.bootstrapData?.chat?.id;
    if (!organizationSlug || !chatId) return;

    listUnsubscribe = await subscribeSupportChatList(
      organizationSlug,
      applyIncomingPayload,
    );

    detailUnsubscribe = await subscribeSupportChatDetail(
      organizationSlug,
      chatId,
      applyIncomingPayload,
    );
  }

  function startRealtimeFollow() {
    if (realtimeFollowTimer) return;

    realtimeFollowTimer = setInterval(() => {
      if (!snapshot.bootstrapData?.organizationSlug || !snapshot.bootstrapData?.chat?.id) {
        return;
      }

      void resubscribeStreams().catch(() => {});
    }, REALTIME_FOLLOW_MS);
  }

  function syncActiveChatSnapshot() {
    if (!snapshot.bootstrapData || snapshot.loading) return;
    void hydrate(() => bootstrapSupportChat(), false).catch(() => {});
  }

  function startActiveChatWatch() {
    if (activeChatWatchTimer) return;
    syncActiveChatSnapshot();
    activeChatWatchTimer = setInterval(
      syncActiveChatSnapshot,
      ACTIVE_CHAT_WATCH_MS,
    );
  }

  function stopActiveChatWatch() {
    if (activeChatWatchTimer) {
      clearInterval(activeChatWatchTimer);
      activeChatWatchTimer = null;
    }
  }

  async function hydrate(loader, nextLoading = true) {
    const requestId = ++loadSequence;

    updateSnapshot((currentSnapshot) => ({
      ...currentSnapshot,
      loading: nextLoading,
      error: "",
    }));

    try {
      const nextBootstrap = ensureBootstrapShape(await loader());
      if (requestId !== loadSequence) {
        return nextBootstrap;
      }

      const nextBootstrapWithReadState = applyLocalReadState(nextBootstrap);
      rebuildFailedMessageIndex(nextBootstrapWithReadState.chat);
      lastBootstrapAt = Date.now();
      setSnapshot({
        bootstrapData: nextBootstrapWithReadState,
        error: "",
        loading: false,
      });
      await resubscribeStreams();
      startRealtimeFollow();
      return nextBootstrapWithReadState;
    } catch (error) {
      if (requestId !== loadSequence) {
        throw error;
      }

      updateSnapshot((currentSnapshot) => ({
        ...currentSnapshot,
        loading: false,
        error: error?.message || "Failed to load support chat",
      }));
      throw error;
    }
  }

  function patchRequestMessage(requestId, messageId, recipe) {
    updateBootstrapData((currentBootstrap) => {
      if (!currentBootstrap) return currentBootstrap;

      const nextRequests = (currentBootstrap.chat?.requests || []).map((request) => {
        if (Number(request?.id) !== Number(requestId)) return request;

        return {
          ...request,
          messages: (request.messages || []).map((message) =>
            String(message?.id) === String(messageId) ? recipe(message) : message,
          ),
        };
      });

      return ensureBootstrapShape({
        ...currentBootstrap,
        chat: {
          ...(currentBootstrap.chat || {}),
          requests: nextRequests,
        },
      });
    });
  }

  function appendOptimisticMessage(requestId, text) {
    const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const customerId = snapshot.bootstrapData?.chat?.sender?.id ?? null;
    const optimisticMessage = {
      id: localId,
      text,
      time: new Date().toISOString(),
      requestId,
      sender: customerId ? { id: customerId } : null,
      _sendStatus: "sending",
    };

    updateBootstrapData((currentBootstrap) => {
      if (!currentBootstrap) return currentBootstrap;

      const nextRequests = (currentBootstrap.chat?.requests || []).map((request) => {
        if (Number(request?.id) !== Number(requestId)) return request;

        return {
          ...request,
          messages: [...(request.messages || []), optimisticMessage],
        };
      });

      return ensureBootstrapShape({
        ...currentBootstrap,
        chat: {
          ...(currentBootstrap.chat || {}),
          requests: nextRequests,
        },
      });
    });

    return localId;
  }

  function replaceOptimisticMessage(requestId, localId, message) {
    const normalizedMessage = normalizeMessageEntity(message);

    updateBootstrapData((currentBootstrap) => {
      if (!currentBootstrap) return currentBootstrap;

      const nextRequests = (currentBootstrap.chat?.requests || []).map((request) => {
        if (Number(request?.id) !== Number(requestId)) return request;

        const nextMessages = (request.messages || []).map((item) =>
          String(item?.id) === String(localId)
            ? { ...normalizedMessage, _sendStatus: "sent" }
            : item,
        );

        return {
          ...request,
          messages: nextMessages,
        };
      });

      return ensureBootstrapShape({
        ...currentBootstrap,
        chat: {
          ...(currentBootstrap.chat || {}),
          requests: nextRequests,
        },
      });
    });
  }

  function markOptimisticMessageFailed(requestId, localId, text, error) {
    failedMessages.set(String(localId), {
      requestId,
      text,
    });

    patchRequestMessage(requestId, localId, (message) => ({
      ...message,
      _sendStatus: "failed",
      _errorMessage: error?.message || "Failed to send message",
    }));
  }

  function applyRequestUpdate(updatedRequest) {
    updateBootstrapData((currentBootstrap) => {
      if (!currentBootstrap) return currentBootstrap;

      const nextChat = applySupportEventToChat(currentBootstrap.chat, updatedRequest);
      return ensureBootstrapShape({
        ...currentBootstrap,
        chat: nextChat,
        activeRequestId: findActiveRequestId(nextChat),
      });
    });
    void resubscribeStreams().catch(() => {});
  }

  subscribeSupportRealtimeEvents(applyIncomingPayload);

  return {
    getSnapshot() {
      return snapshot;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    hasBootstrapData() {
      return Boolean(snapshot.bootstrapData);
    },

    hasFreshBootstrap(maxAgeMs = FRESH_BOOTSTRAP_MS) {
      return Boolean(snapshot.bootstrapData) && Date.now() - lastBootstrapAt < maxAgeMs;
    },

    async ensureRealtimeSubscriptions() {
      if (!snapshot.bootstrapData?.organizationSlug || !snapshot.bootstrapData?.chat?.id) {
        return;
      }

      await resubscribeStreams();
      startRealtimeFollow();
    },

    enterChatListView() {
      listViewCount += 1;
      void resubscribeStreams().catch(() => {});
      startRealtimeFollow();
      startActiveChatWatch();
    },

    leaveChatListView() {
      listViewCount = Math.max(0, listViewCount - 1);
      if (listViewCount === 0) {
        stopActiveChatWatch();
      }
    },

    async load() {
      return hydrate(() => bootstrapSupportChat(), true);
    },

    async refresh({ silent = Boolean(snapshot.bootstrapData) } = {}) {
      return hydrate(() => bootstrapSupportChat(), !silent);
    },

    enterDetailView(requestId = null) {
      detailViewCount += 1;
      activeDetailRequestId = requestId ?? activeDetailRequestId;
      if (requestId !== null) {
        markRequestReadInStore(requestId);
        updateBootstrapData((currentBootstrap) => currentBootstrap);
      }
      void resubscribeStreams();
    },

    leaveDetailView() {
      detailViewCount = Math.max(0, detailViewCount - 1);
      if (detailViewCount === 0) {
        activeDetailRequestId = null;
      }
    },

    async createRequest({ requestType, problemTypeId, text }) {
      const createdRequest = await createSupportRequest({
        requestType,
        problemTypeId,
        text,
      });

      applyRequestUpdate(createdRequest);
      return createdRequest;
    },

    async sendMessage({ requestId, text }) {
      const normalizedRequestId = requestId ?? null;
      const localId = appendOptimisticMessage(normalizedRequestId, text);

      try {
        const sentMessage = await sendSupportMessage({
          requestId: normalizedRequestId,
          text,
        });
        failedMessages.delete(String(localId));
        replaceOptimisticMessage(normalizedRequestId, localId, sentMessage);
        return sentMessage;
      } catch (error) {
        markOptimisticMessageFailed(normalizedRequestId, localId, text, error);
        updateSnapshot((currentSnapshot) => ({
          ...currentSnapshot,
          error: error?.message || "Failed to send message",
        }));
        throw error;
      }
    },

    async retryMessage({ requestId, messageId }) {
      let failedMessage = failedMessages.get(String(messageId));
      if (!failedMessage?.text) {
        const request = getRequestById(snapshot.bootstrapData?.chat, requestId);
        const message = (request?.messages || []).find(
          (item) => String(item?.id) === String(messageId),
        );
        if (!message?.text) return null;
        failedMessages.set(String(messageId), {
          requestId,
          text: message.text,
        });
        failedMessage = failedMessages.get(String(messageId));
      }

      patchRequestMessage(requestId, messageId, (message) => ({
        ...message,
        _sendStatus: "sending",
        _errorMessage: "",
      }));

      try {
        const resentMessage = await sendSupportMessage({
          requestId: requestId ?? failedMessage.requestId ?? null,
          text: failedMessages.get(String(messageId))?.text || "",
        });
        failedMessages.delete(String(messageId));
        replaceOptimisticMessage(
          requestId ?? failedMessage.requestId ?? null,
          messageId,
          resentMessage,
        );
        return resentMessage;
      } catch (error) {
        markOptimisticMessageFailed(
          requestId ?? failedMessage.requestId ?? null,
          messageId,
          failedMessages.get(String(messageId))?.text || "",
          error,
        );
        updateSnapshot((currentSnapshot) => ({
          ...currentSnapshot,
          error: error?.message || "Failed to send message",
        }));
        throw error;
      }
    },

    async closeRequest({ requestId, resolved }) {
      const updatedRequest = await closeSupportRequest({ requestId, resolved });
      applyRequestUpdate(updatedRequest);
      return updatedRequest;
    },

    async rateRequest({ requestId, rating, text }) {
      const updatedRequest = await rateSupportRequest({
        requestId,
        rating,
        text,
      });
      applyRequestUpdate(updatedRequest);
      return updatedRequest;
    },
  };
}

export const supportChatService = createSupportChatService();

export function useSupportChatSnapshot() {
  const [nextSnapshot, setNextSnapshot] = useState(() =>
    supportChatService.getSnapshot(),
  );

  useEffect(() => supportChatService.subscribe(setNextSnapshot), []);

  return nextSnapshot;
}
