import { memo, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";

function NativePageHeaderComponent({
  title,
  isLoggedIn = false,
  walletBalance = 0,
  onLoginPress,
  backgroundColor = "#FFFFFF",
  borderRadius = 24,
}) {
  const formattedBalance = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 0,
      })
        .format(Math.trunc(Number(walletBalance || 0)))
        .replace(/,/g, " "),
    [walletBalance],
  );

  const rightContent = isLoggedIn ? (
    <Pressable onPress={onLoginPress}>
      <LinearGradient
        colors={["#FAF56C", "#7EFDEC"]}
        start={{ x: 0, y: 0.434 }}
        end={{ x: 1, y: 0.566 }}
        style={styles.walletBadge}
      >
        <Svg
          style={styles.walletIcon}
          width={16}
          height={16}
          viewBox="0 0 16 16"
          fill="none"
        >
          <Path
            d="M8 0C12.4183 0 16 3.58172 16 8C16 12.4183 12.4183 16 8 16C3.58172 16 0 12.4183 0 8C0 3.58172 3.58172 0 8 0ZM11.6787 5.31641C11.9696 4.68384 11.3162 4.03042 10.6836 4.32129L8.31348 5.41113C8.1146 5.50258 7.8854 5.50258 7.68652 5.41113L5.31641 4.32129C4.68384 4.03042 4.03042 4.68384 4.32129 5.31641L5.41113 7.68652C5.50258 7.8854 5.50258 8.1146 5.41113 8.31348L4.32129 10.6836C4.03042 11.3162 4.68384 11.9696 5.31641 11.6787L7.68652 10.5889C7.8854 10.4974 8.1146 10.4974 8.31348 10.5889L10.6836 11.6787C11.3162 11.9696 11.9696 11.3162 11.6787 10.6836L10.5889 8.31348C10.4974 8.1146 10.4974 7.8854 10.5889 7.68652L11.6787 5.31641Z"
            fill="#0B0B0B"
          />
        </Svg>
        <Text
          style={styles.walletText}
        >
          {formattedBalance}
        </Text>
      </LinearGradient>
    </Pressable>
  ) : onLoginPress ? (
    <Pressable
      onPress={onLoginPress}
      style={styles.loginButton}
    >
      <Text style={styles.loginButtonText}>
        Login
      </Text>
    </Pressable>
  ) : (
    <View style={{ width: 1, height: 1, opacity: 0 }} />
  );

  return (
    <SafeAreaView
      edges={["top"]}
      style={[
        styles.safeArea,
        {
        backgroundColor,
        borderBottomLeftRadius: borderRadius,
        borderBottomRightRadius: borderRadius,
        },
      ]}
    >
      <View
        style={[
          styles.header,
          {
            backgroundColor,
            borderBottomLeftRadius: borderRadius,
            borderBottomRightRadius: borderRadius,
          },
        ]}
      >
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={styles.title}
        >
          {title}
        </Text>
        <View style={styles.rightSlot}>
          {rightContent}
        </View>
      </View>
    </SafeAreaView>
  );
}

export const NativePageHeader = memo(NativePageHeaderComponent);

const styles = StyleSheet.create({
  safeArea: {
    overflow: "hidden",
  },
  header: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: {
    flexShrink: 1,
    marginRight: 12,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "500",
    color: "#131314",
  },
  rightSlot: {
    minWidth: 96,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  walletBadge: {
    minHeight: 28,
    paddingHorizontal: 9,
    borderRadius: 96,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: "transparent",
  },
  walletIcon: {
    marginRight: 2,
  },
  walletText: {
    color: "#131314",
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "700",
  },
  loginButton: {
    borderRadius: 58,
    backgroundColor: "#FE946E",
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "600",
  },
});
