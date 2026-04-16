import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  Linking,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { StatusBar } from "expo-status-bar";
import { openBrowserAsync } from "expo-web-browser";

const STORY_DURATION = 10000;
const SWIPE_THRESHOLD = 50;
const PRESS_DURATION = 300;
const OPEN_TRANSLATE_Y = 18;
const PROGRESS_COMPLETE_VALUE = 0.995;
const IMAGE_OPEN_SCALE = 1.075;
const IMAGE_OPEN_TRANSLATE_Y = 12;
const CONTENT_OPEN_TRANSLATE_Y = 18;
const BLUR_OPEN_RADIUS = 18;

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

const clampIndex = (index, length) => {
  if (!length) return 0;
  const numericIndex = Number(index);
  if (!Number.isFinite(numericIndex)) return 0;
  return Math.min(Math.max(Math.trunc(numericIndex), 0), length - 1);
};

const normalizeUrl = (url) => {
  const trimmedUrl = String(url ?? "").trim();
  if (!trimmedUrl) return null;
  return /^https?:\/\//i.test(trimmedUrl)
    ? trimmedUrl
    : `https://${trimmedUrl}`;
};

export function NativeStoriesViewer({
  items = [],
  startIndex = 0,
  visible,
  onClose,
}) {
  const normalizedItems = useMemo(
    () =>
      (Array.isArray(items) ? items : []).filter((item) => {
        return item && typeof item === "object" && item.mediaUrl;
      }),
    [items],
  );
  const [index, setIndex] = useState(() =>
    clampIndex(startIndex, normalizedItems.length),
  );
  const [incomingIndex, setIncomingIndex] = useState(null);
  const [isProgressVisible, setIsProgressVisible] = useState(true);

  const screenWidth = Dimensions.get("window").width;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const overlayScale = useRef(new Animated.Value(0.95)).current;
  const overlayTranslateY = useRef(
    new Animated.Value(OPEN_TRANSLATE_Y),
  ).current;
  const imageEntrance = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const currentX = useRef(new Animated.Value(0)).current;
  const incomingX = useRef(new Animated.Value(0)).current;
  const progressOpacity = useRef(new Animated.Value(1)).current;
  const pressTimerRef = useRef(null);
  const touchStartTimeRef = useRef(0);
  const pausedProgressRef = useRef(0);
  const isPausedRef = useRef(false);
  const isClosingRef = useRef(false);
  const isTransitioningRef = useRef(false);
  const isInitialOpenRef = useRef(false);
  const pendingInitialIndexRef = useRef(null);

  const item = normalizedItems[index];
  const incomingItem =
    incomingIndex === null ? null : normalizedItems[incomingIndex];
  const imageSource = useMemo(
    () => (item?.mediaUrl ? { uri: item.mediaUrl } : null),
    [item?.mediaUrl],
  );
  const incomingImageSource = useMemo(
    () => (incomingItem?.mediaUrl ? { uri: incomingItem.mediaUrl } : null),
    [incomingItem?.mediaUrl],
  );

  const resetProgress = useCallback(() => {
    progress.stopAnimation(() => {
      progress.setValue(0);
    });
    progress.setValue(0);
  }, [progress]);

  const clearPressTimer = useCallback(() => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  }, []);

  const close = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    clearPressTimer();
    resetProgress();
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 90,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(overlayScale, {
        toValue: 0.985,
        duration: 90,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(overlayTranslateY, {
        toValue: 0,
        duration: 90,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(imageEntrance, {
        toValue: 0,
        duration: 140,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      isClosingRef.current = false;
      onClose?.();
    });
  }, [
    clearPressTimer,
    onClose,
    overlayOpacity,
    overlayScale,
    overlayTranslateY,
    imageEntrance,
    resetProgress,
  ]);

  const animateToIndex = useCallback(
    (nextIndex, nextDirection) => {
      if (isTransitioningRef.current) return;
      if (nextIndex < 0) return;
      if (nextIndex >= normalizedItems.length) {
        close();
        return;
      }

      isTransitioningRef.current = true;
      resetProgress();
      setIsProgressVisible(true);
      setIncomingIndex(nextIndex);
      currentX.setValue(0);
      incomingX.setValue(nextDirection > 0 ? screenWidth : -screenWidth);

      Animated.parallel([
        Animated.spring(currentX, {
          toValue: nextDirection > 0 ? -screenWidth : screenWidth,
          stiffness: 300,
          damping: 35,
          mass: 1,
          useNativeDriver: true,
        }),
        Animated.spring(incomingX, {
          toValue: 0,
          stiffness: 300,
          damping: 35,
          mass: 1,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setIndex(nextIndex);
        setIncomingIndex(null);
        currentX.setValue(0);
        incomingX.setValue(0);
        isTransitioningRef.current = false;
      });
    },
    [
      close,
      currentX,
      incomingX,
      normalizedItems.length,
      resetProgress,
      screenWidth,
    ],
  );

  const next = useCallback(() => {
    if (index >= normalizedItems.length - 1) {
      close();
      return;
    }
    animateToIndex(index + 1, 1);
  }, [animateToIndex, close, index, normalizedItems.length]);

  const prev = useCallback(() => {
    if (index <= 0) return;
    animateToIndex(index - 1, -1);
  }, [animateToIndex, index]);

  const startProgress = useCallback(
    (fromValue = 0) => {
      if (isTransitioningRef.current || isClosingRef.current) return;
      progress.stopAnimation();
      progress.setValue(fromValue);
      Animated.timing(progress, {
        toValue: PROGRESS_COMPLETE_VALUE,
        duration: STORY_DURATION * (1 - fromValue),
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) next();
      });
    },
    [next, progress],
  );

  const pauseProgress = useCallback(() => {
    if (isPausedRef.current) return;
    isPausedRef.current = true;
    progress.stopAnimation((value) => {
      pausedProgressRef.current = value;
    });
    setIsProgressVisible(false);
  }, [progress]);

  const resumeProgress = useCallback(() => {
    if (!isPausedRef.current) return;
    isPausedRef.current = false;
    setIsProgressVisible(true);
    startProgress(pausedProgressRef.current);
  }, [startProgress]);

  useEffect(() => {
    if (!visible) return;
    isInitialOpenRef.current = true;
    pendingInitialIndexRef.current = clampIndex(
      startIndex,
      normalizedItems.length,
    );
    overlayOpacity.setValue(0);
    overlayScale.setValue(0.985);
    overlayTranslateY.setValue(OPEN_TRANSLATE_Y);
    imageEntrance.setValue(0);
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 130,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(overlayScale, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(overlayTranslateY, {
        toValue: 0,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(imageEntrance, {
        toValue: 1,
        duration: 760,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: true,
      }),
    ]).start();
  }, [
    normalizedItems.length,
    overlayOpacity,
    overlayScale,
    overlayTranslateY,
    imageEntrance,
    startIndex,
    visible,
  ]);

  const imageEntranceScale = useMemo(
    () =>
      imageEntrance.interpolate({
        inputRange: [0, 1],
        outputRange: [IMAGE_OPEN_SCALE, 1],
      }),
    [imageEntrance],
  );
  const imageEntranceTranslateY = useMemo(
    () =>
      imageEntrance.interpolate({
        inputRange: [0, 1],
        outputRange: [IMAGE_OPEN_TRANSLATE_Y, 0],
      }),
    [imageEntrance],
  );
  const contentEntranceStyle = useMemo(
    () => ({
      opacity: imageEntrance,
      transform: [
        {
          translateY: imageEntrance.interpolate({
            inputRange: [0, 1],
            outputRange: [CONTENT_OPEN_TRANSLATE_Y, 0],
          }),
        },
      ],
    }),
    [imageEntrance],
  );
  const blurLayerStyle = useMemo(
    () => ({
      opacity: imageEntrance.interpolate({
        inputRange: [0, 0.85, 1],
        outputRange: [0.62, 0.16, 0],
      }),
      transform: [
        {
          scale: imageEntrance.interpolate({
            inputRange: [0, 1],
            outputRange: [1.08, 1.02],
          }),
        },
      ],
    }),
    [imageEntrance],
  );

  useEffect(() => {
    if (!visible) return;
    const nextIndex = clampIndex(startIndex, normalizedItems.length);
    pendingInitialIndexRef.current = nextIndex;
    setIndex(nextIndex);
  }, [normalizedItems.length, startIndex, visible]);

  useEffect(() => {
    if (!visible || !item) return;

    setIsProgressVisible(true);
    isPausedRef.current = false;
    pausedProgressRef.current = 0;
    resetProgress();

    currentX.setValue(0);
    incomingX.setValue(0);
    setIncomingIndex(null);

    if (isInitialOpenRef.current) {
      isInitialOpenRef.current = false;
      pendingInitialIndexRef.current = null;
    }
    startProgress(0);
  }, [
    currentX,
    index,
    incomingX,
    item,
    progress,
    resetProgress,
    startProgress,
    visible,
  ]);

  useEffect(() => {
    if (!visible) return;
    normalizedItems.forEach((story) => {
      if (story?.mediaUrl) {
        Promise.resolve(Image.prefetch(story.mediaUrl)).catch(() => {});
      }
    });
  }, [normalizedItems, visible]);

  useEffect(() => {
    Animated.timing(progressOpacity, {
      toValue: isProgressVisible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [isProgressVisible, progressOpacity]);

  useEffect(
    () => () => {
      clearPressTimer();
      progress.stopAnimation();
    },
    [clearPressTimer, progress],
  );

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const handleActionPress = useCallback(() => {
    const url = normalizeUrl(item?.actionUrl);
    if (!url) return;
    openBrowserAsync(url).catch(() => {
      Linking.openURL(url).catch(() => {});
    });
  }, [item?.actionUrl]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          touchStartTimeRef.current = Date.now();
          clearPressTimer();
          pressTimerRef.current = setTimeout(pauseProgress, PRESS_DURATION);
        },
        onPanResponderRelease: (event, gestureState) => {
          clearPressTimer();
          if (isPausedRef.current) {
            resumeProgress();
            return;
          }

          const { dx, dy } = gestureState;
          const timeDelta = Date.now() - touchStartTimeRef.current;
          const pageX = event.nativeEvent.pageX;

          if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && timeDelta < 200) {
            if (pageX > screenWidth / 2) next();
            else prev();
            return;
          }

          if (
            Math.abs(dx) > SWIPE_THRESHOLD &&
            Math.abs(dy) < SWIPE_THRESHOLD * 1.5
          ) {
            if (dx < 0) next();
            else prev();
            return;
          }

          if (Math.abs(dy) > SWIPE_THRESHOLD * 1.5 && dy > SWIPE_THRESHOLD) {
            close();
          }
        },
        onPanResponderTerminate: () => {
          clearPressTimer();
          resumeProgress();
        },
      }),
    [
      clearPressTimer,
      close,
      next,
      pauseProgress,
      prev,
      resumeProgress,
      screenWidth,
    ],
  );

  if (!visible || !item || !imageSource) return null;

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
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: overlayOpacity,
            transform: [
              { translateY: overlayTranslateY },
              { scale: overlayScale },
            ],
          },
        ]}
      >
        <View style={styles.safeArea}>
          <StatusBar style="light" translucent backgroundColor="transparent" />
          <Animated.View
            style={[styles.progressTrack, { opacity: progressOpacity }]}
          >
            <Animated.View
              style={[styles.progressFill, { width: progressWidth }]}
            />
          </Animated.View>

          <Pressable style={styles.closeButton} onPress={close}>
            <CloseIcon />
          </Pressable>

          <Animated.View
            style={[
              styles.slide,
              {
                transform: [
                  { translateX: currentX },
                  { translateY: imageEntranceTranslateY },
                  { scale: imageEntranceScale },
                ],
              },
            ]}
          >
            <Animated.Image
              source={imageSource}
              style={[styles.image, styles.blurImage, blurLayerStyle]}
              resizeMode="cover"
              blurRadius={BLUR_OPEN_RADIUS}
              fadeDuration={0}
            />
            <Image
              source={imageSource}
              style={styles.image}
              resizeMode="cover"
              fadeDuration={0}
              onError={next}
            />

            <Animated.View style={[styles.copy, contentEntranceStyle]}>
              {item.title ? (
                <Text style={styles.title}>{item.title}</Text>
              ) : null}
              {item.subTitle ? (
                <Text style={styles.subtitle}>{item.subTitle}</Text>
              ) : null}
            </Animated.View>

            {item.action && item.actionUrl ? (
              <Animated.View
                style={[styles.actionButtonWrap, contentEntranceStyle]}
              >
                <Pressable
                  style={styles.actionButton}
                  onPress={handleActionPress}
                >
                  <Text style={styles.actionText}>{item.action}</Text>
                </Pressable>
              </Animated.View>
            ) : null}
          </Animated.View>

          {incomingItem && incomingImageSource ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.slide,
                {
                  transform: [
                    { translateX: incomingX },
                    { translateY: imageEntranceTranslateY },
                    { scale: imageEntranceScale },
                  ],
                },
              ]}
            >
              <Animated.Image
                source={incomingImageSource}
                style={[styles.image, styles.blurImage, blurLayerStyle]}
                resizeMode="cover"
                blurRadius={BLUR_OPEN_RADIUS}
                fadeDuration={0}
              />
              <Image
                source={incomingImageSource}
                style={styles.image}
                resizeMode="cover"
                fadeDuration={0}
              />
              <Animated.View style={[styles.copy, contentEntranceStyle]}>
                {incomingItem.title ? (
                  <Text style={styles.title}>{incomingItem.title}</Text>
                ) : null}
                {incomingItem.subTitle ? (
                  <Text style={styles.subtitle}>{incomingItem.subTitle}</Text>
                ) : null}
              </Animated.View>
              {incomingItem.action && incomingItem.actionUrl ? (
                <Animated.View
                  style={[styles.actionButtonWrap, contentEntranceStyle]}
                >
                  <View style={styles.actionButton}>
                    <Text style={styles.actionText}>{incomingItem.action}</Text>
                  </View>
                </Animated.View>
              ) : null}
            </Animated.View>
          ) : null}

          <View style={styles.touchLayer} {...panResponder.panHandlers} />
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    elevation: 100,
    backgroundColor: "#000",
  },
  safeArea: {
    flex: 1,
    backgroundColor: "#000",
  },
  progressTrack: {
    position: "absolute",
    top: 38,
    left: 24,
    right: 24,
    zIndex: 50,
    height: 4,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#fff",
  },
  closeButton: {
    position: "absolute",
    top: 60,
    left: 25,
    zIndex: 30,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  closeText: {
    color: "#fff",
    fontSize: 20,
    lineHeight: 22,
    fontWeight: "500",
  },
  slide: {
    ...StyleSheet.absoluteFillObject,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  blurImage: {
    ...StyleSheet.absoluteFillObject,
  },
  copy: {
    position: "absolute",
    left: 16,
    right: "12%",
    bottom: 95,
    gap: 8,
  },
  title: {
    color: "#fff",
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "600",
  },
  subtitle: {
    color: "#fff",
    fontSize: 14,
    lineHeight: 19,
  },
  actionButton: {
    position: "absolute",
    minHeight: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  actionButtonWrap: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 30,
    zIndex: 30,
  },
  actionText: {
    color: "#131314",
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "500",
  },
  touchLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
});
