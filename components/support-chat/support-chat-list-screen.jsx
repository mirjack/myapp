import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  BackHandler,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useSegments } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import { NativeBottomSheet } from "@/components/native-bottom-sheet";
import { SupportHeader } from "@/components/support-chat/support-header";
import { SupportRequestRow } from "@/components/support-chat/support-request-row";
import { supportColors, supportStyles } from "@/components/support-chat/styles";
import {
  getRequestAgentProfile,
  getRequestSummary,
} from "@/components/support-chat/support-chat-view-model";
import {
  supportChatService,
  useSupportChatSnapshot,
} from "@/lib/support-chat-service";
import { sortSupportRequests } from "@/lib/support-chat-state";
import { setTabBarForcedHidden } from "@/lib/tab-bar-visibility";

function isSupportAuthError(errorMessage) {
  return String(errorMessage || "")
    .toLowerCase()
    .includes("customer access token");
}

export function SupportChatListScreen() {
  const router = useRouter();
  const segments = useSegments();
  const { t, i18n } = useTranslation();
  const { bootstrapData, error, loading } = useSupportChatSnapshot();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isSheetMounted, setIsSheetMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchActive, setIsSearchActive] = useState(false);
  const searchInputRef = useRef(null);
  const searchCancelAnim = useRef(new Animated.Value(0)).current;
  const searchClearAnim = useRef(new Animated.Value(0)).current;
  const sheetCloseTimerRef = useRef(null);
  const isProfileStackRoute =
    segments[0] === "(tabs)" && segments[1] === "profile";
  const chatListPath = isProfileStackRoute ? "/(tabs)/profile/chat" : "/chat";
  const chatDetailPath = isProfileStackRoute
    ? "/(tabs)/profile/chat/[id]"
    : "/chat/[id]";

  useFocusEffect(
    useCallback(() => {
      if (!isProfileStackRoute) return undefined;

      setTabBarForcedHidden(true);
      return () => setTabBarForcedHidden(false);
    }, [isProfileStackRoute]),
  );

  useEffect(() => {
    supportChatService.enterChatListView();

    if (supportChatService.hasBootstrapData()) {
      void supportChatService.ensureRealtimeSubscriptions().catch(() => {});
      if (!supportChatService.hasFreshBootstrap()) {
        void supportChatService.refresh({ silent: true }).catch(() => {});
      }
      return () => supportChatService.leaveChatListView();
    }
    void supportChatService.load().catch(() => {});
    return () => supportChatService.leaveChatListView();
  }, []);

  useEffect(() => {
    Animated.timing(searchCancelAnim, {
      toValue: isSearchActive ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [isSearchActive, searchCancelAnim]);

  useEffect(() => {
    Animated.timing(searchClearAnim, {
      toValue: searchTerm ? 1 : 0,
      duration: 140,
      useNativeDriver: true,
    }).start();
  }, [searchTerm, searchClearAnim]);

  useEffect(
    () => () => {
      if (sheetCloseTimerRef.current) {
        clearTimeout(sheetCloseTimerRef.current);
      }
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") return;
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        if (router.canGoBack()) {
          router.back();
          return true;
        }
        router.replace("/(tabs)/profile");
        return true;
      });
      return () => sub.remove();
    }, [router]),
  );

  const requests = useMemo(
    () => sortSupportRequests(bootstrapData?.chat?.requests || []),
    [bootstrapData?.chat?.requests],
  );
  const customerId = bootstrapData?.chat?.sender?.id ?? null;

  const filteredRequests = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) return requests;

    return requests.filter((request) => {
      const requestNumber = String(request?.requestNumber || "").toLowerCase();
      const agentProfile = getRequestAgentProfile(request, customerId, t);
      const summary = String(
        getRequestSummary(
          request,
          customerId,
          agentProfile.name,
          t,
          i18n.language,
        ),
      ).toLowerCase();
      return (
        requestNumber.includes(normalizedSearch) ||
        summary.includes(normalizedSearch)
      );
    });
  }, [customerId, i18n.language, requests, searchTerm, t]);

  const handleStartRequest = (requestKind) => {
    handleCloseSheet();

    if (bootstrapData?.activeRequestId) {
      router.push({
        pathname: chatDetailPath,
        params: { id: String(bootstrapData.activeRequestId) },
      });
      return;
    }

    router.push({
      pathname: chatDetailPath,
      params: {
        id: "new",
        requestKind,
        isDraft: "1",
      },
    });
  };

  const handleCloseSearch = () => {
    setIsSearchActive(false);
    setSearchTerm("");
    searchInputRef.current?.blur();
  };

  const handleOpenSheet = () => {
    if (sheetCloseTimerRef.current) {
      clearTimeout(sheetCloseTimerRef.current);
      sheetCloseTimerRef.current = null;
    }
    setIsSheetMounted(true);
    setIsSheetOpen(true);
  };

  const handleCloseSheet = () => {
    setIsSheetOpen(false);
    if (sheetCloseTimerRef.current) {
      clearTimeout(sheetCloseTimerRef.current);
    }
    sheetCloseTimerRef.current = setTimeout(() => {
      setIsSheetMounted(false);
      sheetCloseTimerRef.current = null;
    }, 320);
  };

  const searchCancelAnimatedStyle = {
    width: searchCancelAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 76],
    }),
    opacity: searchCancelAnim,
    transform: [
      {
        translateX: searchCancelAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [10, 0],
        }),
      },
    ],
  };

  const searchClearAnimatedStyle = {
    opacity: searchClearAnim,
    transform: [
      {
        scale: searchClearAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.85, 1],
        }),
      },
    ],
  };

  const supportCreateSheet = {
    requestId: "support-request-create",
    sheetKey: "support_request_create",
    payload: {
      title: t("support.createTitle"),
      description: t("support.createDescription"),
      problemTitle: t("support.problem"),
      questionTitle: t("support.question"),
    },
    options: {},
  };

  return (
    <View style={supportStyles.screen}>
      <SupportHeader
        title={t("support.chatsTitle")}
        metaText=""
        fallbackHref="/(tabs)/profile"
      />

      {loading && !bootstrapData ? (
        <View style={supportStyles.centerMessageWrap}>
          <Text style={supportStyles.centerMessage}>
            {t("support.loadingRequests")}
          </Text>
        </View>
      ) : (
        <>
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
                <Text style={supportStyles.retryInlineButtonText}>{t("support.retry")}</Text>
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

          <View style={supportStyles.searchRow}>
            <View style={supportStyles.searchWrap}>
              <Ionicons
                name="search-outline"
                size={18}
                color={supportColors.muted}
                style={supportStyles.searchIcon}
              />
              <TextInput
                ref={searchInputRef}
                value={searchTerm}
                onChangeText={setSearchTerm}
                onFocus={() => setIsSearchActive(true)}
                placeholder={t("support.searchPlaceholder")}
                placeholderTextColor={supportColors.muted}
                cursorColor="#131314"
                selectionColor="#131314"
                style={[
                  supportStyles.searchInput,
                  searchTerm ? supportStyles.searchInputWithClear : null,
                ]}
              />
              <Animated.View
                pointerEvents={searchTerm ? "auto" : "none"}
                style={[
                  supportStyles.searchClearButton,
                  searchClearAnimatedStyle,
                ]}
              >
                <Pressable onPress={() => setSearchTerm("")}>
                  <Ionicons
                    name="close-circle"
                    size={18}
                    color={supportColors.muted}
                  />
                </Pressable>
              </Animated.View>
            </View>

            <Animated.View
              pointerEvents={isSearchActive ? "auto" : "none"}
              style={[
                supportStyles.searchCancelWrap,
                searchCancelAnimatedStyle,
              ]}
            >
              <Pressable
                onPress={handleCloseSearch}
                style={supportStyles.searchCancelButton}
              >
                <Text numberOfLines={1} style={supportStyles.searchCancelText}>
                  {t("support.close")}
                </Text>
              </Pressable>
            </Animated.View>
          </View>

          {loading ? (
            <View style={supportStyles.centerMessageWrap}>
              <Text style={supportStyles.centerMessage}>{t("support.updatingChats")}</Text>
            </View>
          ) : null}

          <ScrollView contentInsetAdjustmentBehavior="automatic">
            {filteredRequests.length === 0 ? (
              <View style={supportStyles.centerMessageWrap}>
                <Text style={supportStyles.centerMessage}>{t("support.noRequests")}</Text>
              </View>
            ) : (
              filteredRequests.map((request) => {
                return (
                  <SupportRequestRow
                    key={request.id}
                    request={request}
                    customerId={customerId}
                    onPress={() =>
                      router.push({
                        pathname: chatDetailPath,
                        params: {
                          id: String(request.id),
                          requestKind: String(
                            request.requestType || "question",
                          ).toLowerCase(),
                          requestNumber: request.requestNumber || "",
                        },
                      })
                    }
                  />
                );
              })
            )}
          </ScrollView>
        </>
      )}

      <View style={supportStyles.primaryButtonWrap}>
        <Pressable onPress={handleOpenSheet}>
          <LinearGradient
            colors={["#FE946E", "#FE946E"]}
            style={supportStyles.primaryButton}
        >
            <Text style={supportStyles.primaryButtonText}>{t("support.createRequest")}</Text>
          </LinearGradient>
        </Pressable>
      </View>

      <NativeBottomSheet
        mounted={isSheetMounted}
        visible={isSheetOpen}
        sheet={supportCreateSheet}
        onClose={handleCloseSheet}
        onAction={(actionId) => {
          if (actionId === "problem" || actionId === "question") {
            handleStartRequest(actionId);
          }
        }}
      />
    </View>
  );
}
