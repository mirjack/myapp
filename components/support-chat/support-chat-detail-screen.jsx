import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { NativeBottomSheet } from "@/components/native-bottom-sheet";
import { SupportHeader } from "@/components/support-chat/support-header";
import { supportColors, supportStyles } from "@/components/support-chat/styles";
import { getRequestAgentProfile } from "@/components/support-chat/support-chat-view-model";
import {
  supportChatService,
  useSupportChatSnapshot,
} from "@/lib/support-chat-service";
import { formatSupportTime } from "@/lib/support-chat-format";
import { getRequestById } from "@/lib/support-chat-state";

const TILE_STYLES = [
  { bg: "#FDEBE4", color: "#FF8B63", icon: "bag-handle" },
  { bg: "#E4F8EA", color: "#1BC943", icon: "car-sport" },
  { bg: "#EDE3FF", color: "#8C46F6", icon: "person-circle" },
  { bg: "#F2F2F3", color: "#131314", icon: "albums" },
];

function isSupportAuthError(errorMessage) {
  return String(errorMessage || "")
    .toLowerCase()
    .includes("customer access token");
}

function normalizeMessages(messages, customerId) {
  const normalizedMessages = [...(messages || [])]
    .map((message) => ({
      id: message.id || `${message.time}-${message.text}`,
      text: message.text || "",
      time: message.time,
      sendStatus: message._sendStatus || "sent",
      errorMessage: message._errorMessage || "",
      from:
        Number(message?.sender?.id) === Number(customerId) ? "me" : "support",
    }))
    .filter((message) => message.text)
    .sort((left, right) => {
      const leftTs = Date.parse(left.time || "") || 0;
      const rightTs = Date.parse(right.time || "") || 0;
      return leftTs - rightTs;
    });

  return normalizedMessages.map((message, index) => {
    if (message.from !== "me" || message.sendStatus !== "sent") {
      return message;
    }

    const hasSupportReplyAfter = normalizedMessages
      .slice(index + 1)
      .some((nextMessage) => nextMessage.from === "support");

    return {
      ...message,
      deliveryStatus: hasSupportReplyAfter ? "read" : "sent",
    };
  });
}

function normalizeRequestKind(value) {
  return String(value || "question")
    .trim()
    .toUpperCase() === "PROBLEM"
    ? "PROBLEM"
    : "QUESTION";
}

