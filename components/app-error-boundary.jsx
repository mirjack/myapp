import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

export function AppErrorBoundary({ retry }) {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>{t("recovery.title")}</Text>
      <Text style={styles.description}>{t("recovery.description")}</Text>
      <Pressable accessibilityRole="button" onPress={retry} style={styles.button}>
        <Text style={styles.buttonText}>{t("recovery.retry")}</Text>
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 28, backgroundColor: "#FFFFFF", gap: 16 },
  title: { fontSize: 22, fontWeight: "700", color: "#1D1E20" },
  description: { fontSize: 16, lineHeight: 24, color: "#555555" },
  button: { padding: 16, borderRadius: 16, backgroundColor: "#FE946E", alignItems: "center" },
  buttonText: { color: "#1D1E20", fontSize: 16, fontWeight: "600" },
});
