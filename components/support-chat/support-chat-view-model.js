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

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function pickLocalizedProblemTypeName(problemType, language) {
  const normalizedLanguage = String(language || "en").toLowerCase();

  if (normalizedLanguage === "uz" && problemType?.nameUz) {
    return String(problemType.nameUz).trim();
  }
  if (normalizedLanguage === "ru" && problemType?.nameRu) {
    return String(problemType.nameRu).trim();
  }
  if (normalizedLanguage === "en" && problemType?.nameEn) {
    return String(problemType.nameEn).trim();
  }

  return (
    String(problemType?.nameUz || "").trim() ||
    String(problemType?.nameRu || "").trim() ||
    String(problemType?.nameEn || "").trim() ||
    String(problemType?.name || "").trim() ||
    ""
  );
}

export function getSupportCategoryKey(value) {
  const text = normalizeText(value);
  if (!text) return null;

  if (
    text.includes("product") ||
    text.includes("товар") ||
    text.includes("mahs")
  ) {
    return "product";
  }

  if (
    text.includes("delivery") ||
    text.includes("достав") ||
    text.includes("yetkaz")
  ) {
    return "delivery";
  }

  if (
    text.includes("service") ||
    text.includes("сервис") ||
    text.includes("xizmat")
  ) {
    return "service";
  }

  if (
    text.includes("other") ||
    text.includes("друг") ||
    text.includes("boshqa")
  ) {
    return "other";
  }

  if (text.includes("problem")) return "problem";
  if (text.includes("question")) return "question";

  return null;
}

export function getLocalizedProblemTypeLabel(problemType, t, language) {
  const rawLabel = pickLocalizedProblemTypeName(problemType, language);
  const categoryKey = getSupportCategoryKey(rawLabel);

  if (categoryKey && categoryKey !== "problem" && categoryKey !== "question") {
    return t(`support.categories.${categoryKey}`);
  }

  return rawLabel || `Type #${problemType?.id ?? ""}`;
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

function isCustomerPerson(person, customerId) {
  if (!person || customerId == null) return false;
  return Number(person?.id) === Number(customerId);
}

function getAssignedSupportPerson(request, customerId) {
  const candidates = [
    request?.assignedUser,
    request?.assigned_user,
    request?.assignee,
    request?.agent,
    request?.manager,
    request?.operator,
    request?.admin,
    request?.user,
  ];

  return candidates.find(
    (person) =>
      person &&
      typeof person === "object" &&
      !isCustomerPerson(person, customerId) &&
      getPersonDisplayName(person),
  );
}

function getPersonAvatar(person) {
  return (
    person?.avatar ||
    person?.avatarUrl ||
    person?.image ||
    person?.photo ||
    null
  );
}

export function getRequestAgentProfile(request, customerId, t) {
  const latestSupportMessage = getLatestSupportMessage(request, customerId);
  const assignedSupportPerson = getAssignedSupportPerson(request, customerId);
  const name =
    getPersonDisplayName(latestSupportMessage?.sender) ||
    getPersonDisplayName(assignedSupportPerson) ||
    "Support";

  const avatarUri =
    getPersonAvatar(latestSupportMessage?.sender) ||
    getPersonAvatar(assignedSupportPerson);

  return {
    name,
    avatarUri,
    avatarLabel: name,
  };
}

export function getRequestSummary(request, customerId, agentName, t, language) {
  const lastMessage = getLastTextMessage(request);

  if (lastMessage?.text) {
    const isCustomerMessage =
      Number(lastMessage?.sender?.id) === Number(customerId);
    const senderLabel = isCustomerMessage ? t("support.you") : agentName;
    return `${senderLabel}: ${String(lastMessage.text).trim()}`;
  }

  if (request?.problemType) {
    return getLocalizedProblemTypeLabel(request.problemType, t, language);
  }

  const requestTypeKey = getSupportCategoryKey(request?.requestType);
  if (requestTypeKey === "problem" || requestTypeKey === "question") {
    return t(`support.${requestTypeKey}`);
  }

  return t("support.supportLabel");
}

export function getRequestLastActivityTime(request) {
  const lastMessage = getLastTextMessage(request);
  return lastMessage?.time || request?.closeTime || request?.createTime;
}

export function getRequestStatusLabel(request, t) {
  const statusName = String(request?.status?.name || "").toUpperCase();
  if (
    statusName === "DONE" ||
    statusName === "CLOSED" ||
    statusName === "RESOLVED"
  ) {
    return t("support.status.closed");
  }
  if (statusName === "SOLVED") {
    return "Solved";
  }
  if (statusName === "PENDING_USER_CONFIRMATION") {
    return t("support.status.pendingConfirmation");
  }
  if (
    statusName === "NEW" ||
    statusName === "ASSIGNED" ||
    statusName === "OPEN" ||
    statusName === "IN_PROGRESS"
  ) {
    return t("support.status.open");
  }

  return request?.status?.name || t("support.status.open");
}

export function getRequestStatusTone(request) {
  const statusName = String(request?.status?.name || "").toUpperCase();

  if (
    statusName === "DONE" ||
    statusName === "CLOSED" ||
    statusName === "RESOLVED" ||
    statusName === "SOLVED"
  ) {
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