function getProblemTypeLabel(problemType) {
  const rawLabel =
    problemType?.nameRu ||
    problemType?.nameUz ||
    problemType?.nameEn ||
    problemType?.name ||
    `Type #${problemType?.id ?? ""}`;

  return String(rawLabel)
    .replace(/\s+(ru|uz|en)\b/gi, "")
    .replace(/\b(ru|uz|en)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function getProblemTileStyle(problemType, index) {
  const label = getProblemTypeLabel(problemType).toLowerCase();

  if (
    label.includes("проду") ||
    label.includes("mahs") ||
    label.includes("товар") ||
    label.includes("product")
  ) {
    return TILE_STYLES[0];
  }

  if (
    label.includes("достав") ||
    label.includes("yetkaz") ||
    label.includes("delivery")
  ) {
    return TILE_STYLES[1];
  }

  if (
    label.includes("сервис") ||
    label.includes("xizmat") ||
    label.includes("service")
  ) {
    return TILE_STYLES[2];
  }

  if (
    label.includes("дру") ||
    label.includes("boshqa") ||
    label.includes("other")
  ) {
    return TILE_STYLES[3];
  }

  return TILE_STYLES[index % TILE_STYLES.length];
}

function getRequestBadgeLabel(request, requestType) {
  const problemLabel = request?.problemType
    ? getProblemTypeLabel(request.problemType)
    : "";

  if (problemLabel) {
    return problemLabel;
  }

  return String(requestType || "")
    .trim()
    .toUpperCase() === "PROBLEM"
    ? "\u041f\u0440\u043e\u0431\u043b\u0435\u043c\u0430"
    : "\u0412\u043e\u043f\u0440\u043e\u0441";
}

function MessageBubble({
  text,
  time,
  isOwnMessage,
  sendStatus,
  deliveryStatus,
  onRetry,
}) {
  return (
    <View
      style={
        isOwnMessage
          ? supportStyles.messageRowMine
          : supportStyles.messageRowOther
      }
    >
      <View
        style={[
          supportStyles.bubble,
          isOwnMessage ? supportStyles.bubbleMine : supportStyles.bubbleOther,
        ]}
      >
        <Text style={supportStyles.bubbleText}>{text}</Text>
        <View style={supportStyles.bubbleMeta}>
          {sendStatus === "sending" ? (
            <ActivityIndicator
              size="small"
              color="#8D8D8D"
              style={supportStyles.bubbleMetaLoader}
            />
          ) : null}
          {sendStatus === "sent" && isOwnMessage ? (
            <Ionicons
              name={deliveryStatus === "read" ? "checkmark-done" : "checkmark"}
              size={11}
              color="#8D8D8D"
              style={supportStyles.bubbleMetaIcon}
            />
          ) : null}
          {sendStatus === "failed" ? (
            <Ionicons
              name="alert-circle-outline"
              size={11}
              color="#B72136"
              style={supportStyles.bubbleMetaIcon}
            />
          ) : null}
          <Text style={supportStyles.bubbleTime}>{time}</Text>
        </View>
      </View>
      {sendStatus === "failed" ? (
        <Pressable onPress={onRetry} style={supportStyles.messageRetryButton}>
          <Text style={supportStyles.messageRetryText}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function SupportChatDetailScreen({
  requestId,
  requestKind,
  requestNumber,
  isDraft,
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const ScreenKeyboardContainer =
    Platform.OS === "ios" ? KeyboardAvoidingView : View;
  const screenKeyboardContainerProps =
    Platform.OS === "ios"
      ? {
          behavior: "padding",
          keyboardVerticalOffset: 0,
        }
      : {};
  const { bootstrapData, error, loading } = useSupportChatSnapshot();
  const scrollRef = useRef(null);
  const sheetCloseTimerRef = useRef(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [androidKeyboardOffset, setAndroidKeyboardOffset] = useState(0);
  const [selectedProblemType, setSelectedProblemType] = useState(null);
  const [activeSheetKey, setActiveSheetKey] = useState(null);
  const [isSheetMounted, setIsSheetMounted] = useState(false);
  const [renderedSheet, setRenderedSheet] = useState(null);
  const [isClosingRequest, setIsClosingRequest] = useState(false);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [returnToListAfterRating, setReturnToListAfterRating] = useState(false);

  const normalizedRequestType = useMemo(
    () => normalizeRequestKind(requestKind),
    [requestKind],
  );
  const numericRequestId =
    requestId && requestId !== "new" ? Number(requestId) : null;

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      try {
        const hasBootstrap = supportChatService.hasBootstrapData();

        if (hasBootstrap && !supportChatService.hasFreshBootstrap()) {
          void supportChatService.refresh({ silent: true }).catch(() => {});
        }

        const nextBootstrap = hasBootstrap
          ? supportChatService.getSnapshot().bootstrapData
          : await supportChatService.load();
        if (!isActive) return;

        if (isDraft && nextBootstrap?.activeRequestId) {
          router.replace({
            pathname: "/chat/[id]",
            params: { id: String(nextBootstrap.activeRequestId) },
          });
        }
      } catch (_nextError) {
        if (!isActive) return;
      }
    };

    void load();
    return () => {
      isActive = false;
    };
  }, [isDraft, router]);

  useEffect(() => {
    return () => {
      if (sheetCloseTimerRef.current) {
        clearTimeout(sheetCloseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isDraft) {
      supportChatService.enterDetailView(numericRequestId);
    }
    return () => {
      supportChatService.leaveDetailView();
    };
  }, [isDraft, numericRequestId]);

  useEffect(() => {
    if (Platform.OS !== "android") return undefined;

    const handleKeyboardShow = (event) => {
      const nextHeight = Math.max(
        0,
        (event?.endCoordinates?.height ?? 0) - insets.bottom,
      );
      setAndroidKeyboardOffset(nextHeight);
    };

    const handleKeyboardHide = () => {
      setAndroidKeyboardOffset(0);
    };

    const showSubscription = Keyboard.addListener(
      "keyboardDidShow",
      handleKeyboardShow,
    );
    const hideSubscription = Keyboard.addListener(
      "keyboardDidHide",
      handleKeyboardHide,
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [insets.bottom]);

  const currentRequest = useMemo(
    () => getRequestById(bootstrapData?.chat, numericRequestId),
    [bootstrapData?.chat, numericRequestId],
  );
  const currentStatusName = String(
    currentRequest?.status?.name || "",
  ).toUpperCase();
  const isPendingConfirmation =
    !isDraft &&
    Boolean(currentRequest?.active) &&
    currentStatusName === "PENDING_USER_CONFIRMATION";
  const customerId = bootstrapData?.chat?.sender?.id ?? null;
  const messages = useMemo(
    () => normalizeMessages(currentRequest?.messages, customerId),
    [currentRequest?.messages, customerId],
  );
  const problemTypes = bootstrapData?.problemTypes || [];
  const shouldShowTypePicker =
    isDraft && normalizedRequestType === "PROBLEM" && !selectedProblemType;
  const isClosedRequest = !isDraft && currentRequest && !currentRequest.active;
  const canRateClosedRequest =
    isClosedRequest &&
    Boolean(currentRequest?.resolutionConfirmed) &&
    !currentRequest?.rate &&
    !currentRequest?.ratedAt;
  const isRateSheetOpen = activeSheetKey === "support_request_rate";
  const existingRating = currentRequest?.rate?.rating ?? null;
  const existingRatingComment =
    currentRequest?.rate?.text ||
    currentRequest?.rate?.comment ||
    currentRequest?.rate?.description ||
    "";
  const supportAgentProfile = useMemo(
    () => getRequestAgentProfile(currentRequest, customerId),
    [currentRequest, customerId],
  );
  const scrollToBottom = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated });
    });
  }, []);
  const headerBadgeLabel = useMemo(
    () =>
      !shouldShowTypePicker
        ? getRequestBadgeLabel(
            currentRequest,
            currentRequest?.requestType || normalizedRequestType,
          )
        : "",
    [currentRequest, normalizedRequestType, shouldShowTypePicker],
  );

  useEffect(() => {
    if (!messages.length) return;
    const timer = setTimeout(() => {
      scrollToBottom(true);
    }, 40);
    return () => clearTimeout(timer);
  }, [messages.length, androidKeyboardOffset, scrollToBottom]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    if (shouldShowTypePicker) {
      return;
    }

    if (isDraft && sending) return;

    try {
      if (isDraft) {
        setSending(true);
        const createdRequest = await supportChatService.createRequest({
          requestType: normalizedRequestType,
          problemTypeId: selectedProblemType?.id ?? null,
          text,
        });

        setInput("");
        router.replace({
          pathname: "/chat/[id]",
          params: {
            id: String(createdRequest.id),
            requestKind: String(
              createdRequest.requestType || normalizedRequestType,
            ).toLowerCase(),
            requestNumber: createdRequest.requestNumber || "",
          },
        });
        return;
      }

      setInput("");
      void supportChatService
        .sendMessage({
          requestId: currentRequest?.id ?? numericRequestId,
          text,
        })
        .catch(() => {});
    } catch {
      // state error is already owned by the shared service
    } finally {
      if (isDraft) {
        setSending(false);
      }
    }
  };

  const handleConfirmResolved = useCallback(async () => {
    if (!currentRequest?.id || isClosingRequest) return;

    try {
      setIsClosingRequest(true);
      const updatedRequest = await supportChatService.closeRequest({
        requestId: currentRequest.id,
        resolved: true,
      });
      handleCloseActiveSheet();

      if (!updatedRequest?.rate && !updatedRequest?.ratedAt) {
        setRatingValue(5);
        setRatingComment("");
        setReturnToListAfterRating(true);
        handleOpenSheet("support_request_rate");
        return;
      }

      router.replace("/chat");
    } catch {
      // state error is already owned by the shared service
    } finally {
      setIsClosingRequest(false);
    }
  }, [
    currentRequest?.id,
    handleCloseActiveSheet,
    handleOpenSheet,
    isClosingRequest,
    router,
  ]);

  const handleNotResolved = useCallback(async () => {
    if (!isPendingConfirmation) {
      handleCloseActiveSheet();
      return;
    }

    if (!currentRequest?.id || isClosingRequest) return;

    try {
      setIsClosingRequest(true);
      await supportChatService.closeRequest({
        requestId: currentRequest.id,
        resolved: false,
      });
      handleCloseActiveSheet();
    } catch {
      // state error is already owned by the shared service
    } finally {
      setIsClosingRequest(false);
    }
  }, [
    currentRequest?.id,
    handleCloseActiveSheet,
    isClosingRequest,
    isPendingConfirmation,
  ]);

  const handleOpenSheet = useCallback((sheetKey) => {
    if (sheetCloseTimerRef.current) {
      clearTimeout(sheetCloseTimerRef.current);
      sheetCloseTimerRef.current = null;
    }
    setIsSheetMounted(true);
    setActiveSheetKey(sheetKey);
  }, []);

  const handleCloseActiveSheet = useCallback(() => {
    setActiveSheetKey(null);
    if (sheetCloseTimerRef.current) {
      clearTimeout(sheetCloseTimerRef.current);
    }
    sheetCloseTimerRef.current = setTimeout(() => {
      setIsSheetMounted(false);
      setRenderedSheet(null);
      sheetCloseTimerRef.current = null;
    }, 320);
  }, []);

  const activeSheet = useMemo(() => {
    if (activeSheetKey === "support_request_close") {
      return {
        requestId: `support-close-${currentRequest?.id ?? "draft"}`,
        sheetKey: "support_request_close",
        payload: {
          title: "Close request",
          description: isPendingConfirmation
            ? "If the issue is still not solved, the request will go back to the operator."
            : "Confirm that the issue is fully resolved before closing the request.",
          isPendingConfirmation,
          isLoading: isClosingRequest,
          primaryLabel: "Yes, everything is solved",
          secondaryLabel: "Not solved yet",
          pendingSecondaryLabel: "Not solved yet",
          loadingLabel: "Saving...",
        },
        options: {},
      };
    }

    if (activeSheetKey === "support_request_rate") {
      return {
        requestId: `support-rate-${currentRequest?.id ?? "draft"}`,
        sheetKey: "support_request_rate",
        payload: {
          title: "Rate service",
          description:
            "Share how the support experience went. A short comment is optional.",
          ratingLabel: "Your rating",
          ratingValue,
          comment: ratingComment,
          isSubmitting: isSubmittingRating,
          commentPlaceholder: "Comment (optional)",
          skipLabel: "Skip",
          submitLabel: "Save rating",
          loadingLabel: "Saving...",
        },
        options: {},
      };
    }

    return null;
  }, [
    activeSheetKey,
    currentRequest?.id,
    isClosingRequest,
    isPendingConfirmation,
    isSubmittingRating,
    ratingComment,
    ratingValue,
  ]);

  useEffect(() => {
    if (activeSheet) {
      setRenderedSheet(activeSheet);
    }
  }, [activeSheet]);

  const headerMetaText = useMemo(() => {
    if (isDraft) return "ID: —";
    if (requestNumber) {
      const normalized = String(requestNumber).startsWith("#")
        ? String(requestNumber).slice(1)
        : String(requestNumber);
      return `ID: ${String(normalized).padStart(6, "0")}`;
    }
    return `ID: ${String(requestId ?? "").padStart(6, "0")}`;
  }, [isDraft, requestId, requestNumber]);

  if (loading && !bootstrapData) {
    return (
      <View style={supportStyles.screen}>
        <SupportHeader
          title="Менеджер"
          metaText={headerMetaText}
          fallbackHref="/chat"
        />
        <View style={supportStyles.centerMessageWrap}>
          <Text style={supportStyles.centerMessage}>
            Loading support chat...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={supportStyles.screen}>
      <SupportHeader
        title={
          shouldShowTypePicker
            ? "\u041d\u043e\u0432\u044b\u0439 \u0437\u0430\u043f\u0440\u043e\u0441"
            : supportAgentProfile.name
        }
        metaText={shouldShowTypePicker ? "" : headerMetaText}
        fallbackHref="/chat"
        showAvatar={!shouldShowTypePicker}
        avatarUri={shouldShowTypePicker ? null : supportAgentProfile.avatarUri}
        avatarLabel={supportAgentProfile.avatarLabel}
        badgeLabel={headerBadgeLabel}
        hideBell={!shouldShowTypePicker}
      />

      <ScreenKeyboardContainer
        style={supportStyles.screenContent}
        {...screenKeyboardContainerProps}
      >
        {error && !bootstrapData ? (
          <View style={supportStyles.errorCard}>
            <Text style={supportStyles.errorText}>{error}</Text>
            <Pressable
              onPress={() =>
                void supportChatService
                  .refresh({ silent: false })
                  .catch(() => {})
              }
              style={supportStyles.retryInlineButton}
            >
              <Text style={supportStyles.retryInlineButtonText}>Retry</Text>
            </Pressable>
            {isSupportAuthError(error) ? (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/onboarding/phone",
                    params: { next: "/chat" },
                  })
                }
                style={supportStyles.retryInlineButton}
              >
                <Text style={supportStyles.retryInlineButtonText}>Log in</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {loading ? (
          <View style={supportStyles.centerMessageWrap}>
            <Text style={supportStyles.centerMessage}>Updating chat...</Text>
          </View>
        ) : null}

        {!isDraft && currentRequest?.active && !isPendingConfirmation ? (
          <Pressable
            onPress={() => handleOpenSheet("support_request_close")}
            style={supportStyles.actionCard}
          >
            <View style={supportStyles.actionCardTextWrap}>
              <Text style={supportStyles.actionCardTitle}>
                {
                  "\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u044c \u043e\u0431\u0440\u0430\u0449\u0435\u043d\u0438\u0435"
                }
              </Text>
            </View>
          </Pressable>
        ) : null}

        <ScrollView
          ref={scrollRef}
          style={supportStyles.messagesScroll}
          contentContainerStyle={[
            supportStyles.messagesScrollContent,
            shouldShowTypePicker
              ? supportStyles.problemPickerScrollContent
              : null,
          ]}
          onContentSizeChange={() => {
            if (!messages.length) return;
            scrollToBottom(false);
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={
            Platform.OS === "ios" ? "interactive" : "none"
          }
        >
          {shouldShowTypePicker ? (
            <View style={supportStyles.problemPickerSection}>
              <View style={supportStyles.problemHelpBubble}>
                <Text style={supportStyles.problemHelpText}>
                  {
                    "\u2639\uFE0F \u041d\u0435\u043f\u0440\u0438\u044f\u0442\u043d\u043e\u0441\u0442\u044c? \u041c\u044b \u0440\u044f\u0434\u043e\u043c, \u0447\u0442\u043e\u0431\u044b \u0432\u0441\u0451 \u0431\u044b\u0441\u0442\u0440\u043e \u0438\u0441\u043f\u0440\u0430\u0432\u0438\u0442\u044c!\n\u0421 \u0447\u0435\u043c \u0441\u0432\u044f\u0437\u0430\u043d\u0430 \u043f\u0440\u043e\u0431\u043b\u0435\u043c\u0430? \u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044e, \u0438 \u043c\u044b \u043f\u043e\u043c\u043e\u0436\u0435\u043c \u0440\u0430\u0437\u043e\u0431\u0440\u0430\u0442\u044c\u0441\u044f."
                  }
                </Text>
                <Text style={supportStyles.problemHelpTime}>11:27</Text>
              </View>
              <View style={supportStyles.problemGrid}>
                {problemTypes.map((problemType, index) => {
                  const tileStyle = getProblemTileStyle(problemType, index);
                  return (
                    <Pressable
                      key={problemType.id ?? index}
                      onPress={() => setSelectedProblemType(problemType)}
                      style={[
                        supportStyles.problemTile,
                        { backgroundColor: tileStyle.bg },
                      ]}
                    >
                      <Ionicons
                        name={tileStyle.icon}
                        size={22}
                        color={tileStyle.color}
                      />
                      <Text
                        style={[
                          supportStyles.problemTileText,
                          { color: tileStyle.color },
                        ]}
                      >
                        {getProblemTypeLabel(problemType)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {false ? (
                <>
                  <View style={supportStyles.problemHelpBubble}>
                    <Text style={supportStyles.problemHelpText}>
                      Неприятность? Мы рядом, чтобы всё быстро исправить!
                      Выберите категорию, и мы поможем разобраться.
                    </Text>
                  </View>
                  <View style={supportStyles.problemGrid}>
                    {problemTypes.map((problemType, index) => {
                      const tileStyle = TILE_STYLES[index % TILE_STYLES.length];
                      return (
                        <Pressable
                          key={problemType.id ?? index}
                          onPress={() => setSelectedProblemType(problemType)}
                          style={[
                            supportStyles.problemTile,
                            { backgroundColor: tileStyle.bg },
                          ]}
                        >
                          <Ionicons
                            name={tileStyle.icon}
                            size={20}
                            color={tileStyle.color}
                          />
                          <Text
                            style={[
                              supportStyles.problemTileText,
                              { color: tileStyle.color },
                            ]}
                          >
                            {getProblemTypeLabel(problemType)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}
            </View>
          ) : null}

          {selectedProblemType ? (
            <View style={supportStyles.selectedProblemPill}>
              <Text style={supportStyles.selectedProblemText}>
                Вы выбрали: {getProblemTypeLabel(selectedProblemType)}
              </Text>
            </View>
          ) : null}

          {messages.length > 0 ? (
            <View style={supportStyles.messagesDateWrap}>
              <Text style={supportStyles.messagesDateBadge}>Today</Text>
            </View>
          ) : null}

          <View style={supportStyles.messagesColumn}>
            {messages.map((message) => (
            <MessageBubble
              key={message.id}
              text={message.text}
              time={formatSupportTime(message.time)}
              isOwnMessage={message.from === "me"}
              sendStatus={message.sendStatus}
              deliveryStatus={message.deliveryStatus}
              onRetry={
                message.sendStatus === "failed"
                  ? () =>
                        void supportChatService.retryMessage({
                          requestId: currentRequest?.id ?? numericRequestId,
                          messageId: message.id,
                        })
                    : null
                }
              />
            ))}
          </View>

          {isPendingConfirmation ? (
            <View style={supportStyles.footerCard}>
              <Text style={supportStyles.footerCardTitle}>
                Resolved your issue?
              </Text>
              <Text style={supportStyles.footerCardText}>
                If yes, close the request. You will not be able to return to
                this chat later.
              </Text>
              <View style={supportStyles.doubleButtonRow}>
                <Pressable
                  disabled={isClosingRequest}
                  onPress={handleNotResolved}
                  style={[
                    supportStyles.outlineButton,
                    { flex: 1, backgroundColor: "#FFECE5", borderWidth: 0 },
                  ]}
                >
                  <Text
                    style={[
                      supportStyles.outlineButtonText,
                      { color: "#FFA182" },
                    ]}
                  >
                    Not yet
                  </Text>
                </Pressable>
                <Pressable
                  disabled={isClosingRequest}
                  onPress={handleConfirmResolved}
                  style={{ flex: 1 }}
                >
                  <LinearGradient
                    colors={["#FF946F", "#FF946F"]}
                    style={supportStyles.primaryButton}
                  >
                    <Text
                      style={[
                        supportStyles.primaryButtonText,
                        { color: "#FFFFFF" },
                      ]}
                    >
                      {isClosingRequest ? "Saving..." : "Yes, solved"}
                    </Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          ) : null}

          {isClosedRequest && canRateClosedRequest ? (
            <View style={supportStyles.footerCard}>
              <Pressable
                onPress={() => handleOpenSheet("support_request_rate")}
              >
                <View
                  style={[
                    supportStyles.outlineButton,
                    { backgroundColor: "#FFECE5", borderWidth: 0 },
                  ]}
                >
                  <Text
                    style={[
                      supportStyles.outlineButtonText,
                      { color: "#FF946F" },
                    ]}
                  >
                    Rate service
                  </Text>
                </View>
              </Pressable>
            </View>
          ) : null}

          {isClosedRequest && existingRating ? (
            <View style={supportStyles.footerCard}>
              <View
                style={{
                  borderRadius: 24,
                  backgroundColor: "#F8F8FA",
                  paddingHorizontal: 16,
                  paddingVertical: 16,
                }}
              >
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Ionicons
                      key={index}
                      name={index < existingRating ? "star" : "star-outline"}
                      size={18}
                      color={index < existingRating ? "#FF946F" : "#D9D9DE"}
                    />
                  ))}
                  <Text
                    style={{
                      color: supportColors.text,
                      fontSize: 13,
                      fontWeight: "600",
                    }}
                  >
                    {existingRating}/5
                  </Text>
                </View>
                {existingRatingComment ? (
                  <Text
                    style={{
                      marginTop: 12,
                      color: supportColors.muted,
                      fontSize: 15,
                      lineHeight: 20,
                    }}
                  >
                    {existingRatingComment}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}
        </ScrollView>

        {shouldShowTypePicker ? null : isPendingConfirmation ? null : isClosedRequest ? (
          isRateSheetOpen ? null : (
            <View
              style={[
                supportStyles.composerWrap,
                {
                  paddingBottom:
                    Platform.OS === "ios" ? Math.max(insets.bottom, 4) : 4,
                  marginBottom:
                    Platform.OS === "android"
                      ? androidKeyboardOffset > 0
                        ? androidKeyboardOffset + 28
                        : 0
                      : 0,
                },
              ]}
            >
              <Text style={supportStyles.disabledComposerText}>
                The chat is not active because the chat was closed
              </Text>
            </View>
          )
        ) : (
          <View
            style={[
              supportStyles.composerWrap,
              {
                paddingBottom:
                  Platform.OS === "ios" ? Math.max(insets.bottom, 4) : 4,
                marginBottom:
                  Platform.OS === "android"
                    ? androidKeyboardOffset > 0
                      ? androidKeyboardOffset + 28
                      : 0
                    : 0,
              },
            ]}
          >
            <View style={supportStyles.composerRow}>
              <Pressable
                disabled
                style={[
                  supportStyles.composerIconButton,
                  supportStyles.composerIconDisabled,
                ]}
              >
                <Ionicons name="attach-outline" size={24} color="#7A7A80" />
              </Pressable>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder={
                  isDraft ? "Describe your issue..." : "Type your message..."
                }
                placeholderTextColor="#7A7A80"
                multiline
                style={supportStyles.composerInput}
              />
              <Pressable
                disabled
                style={[
                  supportStyles.composerIconButton,
                  supportStyles.composerIconDisabled,
                ]}
              >
                <Ionicons name="happy-outline" size={24} color="#7A7A80" />
              </Pressable>
              <Pressable
                disabled={(isDraft && sending) || !input.trim()}
                onPress={handleSend}
                style={[
                  supportStyles.composerIconButton,
                  { opacity: (isDraft && sending) || !input.trim() ? 0.4 : 1 },
                ]}
              >
                <Ionicons
                  name={input.trim().length > 0 ? "send" : "mic-outline"}
                  size={24}
                  color="#7A7A80"
                />
              </Pressable>
            </View>
            {isDraft && sending ? (
              <Text style={supportStyles.composerHint}>Sending...</Text>
            ) : null}
          </View>
        )}
      </ScreenKeyboardContainer>

      <NativeBottomSheet
        mounted={isSheetMounted}
        visible={Boolean(activeSheetKey)}
        sheet={renderedSheet}
        onClose={handleCloseActiveSheet}
        onAction={(actionId, payload) => {
          if (actionId === "not_resolved") {
            void handleNotResolved();
            return;
          }
          if (actionId === "confirm_resolved") {
            void handleConfirmResolved();
            return;
          }
          if (actionId === "skip_rating") {
            handleCloseActiveSheet();
            if (returnToListAfterRating) {
              router.replace("/chat");
            }
            return;
          }
          if (actionId === "submit_rating") {
            setRatingValue(payload?.ratingValue ?? 5);
            setRatingComment(String(payload?.comment || ""));
            void supportChatService
              .rateRequest({
                requestId: currentRequest?.id,
                rating: payload?.ratingValue ?? 5,
                text: String(payload?.comment || "").trim() || null,
              })
              .then(() => {
                handleCloseActiveSheet();
                if (returnToListAfterRating) {
                  router.replace("/chat");
                }
              })
              .catch(() => {})
              .finally(() => {
                setIsSubmittingRating(false);
              });
            setIsSubmittingRating(true);
          }
        }}
      />
    </View>
  );
}
