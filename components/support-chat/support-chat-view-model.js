import { supportColors } from "@/components/support-chat/styles";

export function formatRequestTime(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleTimeString("uz-UZ", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getAvatarLabel(value) {
  return (
    String(value || "S")
      .trim()
      .slice(0, 1)
      .toUpperCase() || "S"
  );
}

export function getPersonDisplayName(person) {
  if (!person || typeof person !== "object") return "";

  const directName =
    person.name ||
    person.fullName ||
    person.displayName ||
    person.username ||
    "";
  if (String(directName).trim()) {
    return String(directName).trim();
  }

  return [person.firstName, person.lastName]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ")
    .trim();
}

export function getLastTextMessage(request) {
  return [...(request?.messages || [])]
    .filter((message) => String(message?.text || "").trim())
    .sort((left, right) => {
      const leftTs = Date.parse(left?.time || "") || 0;
      const rightTs = Date.parse(right?.time || "") || 0;
      return rightTs - leftTs;
    })[0];
}

export function getLatestSupportMessage(request, customerId) {
  return [...(request?.messages || [])]
    .filter(
      (message) =>
        Number(message?.sender?.id) !== Number(customerId) &&
        message?.sender,
    )
    .sort((left, right) => {
      const leftTs = Date.parse(left?.time || "") || 0;
      const rightTs = Date.parse(right?.time || "") || 0;
      return rightTs - leftTs;
    })[0];
}

export function getRequestAgentProfile(request, customerId) {
  const latestSupportMessage = getLatestSupportMessage(request, customerId);
  const name =
    getPersonDisplayName(latestSupportMessage?.sender) ||
    getPersonDisplayName(request?.user) ||
    "\u041c\u0435\u043d\u0435\u0434\u0436\u0435\u0440";

  const avatarUri =
    latestSupportMessage?.sender?.avatar ||
    latestSupportMessage?.sender?.avatarUrl ||
    latestSupportMessage?.sender?.image ||
    latestSupportMessage?.sender?.photo ||
    request?.user?.avatar ||
    request?.user?.avatarUrl ||
    request?.user?.image ||
    request?.user?.photo ||
    null;

  return {
    name,
    avatarUri,
    avatarLabel: name,
  };
}

export function getRequestSummary(request, customerId, agentName) {
  const lastMessage = getLastTextMessage(request);

  if (lastMessage?.text) {
    const isCustomerMessage =
      Number(lastMessage?.sender?.id) === Number(customerId);
    const senderLabel = isCustomerMessage ? "\u0412\u044b" : agentName;
    return `${senderLabel}: ${String(lastMessage.text).trim()}`;
  }

  return (
    request?.problemType?.nameUz ||
    request?.problemType?.nameRu ||
    request?.problemType?.nameEn ||
    request?.requestType ||
    "Support"
  );
}

export function getRequestLastActivityTime(request) {
  const lastMessage = getLastTextMessage(request);
  return lastMessage?.time || request?.closeTime || request?.createTime;
}

export function getRequestStatusLabel(request) {
  const statusName = String(request?.status?.name || "").toUpperCase();
  if (statusName === "DONE") return "Closed";
  if (statusName === "PENDING_USER_CONFIRMATION") return "Pending confirmation";
  if (statusName === "NEW" || statusName === "ASSIGNED") return "Open";
  return request?.status?.name || "Open";
}

export function getRequestStatusTone(request) {
  const statusName = String(request?.status?.name || "").toUpperCase();

  if (statusName === "DONE") {
    return {
      bg: "#F3F4F7",
      text: "#1E1F23",
    };
  }

  return {
    bg: "#FFE9E0",
    text: supportColors.orange,
  };
}

export function getUnreadSupportMessageCount(request, customerId) {
  const explicitUnreadCount =
    request?.unreadCount ??
    request?.unreadMessagesCount ??
    request?.unreadMessageCount ??
    request?.newMessagesCount ??
    null;

  const sortedMessages = [...(request?.messages || [])]
    .filter((message) => String(message?.text || "").trim())
    .sort((left, right) => {
      const leftTs = Date.parse(left?.time || "") || 0;
      const rightTs = Date.parse(right?.time || "") || 0;
      return rightTs - leftTs;
    });

  const hasLocalViewState = sortedMessages.some((message) => {
    const isCustomerMessage =
      Number(message?.sender?.id) === Number(customerId);
    return !isCustomerMessage && typeof message?._isViewed === "boolean";
  });

  if (hasLocalViewState) {
    return sortedMessages.filter((message) => {
      const isCustomerMessage =
        Number(message?.sender?.id) === Number(customerId);
      return !isCustomerMessage && !message?._isViewed;
    }).length;
  }

  if (typeof explicitUnreadCount === "number") {
    return Math.max(0, explicitUnreadCount);
  }

  let unreadCount = 0;
  for (const message of sortedMessages) {
    const isCustomerMessage =
      Number(message?.sender?.id) === Number(customerId);
    if (isCustomerMessage) break;
    unreadCount += 1;
  }

  return unreadCount;
}
