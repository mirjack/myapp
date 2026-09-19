import { Stack } from "expo-router";

export default function ProfileStackLayout() {
  return (
    <Stack
      screenOptions={{
        animation: "simple_push",
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
        gestureDirection: "horizontal",
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="me" />
      <Stack.Screen name="orders" />
      <Stack.Screen name="orders/[id]" />
      <Stack.Screen name="addresses" />
      <Stack.Screen name="chat/index" />
      <Stack.Screen name="chat/[id]" />
    </Stack>
  );
}
