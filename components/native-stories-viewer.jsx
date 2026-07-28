import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Image as ReactNativeImage,
  Linking,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { StatusBar } from "expo-status-bar";
import { openBrowserAsync } from "expo-web-browser";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

const STORY_DURATION_MS = 7000;
const LONG_PRESS_DELAY_MS = 220;
const TAP_MAX_DURATION_MS = 220;
const MOVE_CANCEL_PRESS_PX = 8;
const HORIZONTAL_SWIPE_THRESHOLD = 54;
const VERTICAL_CLOSE_THRESHOLD = 88;

function CloseIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path
        d="M12 4L4 12M4 4L12 12"
        stroke="#FFFFFF"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function clampIndex(index, length) {
  if (!length) return 0;
  const numericIndex = Number(index);
  if (!Number.isFinite(numericIndex)) return 0;
  return Math.min(Math.max(Math.trunc(numericIndex), 0), length - 1);
}

function normalizeUrl(url) {
  const trimmedUrl = String(url ?? "").trim();
  if (!trimmedUrl) return null;
  return /^https?:\/\//i.test(trimmedUrl)
    ? trimmedUrl
    : `https://${trimmedUrl}`;
}

function StoryProgressBar({
  count,
  activeIndex,
  progress,
  hidden = false,
  topInset = 0,
}) {
  return (
    <Animated.View
      style={[
        styles.progressRow,
        {
          top: topInset + 8,
          opacity: hidden ? 0 : 1,
        },
      ]}
      pointerEvents="none"
    >
      {Array.from({ length: count }).map((_, index) => {
        const fillStyle =
          index < activeIndex
            ? styles.progressSegmentFillDone
            : index === activeIndex
              ? { width: progress }
              : styles.progressSegmentFillPending;

        return (
          <View key={`story-progress-${index}`} style={styles.progressSegment}>
            {index < activeIndex ? (
              <View style={[styles.progressSegmentFill, fillStyle]} />
            ) : index === activeIndex ? (
              <Animated.View
                style={[styles.progressSegmentFill, fillStyle]}
              />
            ) : (
              <View style={[styles.progressSegmentFill, fillStyle]} />
            )}
          </View>
        );
      })}
    </Animated.View>
  );
}

