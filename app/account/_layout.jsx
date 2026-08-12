import { Stack } from "expo-router";

export default function AccountLayout() {
  return (
    <Stack
      screenOptions={{
        animation: "slide_from_right",
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
        gestureDirection: "horizontal",
      }}
    >
      <Stack.Screen name="me" options={{ headerShown: false }} />
      <Stack.Screen name="orders" options={{ headerShown: false }} />
      <Stack.Screen name="orders/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="addresses" options={{ headerShown: false }} />
    </Stack>
  );
}
