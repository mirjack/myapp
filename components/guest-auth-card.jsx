import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

export function GuestAuthCard({
  icon = "person-outline",
  title,
  description,
  actionLabel,
  onAction,
}) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={34} color="#FE946E" />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      <Pressable onPress={onAction} style={styles.button}>
        <Text style={styles.buttonText}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 48,
    paddingHorizontal: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: 999,
    backgroundColor: "#FFF2EA",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  title: {
    color: "#121212",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  description: {
    marginTop: 8,
    color: "#777777",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 280,
  },
  button: {
    marginTop: 18,
    borderRadius: 999,
    backgroundColor: "#FE946E",
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});
