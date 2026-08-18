import { ActivityIndicator, Pressable, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { addressPalette, addressSharedStyles } from "./address-theme";

export function CurrentLocationButton({ isLoading, onPress }) {
  return (
    <Pressable disabled={isLoading} onPress={onPress} style={({ pressed }) => [styles.button, addressSharedStyles.shadow, pressed && styles.buttonPressed]}>
      {isLoading ? (
        <ActivityIndicator color="#FFFFFF" size="small" />
      ) : (
        <Ionicons color="#FFFFFF" name="navigate-outline" size={21} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: addressPalette.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }],
  },
});
