import { BackHandler, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useCallback } from "react";
import { setTabBarForcedHidden } from "@/lib/tab-bar-visibility";

import { nativeAccountStyles as styles } from "./native-account.styles";

export function useBackToProfile({ forceReplace = false } = {}) {
  const router = useRouter();

  return useCallback(() => {
    if (!forceReplace && router.canGoBack()) {
      router.back();
      return true;
    }
    router.replace("/(tabs)/profile");
    return true;
  }, [forceReplace, router]);
}

export function NativeAccountScreenShell({
  title,
  children,
  forceBackToProfile = false,
}) {
  const handleBack = useBackToProfile({ forceReplace: forceBackToProfile });

  useFocusEffect(
    useCallback(() => {
      setTabBarForcedHidden(true);

      return () => {
        setTabBarForcedHidden(false);
      };
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", handleBack);
      return () => sub.remove();
    }, [handleBack]),
  );

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={handleBack} style={styles.headerBackButton}>
          <Ionicons color="#FE946E" name="chevron-back" size={24} />
        </Pressable>
        <Text numberOfLines={1} style={styles.headerTitle}>
          {title}
        </Text>
        <View style={styles.headerSide} />
      </View>
      <View style={styles.container}>{children}</View>
    </SafeAreaView>
  );
}
