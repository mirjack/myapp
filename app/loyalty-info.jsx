import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { setCurrentWebPath } from "@/lib/tab-bar-visibility";

const LEVELS = [
  {
    title: "Новичок",
    emoji: "🥇",
    description: "На этом уровне вы получаете 3% от суммы заказа.",
  },
  {
    title: "Постоянный клиент",
    emoji: "🎖️",
    description: "На этом уровне вы получаете 4% от суммы заказа.",
  },
  {
    title: "Эксперт",
    emoji: "🏆",
    description:
      "Самый высокий уровень — и самые щедрые бонусы. Вы получаете 5% от суммы заказа.",
  },
];

export default function LoyaltyInfoScreen() {
  const router = useRouter();

  const closeScreen = () => {
    router.back();
  };

  const goToCatalog = () => {
    setCurrentWebPath("/catalog");
    router.replace("/(tabs)/catalog");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" translucent={false} backgroundColor="#FFFFFF" />
      <View style={styles.container}>
        <Pressable onPress={closeScreen} style={styles.closeButton}>
          <Ionicons name="close" size={16} color="#131314" />
        </Pressable>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Как рассчитываются баллы?</Text>
          <Text style={styles.description}>
            За каждый заказ вы получаете баллы и повышаете свой статус.
            Накопленные баллы вы сможете использовать для покупок.
          </Text>

          <View style={styles.levels}>
            {LEVELS.map((level) => (
              <View key={level.title} style={styles.levelBlock}>
                <Text style={styles.levelTitle}>
                  {level.title} {level.emoji}
                </Text>
                <Text style={styles.levelDescription}>{level.description}</Text>
                <Text style={styles.levelNote}>1 балл = 1 000 сум</Text>
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable onPress={goToCatalog} style={styles.catalogButton}>
            <Text style={styles.catalogButtonText}>К покупкам</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  closeButton: {
    alignItems: "center",
    backgroundColor: "#F5F5F6",
    borderRadius: 24,
    height: 32,
    justifyContent: "center",
    right: 16,
    position: "absolute",
    top: 32,
    width: 32,
    zIndex: 10,
  },
  content: {
    paddingBottom: 160,
    paddingHorizontal: 24,
    paddingTop: 88,
  },
  heroCard: {
    alignItems: "center",
    backgroundColor: "#F8F8F8",
    borderRadius: 32,
    height: 280,
    justifyContent: "center",
    marginBottom: 28,
  },
  heroEmoji: {
    fontSize: 120,
  },
  title: {
    color: "#131314",
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: -1,
    lineHeight: 44,
  },
  description: {
    color: "#131314",
    fontSize: 16,
    fontWeight: "400",
    lineHeight: 22,
    marginTop: 4,
  },
  levels: {
    gap: 28,
    marginTop: 16,
  },
  levelBlock: {
    gap: 8,
  },
  levelTitle: {
    color: "#131314",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 32,
  },
  levelDescription: {
    color: "#131314",
    fontSize: 14,
    lineHeight: 16,
  },
  levelNote: {
    color: "#131314",
    fontSize: 14,
  },
  footer: {
    backgroundColor: "#FFFFFF",
    bottom: 0,
    left: 0,
    paddingBottom: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    position: "absolute",
    right: 0,
  },
  catalogButton: {
    alignItems: "center",
    backgroundColor: "#1F1F1F",
    borderRadius: 28,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  catalogButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 22,
  },
});
