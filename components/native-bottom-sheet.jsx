import { useCallback, useEffect, useMemo, useRef } from "react";
import { KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { BlurView } from "expo-blur";
import Animated, {
  Easing,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { ProductSheetSkeleton, renderSheetContent } from "@/components/native-bottom-sheet-content";
import {
  SHEET_CLOSED_SCALE,
  SHEET_CLOSED_Y,
  SHEET_DISMISS_DRAG_Y,
  SHEET_DISMISS_VELOCITY_Y,
  WINDOW_SIZE,
} from "@/components/native-bottom-sheet.shared";
import { styles } from "@/components/native-bottom-sheet.styles";

const SHEET_OPEN_MS = 320;
const SHEET_CLOSE_MS = 280;
const SHEET_DRAG_CLOSE_MS = 500;
const SHEET_CONTENT_FADE_MS = 220;
const SHEET_OPEN_EASING = Easing.bezier(0.22, 1, 0.36, 1);
const SHEET_CONTENT_EASING = Easing.bezier(0.2, 0, 0, 1);
const SHEET_CLOSE_EASING = Easing.bezier(0.32, 0, 0.67, 0);
const SHEET_DRAG_CLOSE_EASING = Easing.out(Easing.cubic);

export function NativeBottomSheet({
  mounted,
  visible,
  sheet,
  onClose,
  onAction,
}) {
  const isDragClosingRef = useRef(false);
  const productSheetResizeTransition = useMemo(
    () => LinearTransition.duration(220).easing(Easing.out(Easing.cubic)),
    [],
  );
  const sheetTranslateY = useSharedValue(SHEET_CLOSED_Y);
  const sheetScaleX = useSharedValue(SHEET_CLOSED_SCALE);
  const sheetOpacity = useSharedValue(0);
  const contentOpacity = useSharedValue(1);
  const skeletonOpacity = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);
  const isProductDetailSheet = sheet?.sheetKey === "product_detail";
  const isProductSheetHydrating = Boolean(
    isProductDetailSheet &&
      (sheet?.payload?.isLoading && !sheet?.payload?.product),
  );
  const shouldShowProductSkeleton = isProductDetailSheet && isProductSheetHydrating;

  useEffect(() => {
    if (visible) {
      isDragClosingRef.current = false;
      contentOpacity.value = shouldShowProductSkeleton ? 0 : 1;
      skeletonOpacity.value = shouldShowProductSkeleton ? 1 : 0;
      sheetScaleX.value = SHEET_CLOSED_SCALE;
      sheetTranslateY.value = SHEET_CLOSED_Y;
      sheetOpacity.value = 1;
      backdropOpacity.value = withTiming(1, {
        duration: SHEET_OPEN_MS,
        easing: SHEET_OPEN_EASING,
      });
      sheetTranslateY.value = withTiming(0, {
        duration: SHEET_OPEN_MS,
        easing: SHEET_OPEN_EASING,
      });
      sheetScaleX.value = withTiming(1, {
        duration: SHEET_OPEN_MS,
        easing: SHEET_OPEN_EASING,
      });
      return;
    }
    if (isDragClosingRef.current) {
      contentOpacity.value = 1;
      skeletonOpacity.value = 0;
      return;
    }
    contentOpacity.value = 1;
    skeletonOpacity.value = 0;
    backdropOpacity.value = withTiming(0, {
      duration: 180,
      easing: SHEET_CLOSE_EASING,
    });
    sheetOpacity.value = withTiming(0.98, {
      duration: SHEET_CLOSE_MS,
      easing: SHEET_CLOSE_EASING,
    });
    sheetTranslateY.value = withTiming(SHEET_CLOSED_Y, {
      duration: SHEET_CLOSE_MS,
      easing: SHEET_CLOSE_EASING,
    });
    sheetScaleX.value = withTiming(SHEET_CLOSED_SCALE, {
      duration: SHEET_CLOSE_MS,
      easing: SHEET_CLOSE_EASING,
    });
  }, [
    backdropOpacity,
    contentOpacity,
    isProductDetailSheet,
    skeletonOpacity,
    sheetOpacity,
    sheetScaleX,
    sheetTranslateY,
    visible,
    shouldShowProductSkeleton,
  ]);

  useEffect(() => {
    if (!visible || !isProductDetailSheet) return;
    if (shouldShowProductSkeleton) {
      contentOpacity.value = withTiming(0, {
        duration: 90,
        easing: SHEET_CONTENT_EASING,
      });
      skeletonOpacity.value = withTiming(1, {
        duration: 90,
        easing: SHEET_CONTENT_EASING,
      });
      return;
    }

    contentOpacity.value = withTiming(1, {
      duration: SHEET_CONTENT_FADE_MS,
      easing: SHEET_CONTENT_EASING,
    });
    skeletonOpacity.value = withTiming(0, {
      duration: SHEET_CONTENT_FADE_MS,
      easing: SHEET_CONTENT_EASING,
    });
  }, [
    contentOpacity,
    isProductDetailSheet,
    shouldShowProductSkeleton,
    skeletonOpacity,
    visible,
  ]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: sheetOpacity.value,
    transform: [
      { translateY: sheetTranslateY.value },
      { scaleX: sheetScaleX.value },
    ],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  const skeletonStyle = useAnimatedStyle(() => ({
    opacity: skeletonOpacity.value,
  }));

  const dismissSheetFromDrag = useCallback(() => {
    isDragClosingRef.current = true;
    backdropOpacity.value = withTiming(0, {
      duration: 140,
      easing: SHEET_DRAG_CLOSE_EASING,
    });
    sheetOpacity.value = withTiming(0.98, {
      duration: SHEET_DRAG_CLOSE_MS,
      easing: SHEET_DRAG_CLOSE_EASING,
    });
    sheetTranslateY.value = withTiming(SHEET_CLOSED_Y, {
      duration: SHEET_DRAG_CLOSE_MS,
      easing: SHEET_DRAG_CLOSE_EASING,
    });
    sheetScaleX.value = withTiming(SHEET_CLOSED_SCALE, {
      duration: SHEET_DRAG_CLOSE_MS,
      easing: SHEET_DRAG_CLOSE_EASING,
    });
    onClose?.();
  }, [backdropOpacity, onClose, sheetOpacity, sheetScaleX, sheetTranslateY]);

  const dragPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          gestureState.dy > 2 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
        onMoveShouldSetPanResponderCapture: (_, gestureState) =>
          gestureState.dy > 2 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, gestureState) => {
          const nextTranslateY = Math.max(0, gestureState.dy);
          sheetTranslateY.value = nextTranslateY;
          backdropOpacity.value = Math.max(
            0.35,
            1 - nextTranslateY / (WINDOW_SIZE.height * 0.7),
          );
        },
        onPanResponderRelease: (_, gestureState) => {
          if (
            gestureState.dy > SHEET_DISMISS_DRAG_Y ||
            gestureState.vy > SHEET_DISMISS_VELOCITY_Y
          ) {
            dismissSheetFromDrag();
            return;
          }
          sheetTranslateY.value = withTiming(0, {
            duration: 220,
            easing: SHEET_OPEN_EASING,
          });
          backdropOpacity.value = withTiming(1, {
            duration: 220,
            easing: SHEET_OPEN_EASING,
          });
        },
        onPanResponderTerminate: () => {
          sheetTranslateY.value = withTiming(0, {
            duration: 220,
            easing: SHEET_OPEN_EASING,
          });
          backdropOpacity.value = withTiming(1, {
            duration: 220,
            easing: SHEET_OPEN_EASING,
          });
        },
      }),
    [backdropOpacity, dismissSheetFromDrag, sheetTranslateY],
  );

  return (
    <Modal
      visible={mounted}
    transparent
    animationType="none"
    hardwareAccelerated
    statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalRoot}
        behavior={Platform.OS === "ios" ? "padding" : "position"}
        contentContainerStyle={styles.modalKeyboardContent}
        keyboardVerticalOffset={0}
      >
        <Pressable style={styles.backdropTap} onPress={onClose}>
          <Animated.View
            style={[styles.backdrop, backdropStyle]}
            renderToHardwareTextureAndroid
            shouldRasterizeIOS
          >
            <BlurView
              intensity={20}
              tint="light"
              experimentalBlurMethod="dimezisBlurView"
              style={styles.backdropBlur}
            />
            <Animated.View style={styles.backdropTint} />
          </Animated.View>
        </Pressable>

        <Animated.View
          layout={
            isProductDetailSheet &&
            !shouldShowProductSkeleton
              ? productSheetResizeTransition
              : undefined
          }
          style={[
            styles.sheetWrap,
            isProductDetailSheet ? styles.sheetWrapProduct : null,
            sheetStyle,
          ]}
          renderToHardwareTextureAndroid
          shouldRasterizeIOS
          {...dragPanResponder.panHandlers}
        >
          {sheet?.options?.hideClose ? null : (
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={16} color="#fff" />
            </Pressable>
          )}
          <Animated.View style={styles.sheetContentStack}>
            <Animated.View style={contentStyle}>
              {renderSheetContent(sheet, onAction)}
            </Animated.View>
            {shouldShowProductSkeleton ? (
              <Animated.View
                pointerEvents="none"
                style={[styles.sheetSkeletonOverlay, skeletonStyle]}
              >
                <ProductSheetSkeleton />
              </Animated.View>
            ) : null}
          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
