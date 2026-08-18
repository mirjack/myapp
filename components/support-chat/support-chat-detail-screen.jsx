import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { EmojiKeyboard } from "rn-emoji-keyboard";
import {
  ActivityIndicator,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter, useSegments } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { NativeBottomSheet } from "@/components/native-bottom-sheet";
import { SupportHeader } from "@/components/support-chat/support-header";
import { supportColors, supportStyles } from "@/components/support-chat/styles";
import {
  getLocalizedProblemTypeLabel,
  getRequestAgentProfile,
  getSupportCategoryKey,
} from "@/components/support-chat/support-chat-view-model";
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

function getProblemTypeLabel(problemType, t, language) {
  return getLocalizedProblemTypeLabel(problemType, t, language);
}

function getProblemTileStyle(problemType, index, t, language) {
  const category = getSupportCategoryKey(
    getProblemTypeLabel(problemType, t, language),
  );

  if (category === "product") return TILE_STYLES[0];
  if (category === "delivery") return TILE_STYLES[1];
  if (category === "service") return TILE_STYLES[2];
  if (category === "other") return TILE_STYLES[3];

  return TILE_STYLES[index % TILE_STYLES.length];
}

function getRequestBadgeLabel(request, requestType, t, language) {
  const problemLabel = request?.problemType
    ? getProblemTypeLabel(request.problemType, t, language)
    : "";

  if (problemLabel) {
    return problemLabel;
  }

  return String(requestType || "")
    .trim()
    .toUpperCase() === "PROBLEM"
    ? t("support.problem")
    : t("support.question");
}

