import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";

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

function isSupportAuthError(errorMessage) {
  return String(errorMessage || "")
    .toLowerCase()
    .includes("customer access token");
}

export function SupportChatListScreen() {
  const router = useRouter();
  const { bootstrapData, error, loading } = useSupportChatSnapshot();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isSheetMounted, setIsSheetMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchActive, setIsSearchActive] = useState(false);
  const searchInputRef = useRef(null);
  const searchCancelAnim = useRef(new Animated.Value(0)).current;
  const searchClearAnim = useRef(new Animated.Value(0)).current;
  const sheetCloseTimerRef = useRef(null);

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
      const agentProfile = getRequestAgentProfile(request, customerId);
      const summary = String(
        getRequestSummary(request, customerId, agentProfile.name),
      ).toLowerCase();
      return (
        requestNumber.includes(normalizedSearch) ||
        summary.includes(normalizedSearch)
      );
    });
  }, [customerId, requests, searchTerm]);

  const handleStartRequest = (requestKind) => {
    handleCloseSheet();

    if (bootstrapData?.activeRequestId) {
      router.push({
        pathname: "/chat/[id]",
        params: { id: String(bootstrapData.activeRequestId) },
      });
      return;
    }

    router.push({
      pathname: "/chat/[id]",
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
      title:
        "\u041c\u044b \u0440\u044f\u0434\u043e\u043c \u0438 \u0433\u043e\u0442\u043e\u0432\u044b \u043f\u043e\u043c\u043e\u0447\u044c",
      description:
        "\u041f\u043e\u0434\u0441\u043a\u0430\u0436\u0438\u0442\u0435, \u043f\u043e\u0436\u0430\u043b\u0443\u0439\u0441\u0442\u0430, \u0443 \u0432\u0430\u0441 \u0432\u043e\u043f\u0440\u043e\u0441 \u0438\u043b\u0438 \u0432\u043e\u0437\u043d\u0438\u043a\u043b\u0430 \u043f\u0440\u043e\u0431\u043b\u0435\u043c\u0430?",
      problemTitle: "\u041f\u0440\u043e\u0431\u043b\u0435\u043c\u0430",
      questionTitle: "\u0412\u043e\u043f\u0440\u043e\u0441",
    },
    options: {},
  };

  return (
    <View style={supportStyles.screen}>
      <SupportHeader
        title={"\u0427\u0430\u0442\u044b"}
        metaText=""
        fallbackHref="/(tabs)/profile"
      />

      {loading && !bootstrapData ? (
        <View style={supportStyles.centerMessageWrap}>
          <Text style={supportStyles.centerMessage}>
            Loading support requests...
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
                  <Text style={supportStyles.retryInlineButtonText}>
                    Log in
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
                placeholder="Search by"
                placeholderTextColor={supportColors.muted}
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
                  {"\u0417\u0430\u043a\u0440\u044b\u0442\u044c"}
                </Text>
              </Pressable>
            </Animated.View>
          </View>

          {loading ? (
            <View style={supportStyles.centerMessageWrap}>
              <Text style={supportStyles.centerMessage}>Updating chats...</Text>
            </View>
          ) : null}

          <ScrollView contentInsetAdjustmentBehavior="automatic">
            {filteredRequests.length === 0 ? (
              <View style={supportStyles.centerMessageWrap}>
                <Text style={supportStyles.centerMessage}>No requests yet</Text>
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
                        pathname: "/chat/[id]",
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
            <Text style={supportStyles.primaryButtonText}>Create request</Text>
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
