import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Platform } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import "@/lib/i18n";

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
  return (
    <ThemeProvider value={AppTheme}>
      <Stack
        initialRouteName="(tabs)"
        screenOptions={{ animation: "none", gestureEnabled: false }}
      >
        <Stack.Screen
          name="(tabs)"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="account"
          options={{
            headerShown: false,
            animation: "slide_from_right",
            gestureEnabled: true,
            fullScreenGestureEnabled: true,
            gestureDirection: "horizontal",
          }}
        />
        <Stack.Screen
          name="onboarding/phone"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="chat/index"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="chat/[id]"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="loyalty-info"
          options={{ headerShown: false }}
        />
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
          name="modal"
          options={{ presentation: "modal", title: "Modal" }}
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
