import { useEffect } from "react";
import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Platform } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import "@/lib/i18n";
import { ensureNotificationSetupAsync } from "@/lib/notifications";

// Custom themani yaratamiz - DefaultTheme'dan meros olib
export const AppTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: "rgb(255, 255, 255)", // oq fon
    text: "rgb(0, 0, 0)", // qora text
    card: "rgb(255, 255, 255)",
  },
};

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  useEffect(() => {
    ensureNotificationSetupAsync({
      requestIfUndetermined: Platform.OS === "android",
    }).catch(() => {});
  }, []);

  useEffect(() => {
    // AppMetrica temporarily disabled to avoid native module crash in dev builds.
    // const apiKey = getRuntimeConfig().appMetricaApiKey;
    // if (!apiKey) return;
    // if (Constants?.appOwnership === "expo") return;
    // if (!NativeModules?.AppMetrica) return;
    //
    // let cancelled = false;
    //
    // const initAppMetrica = async () => {
    //   try {
    //     const module = require("@appmetrica/react-native-analytics");
    //     if (cancelled) return;
    //
    //     module.default.activate({
    //       apiKey,
    //       logs: __DEV__,
    //       sessionTimeout: 120,
    //     });
    //   } catch {
    //     // Ignore analytics bootstrap issues so the app can continue to load.
    //   }
    // };
    //
    // void initAppMetrica();
    //
    // return () => {
    //   cancelled = true;
    // };
  }, []);

  return (
    <ThemeProvider value={AppTheme}>
      <Stack
        initialRouteName="(tabs)"
        screenOptions={{
          animation: Platform.OS === "android" ? "fade_from_bottom" : "simple_push",
          gestureEnabled: false,
          contentStyle: { backgroundColor: "#FFFFFF" },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="account"
          options={{
            headerShown: false,
            animation: "simple_push",
            gestureEnabled: true,
            fullScreenGestureEnabled: true,
            gestureDirection: "horizontal",
          }}
        />
        <Stack.Screen
          name="onboarding/phone"
          options={{ headerShown: false }}
        />
        <Stack.Screen name="chat/index" options={{ headerShown: false }} />
        <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="loyalty-info" options={{ headerShown: false }} />
        <Stack.Screen
          name="checkout"
          options={{
            headerShown: false,
            animation: "slide_from_right",
            gestureEnabled: true,
            fullScreenGestureEnabled: true,
            gestureDirection: "horizontal",
          }}
        />
        <Stack.Screen
          name="product"
          options={{
            headerShown: false,
            animation: Platform.OS === "android" ? "fade_from_bottom" : "slide_from_right",
            gestureEnabled: true,
            fullScreenGestureEnabled: false,
            gestureDirection: "horizontal",
            gestureResponseDistance: Platform.OS === "ios" ? 24 : undefined,
          }}
        />
      </Stack>
      <StatusBar
        style={Platform.OS === "android" ? "dark" : "auto"}
        translucent={false}
        backgroundColor="#FFFFFF"
      />
    </ThemeProvider>
  );
}
