import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { AddressDetailsForm } from "./address-details-form";
import { addressPalette, addressSharedStyles } from "./address-theme";

export function AddressBottomSheet({
  address,
  addressError,
  bottomOffset = 0,
  form,
  isExpanded,
  isReverseGeocoding,
  isSubmitting,
  onAddressPress,
  onChangeField,
  onLeadingPress,
  onPrimaryPress,
  onSubmit,
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const collapsedHeight = 236;
  const expandedHeight = Math.max(
    320,
    windowHeight - bottomOffset - insets.top - 18,
  );
  const animatedHeight = useRef(new Animated.Value(collapsedHeight)).current;
  const animationProgress = useRef(new Animated.Value(0)).current;
  const animatedBottomOffset = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(animatedHeight, {
        toValue: isExpanded ? expandedHeight : collapsedHeight,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(animationProgress, {
        toValue: isExpanded ? 1 : 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(animatedBottomOffset, {
        toValue: isExpanded ? bottomOffset : 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();
  }, [
    animatedBottomOffset,
    animatedHeight,
    animationProgress,
    bottomOffset,
    expandedHeight,
    isExpanded,
  ]);

  const collapsedOpacity = animationProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const collapsedTranslateY = animationProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -12],
  });
  const expandedOpacity = animationProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const expandedTranslateY = animationProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={10}
      style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}
    >
      <Animated.View
        style={[
          styles.sheet,
          !isExpanded && addressSharedStyles.shadow,
          isExpanded ? styles.sheetExpanded : null,
          {
            height: animatedHeight,
            transform: [
              { translateY: Animated.multiply(animatedBottomOffset, -1) },
            ],
          },
        ]}
      >
        <View style={styles.content}>
          {!isExpanded ? (
            <>
              <View style={styles.headerRow}>
                <Pressable
                  hitSlop={12}
                  onPress={onLeadingPress}
                  style={styles.leadingButton}
                >
                  <Ionicons
                    color={addressPalette.text}
                    name="chevron-back"
                    size={28}
                  />
                </Pressable>
                <Text numberOfLines={1} style={styles.title}>
                  {t("addresses.chooseDeliveryAddress")}
                </Text>
                <View style={styles.leadingSpacer} />
              </View>
            </>
          ) : null}
          <View style={styles.bodyStage}>
            <Animated.View
              pointerEvents={isExpanded ? "none" : "auto"}
              style={[
                styles.panel,
                {
                  opacity: collapsedOpacity,
                  transform: [{ translateY: collapsedTranslateY }],
                },
              ]}
            >
              <Text style={styles.label}>{t("addresses.fields.address")}</Text>
              <Pressable onPress={onAddressPress} style={styles.addressField}>
                <Text
                  numberOfLines={2}
                  style={[
                    styles.addressText,
                    !address && styles.addressPlaceholder,
                  ]}
                >
                  {isReverseGeocoding
                    ? t("addresses.lookingUpAddress")
                    : address || t("addresses.selectAddress")}
                </Text>
              </Pressable>
              {addressError ? (
                <Text style={styles.errorText}>{addressError}</Text>
              ) : null}
              <Pressable
                onPress={onPrimaryPress}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.primaryButtonPressed,
                ]}
              >
                <Text style={styles.primaryButtonText}>{t("addresses.continue")}</Text>
              </Pressable>
            </Animated.View>

            <Animated.View
              pointerEvents={isExpanded ? "auto" : "none"}
              style={[
                styles.panel,
                {
                  opacity: expandedOpacity,
                  transform: [{ translateY: expandedTranslateY }],
                },
              ]}
            >
              <AddressDetailsForm
                address={address}
                error={addressError}
                form={form}
                isSubmitting={isSubmitting}
                onAddressPress={onAddressPress}
                onChangeField={onChangeField}
                onSubmit={onSubmit}
              />
            </Animated.View>
          </View>
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -15,
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
  },
  sheetExpanded: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingTop: 0,
  },

  content: {
    paddingHorizontal: 18,
    paddingBottom: 28,
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  bodyStage: {
    flex: 1,
    position: "relative",
  },
  panel: {
    ...StyleSheet.absoluteFillObject,
  },
  leadingButton: {
    width: 32,
    height: 32,
    justifyContent: "center",
  },
  leadingSpacer: {
    width: 32,
  },
  title: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    color: addressPalette.text,
    textAlign: "center",
  },
  label: {
    marginBottom: 8,
    fontSize: 13,
    fontWeight: "500",
    color: addressPalette.text,
  },
  addressField: {
    height: 64,
    borderRadius: 16,
    backgroundColor: addressPalette.mutedSurface,
    paddingHorizontal: 14,
    paddingVertical: 0,
    justifyContent: "center",
  },
  addressText: {
    fontSize: 14,
    lineHeight: 19,
    color: addressPalette.text,
    minHeight: 38,
  },
  addressPlaceholder: {
    color: addressPalette.secondaryText,
  },
  errorText: {
    marginTop: 8,
    fontSize: 12,
    color: addressPalette.danger,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: addressPalette.brand,
    marginTop: 11,
  },
  primaryButtonPressed: {
    transform: [{ scale: 0.99 }],
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});
