import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { BrandColors } from "@/constants/theme";
import {
  fetchNativeLoyaltyProfile,
  fetchNativeLoyaltyTransactions,
} from "@/lib/native-account-api";
import { setCurrentWebPath } from "@/lib/tab-bar-visibility";

const numberValue = (value) => {
  const parsed = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatValue = (value) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 })
    .format(numberValue(value))
    .replace(/\u00a0/g, " ");

const PROGRAM_LEVELS = [
  {
    title: "Новичок 🥉",
    description: "На этом уровне вы получаете 3% от суммы заказа.",
  },
  {
    title: "Постоянный клиент 🎖️",
    description: "На этом уровне вы получаете 4% от суммы заказа.",
  },
  {
    title: "Эксперт 🏆",
    description:
      "Самый высокий уровень — и самые щедрые бонусы. Вы получаете 5% от суммы заказа.",
  },
];

export default function LoyaltyInfoScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(true);

  useEffect(() => {
    setCurrentWebPath("/loyalty-info");
    let active = true;
    Promise.allSettled([
      fetchNativeLoyaltyProfile(),
      fetchNativeLoyaltyTransactions(),
    ])
      .then(([profileResult, transactionsResult]) => {
        if (!active) return;
        if (profileResult.status === "fulfilled" && profileResult.value) {
          setProfile(profileResult.value);
        }
        if (transactionsResult.status === "fulfilled") {
          setTransactions(transactionsResult.value);
        }
        setIsLoading(false);
        setIsTransactionsLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setIsLoading(false);
        setIsTransactionsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const currentTier =
    profile?.tier_name || profile?.current_tier_name || "Новичок";
  const nextTier = profile?.next_tier_name || profile?.nextTierName || "";
  const progress = Math.round(
    Math.min(
      Math.max(
        numberValue(
          profile?.tier_progress_percent ?? profile?.progress_percent,
        ),
        0,
      ),
      100,
    ),
  );
  const balance = formatValue(profile?.wallet_balance);
  const pointsToNext = formatValue(profile?.points_to_next_tier);
  const isLastTier = !nextTier;
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" translucent={false} backgroundColor="#F8F8F8" />
      <View style={styles.container}>
        <View style={styles.commonHeader}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.commonHeaderBack,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              color={BrandColors.primary}
              name="chevron-back"
              size={28}
            />
            <Text style={styles.commonHeaderBackText}>Назад</Text>
          </Pressable>
          <Text numberOfLines={1} style={styles.commonHeaderTitle}>
            Мои бонусы
          </Text>
          <View style={styles.commonHeaderSpacer} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <LinearGradient colors={["#171717", "#101010"]} style={styles.hero}>
            <View style={styles.heroGlow} />
            <View style={styles.heroTop}>
              <View>
                <Text style={styles.heroCaption}>ВАШ УРОВЕНЬ</Text>
                <View style={styles.levelLine}>
                  <Text style={styles.heroLevel}>{currentTier}</Text>
                  <Text style={styles.heroEmoji}>
                    {currentTier === "Эксперт" ? "🏆" : "✨"}
                  </Text>
                </View>
              </View>
              <View style={styles.heroBadge}>
                <Svg width={25} height={25} viewBox="0 0 16 16" fill="none">
                  <Path
                    d="M8 0C12.4183 0 16 3.58172 16 8C16 12.4183 12.4183 16 8 16C3.58172 16 0 12.4183 0 8C0 3.58172 3.58172 0 8 0ZM11.6787 5.31641C11.9696 4.68384 11.3162 4.03042 10.6836 4.32129L8.31348 5.41113C8.1146 5.50258 7.8854 5.50258 7.68652 5.41113L5.31641 4.32129C4.68384 4.03042 4.03042 4.68384 4.32129 5.31641L5.41113 7.68652C5.50258 7.8854 5.50258 8.1146 5.41113 8.31348L4.32129 10.6836C4.03042 11.3162 4.68384 11.9696 5.31641 11.6787L7.68652 10.5889C7.8854 10.4974 8.1146 10.4974 8.31348 10.5889L10.6836 11.6787C11.3162 11.9696 11.9696 11.3162 11.6787 10.6836L10.5889 8.31348C10.4976 8.1146 10.4976 7.8854 10.5889 7.68652L11.6787 5.31641Z"
                    fill="#D7FE03"
                  />
                </Svg>
              </View>
            </View>
            <View style={styles.balanceRow}>
              <View>
                <Text style={styles.balanceCaption}>Доступно бонусов</Text>
                <Text style={styles.balance}>{isLoading ? "…" : balance}</Text>
              </View>
              <View style={styles.pointsPill}>
                <Text style={styles.pointsPillText}>баллов</Text>
              </View>
            </View>
            {!isLastTier ? (
              <View style={styles.progressBlock}>
                <View style={styles.progressMeta}>
                  <Text style={styles.progressCaption}>
                    Прогресс до {nextTier}
                  </Text>
                  <Text style={styles.progressPercent}>{progress}%</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View
                    style={[styles.progressFill, { width: `${progress}%` }]}
                  />
                </View>
                <Text style={styles.progressHint}>
                  Осталось {pointsToNext} баллов до нового уровня
                </Text>
              </View>
            ) : (
              <Text style={styles.maxLevel}>
                Поздравляем! Вы достигли максимального уровня.
              </Text>
            )}
          </LinearGradient>

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>История бонусов</Text>
            </View>
          </View>
          <View style={styles.levelsCard}>
            {isTransactionsLoading ? (
              <Text style={styles.historyEmpty}>Загрузка истории...</Text>
            ) : transactions.length === 0 ? (
              <Text style={styles.historyEmpty}>
                История бонусов пока пуста
              </Text>
            ) : (
              transactions.map((entry, index) => {
                const isAccrual =
                  entry.type === "accrual" ||
                  numberValue(entry.points_delta) > 0;
                const points = formatValue(
                  Math.abs(numberValue(entry.points_delta)),
                );
                return (
                  <View
                    key={entry.id ?? `${entry.created_at}-${index}`}
                    style={[
                      styles.levelRow,
                      index > 0 && styles.levelRowBorder,
                    ]}
                  >
                    <View style={styles.levelEmoji}>
                      <Text
                        style={[
                          styles.historySign,
                          isAccrual
                            ? styles.historySignPlus
                            : styles.historySignMinus,
                        ]}
                      >
                        {isAccrual ? "+" : "−"}
                      </Text>
                    </View>
                    <View style={styles.levelCopy}>
                      <View style={styles.levelTitleRow}>
                        <Text style={styles.levelName}>
                          {isAccrual
                            ? "Начисление бонусов"
                            : "Списание бонусов"}
                        </Text>
                        <Text
                          style={[
                            styles.cashback,
                            isAccrual
                              ? styles.historyAmountPlus
                              : styles.historyAmountMinus,
                          ]}
                        >
                          {isAccrual ? "+" : "−"}
                          {points}
                        </Text>
                      </View>
                      <Text style={styles.levelDescription}>
                        {entry.created_at
                          ? new Date(entry.created_at).toLocaleDateString(
                              "ru-RU",
                            )
                          : "Дата не указана"}
                        {entry.order_id ? ` · Заказ #${entry.order_id}` : ""}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          <View style={styles.rulesSection}>
            <Text style={styles.rulesTitle}>Как рассчитываются баллы?</Text>
            <Text style={styles.rulesDescription}>
              За каждый заказ вы получаете баллы и повышаете свой статус.
              Накопленные баллы вы сможете использовать для покупок.
            </Text>
            <View style={styles.rulesList}>
              {PROGRAM_LEVELS.map((level) => (
                <View key={level.title} style={styles.ruleItem}>
                  <Text style={styles.ruleTitle}>{level.title}</Text>
                  <Text style={styles.ruleDescription}>
                    {level.description}
                  </Text>
                  <Text style={styles.ruleNote}>1 балл = 1 000 сум</Text>
                </View>
              ))}
            </View>
          </View>

          <Pressable
            onPress={() => router.replace("/(tabs)/catalog")}
            style={({ pressed }) => [
              styles.shopButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.shopButtonText}>Перейти к покупкам</Text>
            <Ionicons name="arrow-forward" size={19} color="#FFFFFF" />
          </Pressable>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8F8F8" },
  container: { flex: 1, backgroundColor: "#F8F8F8" },
  commonHeader: {
    alignItems: "center",
    backgroundColor: "#F5F5F7",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 14,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  commonHeaderBack: { alignItems: "center", flexDirection: "row", width: 76 },
  commonHeaderBackText: {
    color: BrandColors.primary,
    fontSize: 15,
    marginLeft: 2,
  },
  commonHeaderTitle: {
    color: "#131314",
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
  },
  commonHeaderSpacer: { width: 76 },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  headerSpacer: { height: 42, width: 42 },
  headerTitle: {
    color: "#131314",
    fontSize: 21,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  content: { paddingBottom: 30, paddingHorizontal: 16 },
  hero: { borderRadius: 30, minHeight: 200, overflow: "hidden", padding: 20 },
  heroGlow: {
    backgroundColor: "rgba(215,254,3,0.08)",
    borderRadius: 180,
    height: 200,
    position: "absolute",
    right: -85,
    top: -85,
    width: 200,
  },
  heroTop: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  heroCaption: {
    color: "rgba(255,255,255,0.42)",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.5,
  },
  levelLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
  },
  heroLevel: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: -0.8,
  },
  heroEmoji: { fontSize: 20 },
  heroBadge: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.09)",
    borderRadius: 25,
    height: 50,
    justifyContent: "center",
    width: 50,
  },
  balanceRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 15,
  },
  balanceCaption: { color: "rgba(255,255,255,0.46)", fontSize: 12 },
  balance: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: -1,
    marginTop: 2,
  },
  pointsPill: {
    backgroundColor: "#D7FE03",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  pointsPillText: { color: "#0B0B0B", fontSize: 12, fontWeight: "700" },
  progressBlock: { marginTop: 15 },
  progressMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  progressCaption: { color: "rgba(255,255,255,0.62)", fontSize: 12 },
  progressPercent: { color: "#FFFFFF", fontSize: 12, fontWeight: "600" },
  progressTrack: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 4,
    height: 7,
    overflow: "hidden",
  },
  progressFill: { backgroundColor: "#D7FE03", borderRadius: 4, height: "100%" },
  progressHint: { color: "rgba(255,255,255,0.44)", fontSize: 11, marginTop: 8 },
  maxLevel: { color: "rgba(255,255,255,0.6)", fontSize: 12, marginTop: 28 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 },
  statCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    minHeight: 136,
    padding: 14,
    width: "48.3%",
  },
  statIcon: {
    alignItems: "center",
    backgroundColor: "#F1F1F3",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  statIconAccent: { backgroundColor: "#EAF9D2" },
  statLabel: { color: "#85858A", fontSize: 12, marginTop: 11 },
  statValue: {
    color: "#131314",
    fontSize: 20,
    fontWeight: "700",
    marginTop: 4,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    marginTop: 15,
  },
  sectionTitle: {
    color: "#131314",
    fontSize: 19,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  sectionSubtitle: { color: "#85858A", fontSize: 12, marginTop: 3 },
  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 16,
  },
  infoRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingVertical: 16,
  },
  infoIcon: {
    alignItems: "center",
    backgroundColor: "#F1F1F3",
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  infoCopy: { flex: 1 },
  infoTitle: { color: "#131314", fontSize: 14, fontWeight: "600" },
  infoText: { color: "#85858A", fontSize: 12, lineHeight: 17, marginTop: 3 },
  infoDivider: { backgroundColor: "#F0F0F2", height: 1 },
  levelsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 16,
  },
  levelRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingVertical: 15,
  },
  levelRowBorder: { borderTopColor: "#F0F0F2", borderTopWidth: 1 },
  levelEmoji: {
    alignItems: "center",
    backgroundColor: "#F7F7F8",
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  historySign: { fontSize: 23, fontWeight: "700" },
  historySignPlus: { color: "#658900" },
  historySignMinus: { color: "#C33B49" },
  historyAmountPlus: { color: "#658900" },
  historyAmountMinus: { color: "#C33B49" },
  historyEmpty: {
    color: "#85858A",
    fontSize: 14,
    paddingVertical: 28,
    textAlign: "center",
  },
  rulesSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    marginTop: 20,
    padding: 20,
  },
  rulesTitle: {
    color: "#131314",
    fontSize: 25,
    fontWeight: "700",
    letterSpacing: -0.6,
    lineHeight: 31,
  },
  rulesDescription: {
    color: "#131314",
    fontSize: 15,
    lineHeight: 21,
    marginTop: 8,
  },
  rulesList: { gap: 20, marginTop: 22 },
  ruleItem: { gap: 5 },
  ruleTitle: { color: "#131314", fontSize: 17, fontWeight: "700" },
  ruleDescription: { color: "#131314", fontSize: 14, lineHeight: 19 },
  ruleNote: { color: "#55555A", fontSize: 13, marginTop: 1 },
  levelCopy: { flex: 1 },
  levelTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  levelName: { color: "#131314", fontSize: 14, fontWeight: "600" },
  cashback: { color: "#658900", fontSize: 14, fontWeight: "700" },
  levelDescription: { color: "#85858A", fontSize: 12, marginTop: 3 },
  shopButton: {
    alignItems: "center",
    backgroundColor: "#1F1F1F",
    borderRadius: 26,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginTop: 20,
    minHeight: 54,
  },
  shopButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  pressed: { opacity: 0.72 },
});
