export function normalizeDateTime(value) {
  if (!value || typeof value !== "string") return value ?? null;
  return value.includes("T") ? value : value.replace(" ", "T");
}

export function normalizeMessageEntity(message) {
  return {
    ...message,
    time: normalizeDateTime(message?.time),
    requestId: message?.requestId ?? null,
    chatId: message?.chatId ?? null,
  };
}

export function normalizeRequestEntity(request) {
  return {
    ...request,
    createTime: normalizeDateTime(request?.createTime),
    closeTime: normalizeDateTime(request?.closeTime),
    ratedAt: normalizeDateTime(request?.ratedAt),
    messages: Array.isArray(request?.messages)
      ? request.messages.map(normalizeMessageEntity)
      : [],
  };
}

export function normalizeChatEntity(chat) {
  if (!chat || typeof chat !== "object") {
    return { id: null, sender: null, requests: [] };
  }

  return {
    ...chat,
    requests: Array.isArray(chat.requests)
      ? chat.requests.map(normalizeRequestEntity)
      : [],
  };
}

function sortRequests(requests) {
  return [...requests].sort((left, right) => {
    const leftTs = Date.parse(left?.createTime || "") || 0;
    const rightTs = Date.parse(right?.createTime || "") || 0;
    return rightTs - leftTs;
  });
}

function sortMessages(messages) {
  return [...messages].sort((left, right) => {
    const leftTs = Date.parse(left?.time || "") || 0;
    const rightTs = Date.parse(right?.time || "") || 0;
    return leftTs - rightTs;
  });
}

function isRequestPayload(payload) {
  return (
    payload &&
    typeof payload === "object" &&
    ("requestType" in payload || "requestNumber" in payload)
  );
}

function isMessagePayload(payload) {
  return (
    payload &&
    typeof payload === "object" &&
    ("messageType" in payload || "time" in payload)
  );
}

function mergeMessageIntoRequests(requests, rawMessage) {
  const message = normalizeMessageEntity(rawMessage);
  const targetRequestId = Number(message?.requestId);

  return requests.map((request) => {
    if (targetRequestId && Number(request?.id) !== targetRequestId) {
      return request;
    }

    const nextMessages = [...(request?.messages || [])];
    const existingIndex = nextMessages.findIndex(
      (item) => String(item?.id) === String(message?.id),
    );

    if (existingIndex >= 0) {
      nextMessages[existingIndex] = {
        ...nextMessages[existingIndex],
        ...message,
      };
    } else {
      nextMessages.push(message);
    }

    return {
      ...request,
      messages: sortMessages(nextMessages),
    };
  });
}

export function applySupportEventToChat(chat, payload) {
  const currentChat = normalizeChatEntity(chat);
  if (!payload || typeof payload !== "object") {
    return currentChat;
  }

  if (isRequestPayload(payload)) {
    const normalizedRequest = normalizeRequestEntity(payload);
    const existing = currentChat.requests.filter(
      (request) => Number(request?.id) !== Number(normalizedRequest?.id),
    );

    return {
      ...currentChat,
      requests: sortRequests([normalizedRequest, ...existing]),
    };
  }

  if (isMessagePayload(payload)) {
    return {
      ...currentChat,
      requests: mergeMessageIntoRequests(currentChat.requests, payload),
    };
  }

  return currentChat;
}

export function findActiveRequestId(chat) {
  return (
    normalizeChatEntity(chat).requests.find((request) => Boolean(request?.active))
      ?.id ?? null
  );
}

export function sortSupportRequests(requests) {
  return sortRequests(requests || []);
}

export function getRequestById(chat, requestId) {
  if (!chat || !Array.isArray(chat.requests)) return null;

  return (
    chat.requests.find((request) => Number(request?.id) === Number(requestId)) ||
    null
  );
}
