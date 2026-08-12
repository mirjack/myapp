import { Stack } from "expo-router";

export default function ProfileStackLayout() {
  return (
    <Stack
      screenOptions={{
        animation: "simple_push",
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
        gestureDirection: "horizontal",
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="me" options={{ headerShown: false }} />
      <Stack.Screen name="orders" options={{ headerShown: false }} />
      <Stack.Screen name="orders/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="addresses" options={{ headerShown: false }} />
      <Stack.Screen name="chat/index" options={{ headerShown: false }} />
      <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
    </Stack>
  );
}