export function NativeStoriesViewer({
  items = [],
  startIndex = 0,
  visible,
  onClose,
}) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const initialActiveIndex = useMemo(
    () => clampIndex(startIndex, items.length),
    [items.length, startIndex],
  );

  const normalizedItems = useMemo(
    () =>
      (Array.isArray(items) ? items : []).filter(
        (item) => item && typeof item === "object" && item.mediaUrl,
      ),
    [items],
  );

  const [activeIndex, setActiveIndex] = useState(initialActiveIndex);
  const [isProgressHidden, setIsProgressHidden] = useState(false);

  const loadedUrisRef = useRef(new Set());
  const pressTimerRef = useRef(null);
  const touchStartTimeRef = useRef(0);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const pausedProgressRef = useRef(0);
  const activeIndexRef = useRef(activeIndex);
  const isPausedRef = useRef(false);
  const isClosingRef = useRef(false);

  const progressValue = useRef(new Animated.Value(0)).current;

  const activeItem = normalizedItems[activeIndex] ?? null;
  const activeUri = activeItem?.mediaUrl ?? null;

  const progressWidth = useMemo(
    () =>
      progressValue.interpolate({
        inputRange: [0, 1],
        outputRange: ["0%", "100%"],
      }),
    [progressValue],
  );

  const clearPressTimer = useCallback(() => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  }, []);

  const stopProgress = useCallback(() => {
    progressValue.stopAnimation((value) => {
      pausedProgressRef.current = value;
    });
  }, [progressValue]);

  const resetProgress = useCallback(() => {
    pausedProgressRef.current = 0;
    progressValue.stopAnimation();
    progressValue.setValue(0);
  }, [progressValue]);

  const markLoaded = useCallback((uri) => {
    if (!uri || loadedUrisRef.current.has(uri)) return;
    loadedUrisRef.current.add(uri);
  }, []);

  const finishClose = useCallback(() => {
    clearPressTimer();
    stopProgress();
    resetProgress();
    isPausedRef.current = false;
    setIsProgressHidden(false);
    onClose?.();
  }, [clearPressTimer, onClose, resetProgress, stopProgress]);

  const close = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    isClosingRef.current = false;
    finishClose();
  }, [finishClose]);

  const startProgress = useCallback(
    (fromValue = 0) => {
      if (!visible || !activeUri) return;
      if (isClosingRef.current) return;
      progressValue.stopAnimation();
      progressValue.setValue(fromValue);
      Animated.timing(progressValue, {
        toValue: 1,
        duration: Math.max(1, STORY_DURATION_MS * (1 - fromValue)),
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (!finished) return;
        const nextIndex = activeIndexRef.current + 1;
        if (nextIndex >= normalizedItems.length) {
          close();
          return;
        }
        activeIndexRef.current = nextIndex;
        setActiveIndex(nextIndex);
      });
    },
    [activeUri, close, normalizedItems.length, progressValue, visible],
  );

  const pause = useCallback(() => {
    if (isPausedRef.current) return;
    isPausedRef.current = true;
    setIsProgressHidden(true);
    stopProgress();
  }, [stopProgress]);

  const resume = useCallback(() => {
    if (!isPausedRef.current) return;
    isPausedRef.current = false;
    setIsProgressHidden(false);
    startProgress(pausedProgressRef.current);
  }, [startProgress]);

  const goToIndex = useCallback(
    (nextIndex) => {
      if (isClosingRef.current) return;
      if (nextIndex < 0) return;
      if (nextIndex >= normalizedItems.length) {
        close();
        return;
      }
      if (nextIndex === activeIndexRef.current) return;
      setIsProgressHidden(true);
      stopProgress();
      isPausedRef.current = false;
      pausedProgressRef.current = 0;
      activeIndexRef.current = nextIndex;
      setActiveIndex(nextIndex);
      setIsProgressHidden(false);
    },
    [close, normalizedItems.length, stopProgress],
  );

  const goNext = useCallback(() => {
    goToIndex(activeIndexRef.current + 1);
  }, [goToIndex]);

  const goPrev = useCallback(() => {
    goToIndex(activeIndexRef.current - 1);
  }, [goToIndex]);

  const handleActionPress = useCallback(() => {
    const url = normalizeUrl(activeItem?.actionUrl);
    if (!url) return;
    pause();
    openBrowserAsync(url)
      .catch(() => Linking.openURL(url).catch(() => {}))
      .finally(() => {
        resume();
      });
  }, [activeItem?.actionUrl, pause, resume]);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    if (visible) return;
    const nextIndex = clampIndex(startIndex, normalizedItems.length);
    activeIndexRef.current = nextIndex;
    setActiveIndex(nextIndex);
    setIsProgressHidden(false);
    isPausedRef.current = false;
    pausedProgressRef.current = 0;
    resetProgress();
  }, [normalizedItems.length, resetProgress, startIndex, visible]);

  useEffect(() => {
    if (!visible) return;
    const nextIndex = clampIndex(startIndex, normalizedItems.length);
    activeIndexRef.current = nextIndex;
    setActiveIndex(nextIndex);
    setIsProgressHidden(false);
    isPausedRef.current = false;
  }, [normalizedItems.length, startIndex, visible]);

  useEffect(() => {
    if (!visible) return;
    const uris = normalizedItems
      .map((story) => story?.mediaUrl)
      .filter(Boolean);
    uris.forEach((uri) => {
      Promise.resolve(ReactNativeImage.prefetch(uri))
        .then(() => markLoaded(uri))
        .catch(() => {});
    });
  }, [markLoaded, normalizedItems, visible]);

  useEffect(() => {
    if (!visible || !activeUri) return;
    resetProgress();
    startProgress(0);
  }, [activeIndex, activeUri, resetProgress, startProgress, visible]);

  useEffect(
    () => () => {
      clearPressTimer();
      progressValue.stopAnimation();
    },
    [clearPressTimer, progressValue],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > MOVE_CANCEL_PRESS_PX ||
          Math.abs(gestureState.dy) > MOVE_CANCEL_PRESS_PX,
        onPanResponderGrant: (event) => {
          const { pageX, pageY } = event.nativeEvent;
          touchStartTimeRef.current = Date.now();
          touchStartXRef.current = pageX;
          touchStartYRef.current = pageY;
          clearPressTimer();
          pressTimerRef.current = setTimeout(() => {
            pause();
          }, LONG_PRESS_DELAY_MS);
        },
        onPanResponderMove: (_, gestureState) => {
          if (
            Math.abs(gestureState.dx) > MOVE_CANCEL_PRESS_PX ||
            Math.abs(gestureState.dy) > MOVE_CANCEL_PRESS_PX
          ) {
            clearPressTimer();
          }
        },
        onPanResponderRelease: (event, gestureState) => {
          clearPressTimer();

          const elapsed = Date.now() - touchStartTimeRef.current;
          const dx = gestureState.dx;
          const dy = gestureState.dy;
          const pageX = event.nativeEvent.pageX;

          if (isPausedRef.current) {
            resume();
            return;
          }

          if (
            dy > VERTICAL_CLOSE_THRESHOLD &&
            Math.abs(dx) < HORIZONTAL_SWIPE_THRESHOLD * 1.5
          ) {
            close();
            return;
          }

          if (
            Math.abs(dx) > HORIZONTAL_SWIPE_THRESHOLD &&
            Math.abs(dy) < VERTICAL_CLOSE_THRESHOLD
          ) {
            if (dx < 0) goNext();
            else goPrev();
            return;
          }

          if (
            elapsed <= TAP_MAX_DURATION_MS &&
            Math.abs(dx) < MOVE_CANCEL_PRESS_PX &&
            Math.abs(dy) < MOVE_CANCEL_PRESS_PX
          ) {
            if (pageX >= screenWidth / 2) goNext();
            else goPrev();
          }
        },
        onPanResponderTerminate: () => {
          clearPressTimer();
          if (isPausedRef.current) {
            resume();
          }
        },
      }),
    [clearPressTimer, close, goNext, goPrev, pause, resume, screenWidth],
  );

  if (!visible || !activeItem || !activeUri) return null;

  return (
    <Modal
      visible={visible}
      animationType="none"
      presentationStyle="overFullScreen"
      hardwareAccelerated
      transparent
      statusBarTranslucent
      onRequestClose={close}
    >
      <View style={styles.overlay}>
        <StatusBar style="light" translucent backgroundColor="transparent" />
        <View style={styles.safeArea}>
          <StoryProgressBar
            count={normalizedItems.length}
            activeIndex={activeIndex}
            progress={progressWidth}
            hidden={isProgressHidden}
            topInset={insets.top}
          />

          <Pressable
            style={[styles.closeButton, { top: insets.top + 22 }]}
            onPress={close}
          >
            <CloseIcon />
          </Pressable>

          <View style={styles.storyLayer}>
            <ExpoImage
              source={{ uri: activeUri }}
              placeholder={
                activeItem.previewUrl ? { uri: activeItem.previewUrl } : undefined
              }
              style={styles.storyImage}
              contentFit="cover"
              transition={0}
              cachePolicy="memory-disk"
              onLoad={() => markLoaded(activeUri)}
            />
            <View style={styles.imageShade} pointerEvents="none" />
            <View
              style={[
                styles.copyWrap,
                {
                  paddingTop: insets.top + 80,
                  paddingBottom: insets.bottom + (activeItem.action && activeItem.actionUrl ? 112 : 34),
                },
              ]}
              pointerEvents="box-none"
            >
              <View style={styles.copyBlock}>
                {activeItem.title ? (
                  <Text style={styles.title}>{activeItem.title}</Text>
                ) : null}
                {activeItem.subTitle ? (
                  <Text style={styles.subtitle}>{activeItem.subTitle}</Text>
                ) : null}
              </View>
            </View>
            {activeItem.action && activeItem.actionUrl ? (
              <View
                style={[
                  styles.actionWrap,
                  { paddingBottom: insets.bottom + 24 },
                ]}
              >
                <Pressable
                  style={styles.actionButton}
                  onPress={handleActionPress}
                >
                  <Text style={styles.actionText}>{activeItem.action}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          <View style={styles.touchLayer} {...panResponder.panHandlers} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
  },
  safeArea: {
    flex: 1,
    backgroundColor: "#000000",
  },
  progressRow: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 40,
    flexDirection: "row",
    gap: 4,
  },
  progressSegment: {
    flex: 1,
    height: 3,
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.24)",
  },
  progressSegmentFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
  },
  progressSegmentFillDone: {
    width: "100%",
  },
  progressSegmentFillPending: {
    width: "0%",
  },
  closeButton: {
    position: "absolute",
    left: 14,
    zIndex: 45,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(17,18,20,0.30)",
  },
  storyLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  storyImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#090909",
  },
  imageShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.08)",
  },
  copyWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  copyBlock: {
    marginTop: "auto",
    gap: 8,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "700",
  },
  subtitle: {
    color: "rgba(255,255,255,0.96)",
    fontSize: 15,
    lineHeight: 20,
  },
  actionWrap: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 0,
    zIndex: 45,
  },
  actionButton: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
  },
  actionText: {
    color: "#131314",
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "600",
  },
  touchLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
  },
});