function MessageBubble({
  text,
  time,
  isOwnMessage,
  sendStatus,
  deliveryStatus,
  onRetry,
  retryLabel,
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
              color="#FE946E"
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
          <Text style={supportStyles.messageRetryText}>{retryLabel}</Text>
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
  const segments = useSegments();
  const { t, i18n } = useTranslation();
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
  const [isEmojiPanelOpen, setIsEmojiPanelOpen] = useState(false);
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
  const isProfileStackRoute =
    segments[0] === "(tabs)" && segments[1] === "profile";
  const chatListPath = isProfileStackRoute ? "/(tabs)/profile/chat" : "/chat";
  const chatDetailPath = isProfileStackRoute
    ? "/(tabs)/profile/chat/[id]"
    : "/chat/[id]";

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
            pathname: chatDetailPath,
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
  }, [chatDetailPath, isDraft, router]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") return;
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        if (router.canGoBack()) {
          router.back();
          return true;
        }
        router.replace(chatListPath);
        return true;
      });
      return () => sub.remove();
    }, [chatListPath, router]),
  );

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
    () => getRequestAgentProfile(currentRequest, customerId, t),
    [currentRequest, customerId, t],
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
            t,
            i18n.language,
          )
        : "",
    [currentRequest, i18n.language, normalizedRequestType, shouldShowTypePicker, t],
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
        setIsEmojiPanelOpen(false);
        router.replace({
          pathname: chatDetailPath,
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
      setIsEmojiPanelOpen(false);
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

  const handleAddEmoji = (emoji) => {
    const value = typeof emoji === "string" ? emoji : emoji?.emoji;
    if (!value) return;
    setInput((current) => `${current}${value}`);
  };

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

      router.replace(chatListPath);
    } catch {
      // state error is already owned by the shared service
    } finally {
      setIsClosingRequest(false);
    }
  }, [
    currentRequest?.id,
    chatListPath,
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

  const activeSheet = useMemo(() => {
    if (activeSheetKey === "support_request_close") {
      return {
        requestId: `support-close-${currentRequest?.id ?? "draft"}`,
        sheetKey: "support_request_close",
        payload: {
          title: t("support.closeRequest"),
          description: isPendingConfirmation
            ? t("support.closeRequestPendingDescription")
            : t("support.closeRequestDescription"),
          isPendingConfirmation,
          isLoading: isClosingRequest,
          primaryLabel: t("support.yesSolved"),
          secondaryLabel: t("support.notSolvedYet"),
          pendingSecondaryLabel: t("support.notSolvedYet"),
          loadingLabel: t("support.saving"),
        },
        options: {},
      };
    }

    if (activeSheetKey === "support_request_rate") {
      return {
        requestId: `support-rate-${currentRequest?.id ?? "draft"}`,
        sheetKey: "support_request_rate",
        payload: {
          title: t("support.rateService"),
          description: t("support.rateDescription"),
          ratingLabel: t("support.yourRating"),
          ratingValue,
          comment: ratingComment,
          isSubmitting: isSubmittingRating,
          commentPlaceholder: t("support.commentOptional"),
          skipLabel: t("support.skip"),
          submitLabel: t("support.saveRating"),
          loadingLabel: t("support.saving"),
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
    t,
  ]);

  useEffect(() => {
    if (activeSheet) {
      setRenderedSheet(activeSheet);
    }
  }, [activeSheet]);

  const headerMetaText = useMemo(() => {
    if (isDraft) return t("support.idEmpty");
    if (requestNumber) {
      const normalized = String(requestNumber).startsWith("#")
        ? String(requestNumber).slice(1)
        : String(requestNumber);
      return `${t("support.idLabel")} ${String(normalized).padStart(6, "0")}`;
    }
    return `${t("support.idLabel")} ${String(requestId ?? "").padStart(6, "0")}`;
  }, [isDraft, requestId, requestNumber, t]);

  if (loading && !bootstrapData) {
    return (
      <View style={supportStyles.screen}>
        <SupportHeader
          title={t("support.managerTitle")}
          metaText={headerMetaText}
          fallbackHref={chatListPath}
        />
        <View style={supportStyles.centerMessageWrap}>
          <Text style={supportStyles.centerMessage}>
            {t("support.loadingChat")}
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
            ? t("support.newRequest")
            : supportAgentProfile.name
        }
        metaText={shouldShowTypePicker ? "" : headerMetaText}
        fallbackHref={chatListPath}
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
              <Text style={supportStyles.retryInlineButtonText}>
                {t("support.retry")}
              </Text>
            </Pressable>
            {isSupportAuthError(error) ? (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/onboarding/phone",
                    params: { next: chatListPath },
                  })
                }
                style={supportStyles.retryInlineButton}
              >
                <Text style={supportStyles.retryInlineButtonText}>
                  {t("support.logIn")}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {loading ? (
          <View style={supportStyles.centerMessageWrap}>
            <Text style={supportStyles.centerMessage}>
              {t("support.updatingChat")}
            </Text>
          </View>
        ) : null}

        {!isDraft && currentRequest?.active && !isPendingConfirmation ? (
          <Pressable
            onPress={() => handleOpenSheet("support_request_close")}
            style={supportStyles.actionCard}
          >
            <View style={supportStyles.actionCardTextWrap}>
              <Text style={supportStyles.actionCardTitle}>
                {t("support.finishRequest")}
              </Text>
            </View>
          </Pressable>
        ) : null}

        {isPendingConfirmation ? (
          <View style={supportStyles.confirmationBanner}>
            <View style={supportStyles.confirmationTextWrap}>
              <Text style={supportStyles.confirmationTitle}>
                {t("support.resolvedQuestion")}
              </Text>
              <Text style={supportStyles.confirmationText}>
                {t("support.closeRequestPendingDescription")}
              </Text>
            </View>
            <View style={supportStyles.confirmationActions}>
              <Pressable
                disabled={isClosingRequest}
                onPress={handleNotResolved}
                style={[
                  supportStyles.confirmationSecondaryButton,
                  isClosingRequest ? supportStyles.confirmationButtonDisabled : null,
                ]}
              >
                <Text style={supportStyles.confirmationSecondaryText}>
                  {t("support.notYet")}
                </Text>
              </Pressable>
              <Pressable
                disabled={isClosingRequest}
                onPress={handleConfirmResolved}
                style={[
                  supportStyles.confirmationPrimaryButton,
                  isClosingRequest ? supportStyles.confirmationButtonDisabled : null,
                ]}
              >
                <Text style={supportStyles.confirmationPrimaryText}>
                  {isClosingRequest
                    ? t("support.saving")
                    : t("support.yesSolvedShort")}
                </Text>
              </Pressable>
            </View>
          </View>
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
                  {t("support.problemHelp")}
                </Text>
                <Text style={supportStyles.problemHelpTime}>
                  {t("support.nowLabel")}
                </Text>
              </View>
              <View style={supportStyles.problemGrid}>
                {problemTypes.map((problemType, index) => {
                  const tileStyle = getProblemTileStyle(
                    problemType,
                    index,
                    t,
                    i18n.language,
                  );
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
                        {getProblemTypeLabel(problemType, t, i18n.language)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {selectedProblemType ? (
            <View style={supportStyles.selectedProblemPill}>
              <Text style={supportStyles.selectedProblemText}>
                {t("support.selectedProblem")}{" "}
                {getProblemTypeLabel(selectedProblemType, t, i18n.language)}
              </Text>
            </View>
          ) : null}

          {messages.length > 0 ? (
            <View style={supportStyles.messagesDateWrap}>
              <Text style={supportStyles.messagesDateBadge}>
                {t("support.today")}
              </Text>
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
                retryLabel={t("support.retry")}
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
                    {t("support.rateService")}
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
                {t("support.chatClosed")}
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
            {Platform.OS === "android" && isEmojiPanelOpen ? (
              <View style={supportStyles.inlineEmojiKeyboard}>
                <EmojiKeyboard
                  onEmojiSelected={handleAddEmoji}
                  defaultHeight={280}
                  enableSearchBar
                  categoryPosition="bottom"
                  styles={{
                    container: {
                      borderRadius: 0,
                      elevation: 0,
                      shadowOpacity: 0,
                    },
                    searchBar: {
                      container: {
                        marginTop: 10,
                      },
                    },
                  }}
                  theme={{
                    container: "#FFFFFF",
                    header: supportColors.text,
                    category: {
                      icon: "#7A7A80",
                      iconActive: supportColors.orange,
                      container: "#FFFFFF",
                      containerActive: "#FFF0E8",
                    },
                    search: {
                      background: supportColors.pillBg,
                      text: supportColors.text,
                      placeholder: supportColors.muted,
                      icon: supportColors.muted,
                    },
                  }}
                />
              </View>
            ) : null}
            <View style={supportStyles.composerRow}>
              {Platform.OS === "android" ? (
                <Pressable
                  onPress={() => setIsEmojiPanelOpen((current) => !current)}
                  style={supportStyles.composerIconButton}
                >
                  <Ionicons
                    name={isEmojiPanelOpen ? "happy" : "happy-outline"}
                    size={24}
                    color={isEmojiPanelOpen ? "#FE946E" : "#7A7A80"}
                  />
                </Pressable>
              ) : null}
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder={
                  isDraft
                    ? t("support.describeIssue")
                    : t("support.typeMessage")
                }
                placeholderTextColor="#7A7A80"
                multiline
                style={supportStyles.composerInput}
              />
              <Pressable
                disabled={(isDraft && sending) || !input.trim()}
                onPress={handleSend}
                style={[
                  supportStyles.composerIconButton,
                  { opacity: (isDraft && sending) || !input.trim() ? 0.4 : 1 },
                ]}
              >
                <Ionicons
                  name="send"
                  size={24}
                  color={input.trim().length > 0 ? "#FE946E" : "#7A7A80"}
                />
              </Pressable>
            </View>
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
              router.replace(chatListPath);
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
                  router.replace(chatListPath);
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
