import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  BackHandler,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getPendingAuthAction,
  setPendingAuthAction,
  setStoredAuthTokens,
} from "@/lib/auth-storage";
import { setAuthStateCache } from "@/lib/auth-guard-bridge";
import { addFavorite, adjustCartItemByProduct } from "@/lib/native-market-api";
import { requestNativeOtp, verifyNativeOtp } from "@/lib/native-account-api";
import { setCartQuantity } from "@/lib/cart-quantities";

const RESEND_SECONDS = 59;

function normalizeNextPath(next) {
  const raw = Array.isArray(next) ? next[0] : next;
  if (typeof raw !== "string" || !raw.startsWith("/")) return "/";
  if (raw.startsWith("/chat")) return "/chat";
  if (raw.startsWith("/cart")) return "/cart";
  if (raw.startsWith("/favorites")) return "/favorites";
  if (raw.startsWith("/profile")) return "/profile";
  if (raw.startsWith("/catalog")) return "/catalog";
  return "/";
}

function toNativeTabsPath(pathname) {
  if (pathname === "/chat") return "/chat";
  if (pathname === "/catalog") return "/(tabs)/catalog";
  if (pathname === "/cart") return "/(tabs)/cart";
  if (pathname === "/favorites") return "/(tabs)/favorites";
  if (pathname === "/profile") return "/(tabs)/profile";
  return "/(tabs)";
}

function parseTokensString(tokensString) {
  if (!tokensString) return null;
  try {
    return JSON.parse(tokensString);
  } catch {
    return null;
  }
}

async function flushPendingAuthAction(tokensString) {
  const tokens = parseTokensString(tokensString);
  if (!tokens?.access) return;
  const action = await getPendingAuthAction();
  if (!action?.type || action.productId == null) return;
  await setPendingAuthAction(null);

  try {
    if (action.type === "cart") {
      const updated = await adjustCartItemByProduct(
        tokens.access,
        action.productId,
        Number(action.delta) || 1,
      );
      setCartQuantity(
        action.productId,
        Math.max(0, Number(updated?.quantity ?? 0)),
      );
      return;
    }

    if (action.type === "favorite") {
      await addFavorite(tokens.access, action.productId);
    }
  } catch {
    // Login should still finish even if the queued product action fails.
  }
}

function formatPhoneDigits(value) {
  const normalized = String(value || "")
    .replace(/\D/g, "")
    .slice(0, 9);
  const p1 = normalized.slice(0, 2);
  const p2 = normalized.slice(2, 5);
  const p3 = normalized.slice(5, 7);
  const p4 = normalized.slice(7, 9);
  return [p1, p2, p3, p4].filter(Boolean).join(" ");
}

function extractErrorMessage(error, fallback) {
  return (
    error?.data?.detail ||
    error?.data?.error ||
    error?.data?.message ||
    error?.message ||
    fallback
  );
}

export default function OnboardingPhoneScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const navigation = useNavigation();
  const { t } = useTranslation();
  const nextPath = useMemo(
    () => normalizeNextPath(params?.next),
    [params?.next],
  );
  const [step, setStep] = useState("phone");
  const [digits, setDigits] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const otpInputRefs = useRef([]);

  const phoneNumber = digits.length > 0 ? `+998${digits}` : "";
  const isPhoneValid = digits.length === 9;
  const isOtpValid = otp.length === 6 && Boolean(phoneNumber);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    if (step !== "otp" || resendIn <= 0) return undefined;
    const timer = setTimeout(() => {
      setResendIn((value) => Math.max(0, value - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [resendIn, step]);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(Math.max(0, event?.endCoordinates?.height || 0));
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (step !== "otp") return;
    const timer = setTimeout(() => {
      otpInputRefs.current[0]?.focus();
    }, 80);
    return () => clearTimeout(timer);
  }, [step]);

  const goBack = useCallback(() => {
    if (step === "otp") {
      setStep("phone");
      setOtp("");
      setError("");
      return true;
    }

    if (typeof router.canGoBack === "function" && router.canGoBack()) {
      router.back();
      return true;
    }

    if (Platform.OS === "android") {
      BackHandler.exitApp();
      return true;
    }

    router.replace(toNativeTabsPath(nextPath));
    return true;
  }, [nextPath, router, step]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") return undefined;

      const sub = BackHandler.addEventListener("hardwareBackPress", goBack);
      return () => sub.remove();
    }, [goBack]),
  );

  const handleDigitsChange = useCallback((value) => {
    setDigits(
      String(value || "")
        .replace(/\D/g, "")
        .slice(0, 9),
    );
    setError("");
  }, []);

  const handleOtpDigitChange = useCallback(
    (index, value) => {
      const clean = String(value || "").replace(/\D/g, "");
      if (clean.length > 1) {
        const pasted = clean.slice(0, 6);
        setOtp(pasted);
        setError("");
        const nextFocus = Math.min(pasted.length, 5);
        setTimeout(() => otpInputRefs.current[nextFocus]?.focus(), 0);
        return;
      }

      const nextDigits = otp.padEnd(6, " ").split("");
      nextDigits[index] = clean || " ";
      const nextOtp = nextDigits.join("").replace(/\s/g, "").slice(0, 6);
      setOtp(nextOtp);
      setError("");

      if (clean && index < 5) {
        setTimeout(() => otpInputRefs.current[index + 1]?.focus(), 0);
      }
    },
    [otp],
  );

  const handleOtpKeyPress = useCallback(
    (index, event) => {
      if (event?.nativeEvent?.key !== "Backspace") return;
      const digitsList = otp.padEnd(6, " ").split("");

      if (digitsList[index]?.trim()) {
        digitsList[index] = " ";
        setOtp(digitsList.join("").replace(/\s/g, "").slice(0, 6));
        return;
      }

      if (index > 0) {
        digitsList[index - 1] = " ";
        setOtp(digitsList.join("").replace(/\s/g, "").slice(0, 6));
        setTimeout(() => otpInputRefs.current[index - 1]?.focus(), 0);
      }
    },
    [otp],
  );

  const submitPhone = useCallback(async () => {
    if (!isPhoneValid || isSubmitting) return;
    setIsSubmitting(true);
    setError("");
    try {
      await requestNativeOtp(phoneNumber);
      setStep("otp");
      setOtp("");
      setResendIn(RESEND_SECONDS);
    } catch (err) {
      setError(
        extractErrorMessage(
          err,
          t("onboarding.errors.generic", {
            defaultValue: "Kod yuborib bo'lmadi. Qayta urinib ko'ring.",
          }),
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [isPhoneValid, isSubmitting, phoneNumber, t]);

  const submitOtp = useCallback(async () => {
    if (!isOtpValid || isSubmitting) return;
    setIsSubmitting(true);
    setError("");
    try {
      const tokens = await verifyNativeOtp({ phoneNumber, otp });
      if (!tokens?.access) {
        throw new Error(
          t("onboarding.errors.tokensMissing", {
            defaultValue: "Login tokenlari kelmadi.",
          }),
        );
      }

      const tokensString = JSON.stringify(tokens);
      await setStoredAuthTokens(tokensString);
      await flushPendingAuthAction(tokensString);
      setAuthStateCache(true);

      if (tokens?.isNew) {
        router.replace("/account/me");
        return;
      }

      router.replace(toNativeTabsPath(nextPath));
    } catch (err) {
      setError(
        extractErrorMessage(
          err,
          t("onboarding.errors.invalidCode", {
            defaultValue: "Kod noto'g'ri yoki muddati tugagan.",
          }),
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [isOtpValid, isSubmitting, nextPath, otp, phoneNumber, router, t]);

  const resendOtp = useCallback(async () => {
    if (!isPhoneValid || isSubmitting || resendIn > 0) return;
    setIsSubmitting(true);
    setError("");
    try {
      await requestNativeOtp(phoneNumber);
      setResendIn(RESEND_SECONDS);
    } catch (err) {
      setError(
        extractErrorMessage(
          err,
          t("onboarding.errors.generic", {
            defaultValue: "Kod yuborib bo'lmadi. Qayta urinib ko'ring.",
          }),
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [isPhoneValid, isSubmitting, phoneNumber, resendIn, t]);

  const isOtpStep = step === "otp";
  const primaryDisabled =
    isSubmitting || (isOtpStep ? !isOtpValid : !isPhoneValid);
  const primaryTitle = isOtpStep
    ? t("onboarding.verify", { defaultValue: "Tasdiqlash" })
    : t("onboarding.getCode", { defaultValue: "Kodni olish" });
  const otpDigits = otp.padEnd(6, " ").split("");
  const phoneInputValue = formatPhoneDigits(digits);
  const formattedResendTime = `${Math.floor(resendIn / 60)
    .toString()
    .padStart(2, "0")}:${(resendIn % 60).toString().padStart(2, "0")}`;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable hitSlop={12} onPress={goBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color="#FE946E" />
            <Text style={styles.backText}>
              {t("common.back", { defaultValue: "Ortga" })}
            </Text>
          </Pressable>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.title}>
            {isOtpStep
              ? t("onboarding.otpTitle", { defaultValue: "Kodni kiriting" })
              : t("onboarding.phoneTitle", {
                  defaultValue: "Telefon raqamingiz",
                })}
          </Text>
          <Text style={styles.subtitle}>
            {isOtpStep
              ? t("onboarding.otpSubtitle", {
                  defaultValue: "Telefoningizga 6 xonali kod yubordik.",
                })
              : t("onboarding.phoneSubtitle", {
                  defaultValue: "Tasdiqlash kodi SMS orqali yuboriladi.",
                })}
          </Text>
        </View>

        <View style={styles.content}>
          {isOtpStep ? (
            <View style={styles.otpBlock}>
              <View style={styles.otpBoxes}>
                {otpDigits.map((digit, index) => (
                  <TextInput
                    key={index}
                    autoComplete={index === 0 ? "sms-otp" : "off"}
                    autoCorrect={false}
                    ref={(input) => {
                      otpInputRefs.current[index] = input;
                    }}
                    importantForAutofill={index === 0 ? "yes" : "no"}
                    keyboardType="number-pad"
                    maxLength={index === 0 ? 6 : 1}
                    onChangeText={(value) => handleOtpDigitChange(index, value)}
                    onKeyPress={(event) => handleOtpKeyPress(index, event)}
                    onSubmitEditing={() => {
                      if (index < 5) {
                        otpInputRefs.current[index + 1]?.focus();
                      } else {
                        submitOtp();
                      }
                    }}
                    returnKeyType={index === 5 ? "done" : "next"}
                    style={[
                      styles.otpBox,
                      otp.length === index && styles.otpBoxFocused,
                    ]}
                    textAlign="center"
                    textContentType={index === 0 ? "oneTimeCode" : "none"}
                    value={digit.trim()}
                  />
                ))}
              </View>
              {error ? <Text style={styles.otpErrorText}>{error}</Text> : null}
              <Pressable
                disabled={resendIn > 0 || isSubmitting}
                onPress={resendOtp}
                style={styles.resendButton}
              >
                {resendIn > 0 ? (
                  <View style={styles.resendTimerRow}>
                    <Text style={styles.resendTextDisabled}>
                      {t("onboarding.sendNewCodeIn", {
                        defaultValue: "Yangi kod yuborish",
                      })}
                    </Text>
                    <Text style={styles.resendTimerText}>
                      {formattedResendTime}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.resendText}>
                    {t("onboarding.sendNewCode", {
                      defaultValue: "Kodni qayta yuborish",
                    })}
                  </Text>
                )}
              </Pressable>
            </View>
          ) : (
            <View style={styles.phoneInputRow}>
              <Text style={styles.phonePrefix}>+998</Text>
              <TextInput
                autoFocus
                keyboardType="number-pad"
                maxLength={12}
                onChangeText={handleDigitsChange}
                onSubmitEditing={submitPhone}
                placeholder={t("onboarding.phonePlaceholder", {
                  defaultValue: "90 123 45 67",
                })}
                placeholderTextColor="#B8B8BE"
                returnKeyType="done"
                style={styles.phoneInput}
                textContentType="telephoneNumber"
                value={phoneInputValue}
              />
            </View>
          )}

          {!isOtpStep && error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : null}
        </View>

        <View
          style={[
            styles.footer,
            keyboardHeight > 0 && { bottom: keyboardHeight + 8 },
          ]}
        >
          <Text style={styles.termsText}>
            {t("onboarding.termsPrefix", {
              defaultValue: "Davom etish orqali",
            })}
            <Text> </Text>
            <Text style={styles.termsLink}>
              {t("onboarding.termsLink", {
                defaultValue: "foydalanish shartlari",
              })}
            </Text>
            <Text>
              {" "}
              {t("onboarding.termsSuffix", {
                defaultValue: "ga rozilik bildirasiz.",
              })}
            </Text>
          </Text>
          <Pressable
            disabled={primaryDisabled}
            onPress={isOtpStep ? submitOtp : submitPhone}
            style={({ pressed }) => [
              styles.primaryButton,
              primaryDisabled && styles.primaryButtonDisabled,
              pressed && !primaryDisabled && styles.primaryButtonPressed,
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text
                style={[
                  styles.primaryButtonText,
                  primaryDisabled && styles.primaryButtonTextDisabled,
                ]}
              >
                {primaryTitle}
              </Text>
            )}
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
  screen: {
    flex: 1,
    paddingHorizontal: 8,
    paddingTop: 11,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  backButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: 1,
    minHeight: 24,
    paddingRight: 8,
  },
  backText: {
    color: "#FE946E",
    fontSize: 16,
    lineHeight: 22,
  },
  headerSpacer: {
    width: 24,
  },
  titleBlock: {
    paddingBottom: 16,
    paddingLeft: 8,
  },
  content: {
    flex: 1,
    justifyContent: "flex-start",
    paddingBottom: 128,
    paddingHorizontal: 8,
  },
  title: {
    color: "#0B0B0B",
    fontSize: 32,
    fontWeight: "600",
    letterSpacing: 0,
    lineHeight: 38,
  },
  subtitle: {
    color: "#747479",
    fontSize: 16,
    lineHeight: 22,
    marginTop: 4,
  },
  phoneInputRow: {
    alignItems: "center",
    gap: 8,
    flexDirection: "row",
    paddingVertical: 16,
  },
  phonePrefix: {
    borderRightColor: "#CDCDD4",
    borderRightWidth: StyleSheet.hairlineWidth,
    color: "#1E293B",
    fontSize: 20,
    fontWeight: "400",
    letterSpacing: 0,
    paddingRight: 8,
  },
  phoneInput: {
    color: "#0F172A",
    flex: 1,
    fontSize: 20,
    fontWeight: "400",
    letterSpacing: 0,
    lineHeight: 24,
    minHeight: 32,
    padding: 0,
  },
  otpBlock: {
    gap: 16,
  },
  otpBoxes: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
  },
  otpBox: {
    borderBottomColor: "#D1D5DB",
    borderBottomWidth: 2,
    color: "#131314",
    fontSize: 20,
    height: 40,
    lineHeight: 24,
    padding: 0,
    width: 40,
  },
  otpBoxFocused: {
    borderBottomColor: "#FE946E",
  },
  resendButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
  },
  resendTimerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
  },
  resendText: {
    color: "#FE946E",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  resendTextDisabled: {
    color: "#6B7280",
    fontSize: 14,
    lineHeight: 20,
  },
  resendTimerText: {
    color: "#FE946E",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  errorText: {
    color: "#E73C50",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
  },
  otpErrorText: {
    color: "#E73C50",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  footer: {
    backgroundColor: "#FFFFFF",
    bottom: 0,
    left: 0,
    paddingBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 8,
    position: "absolute",
    right: 0,
  },
  termsText: {
    color: "#747479",
    fontSize: 13,
    lineHeight: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    textAlign: "center",
  },
  termsLink: {
    color: "#298BEE",
    fontWeight: "600",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#FE946E",
    borderRadius: 999,
    height: 44,
    justifyContent: "center",
  },
  primaryButtonDisabled: {
    backgroundColor: "rgba(0, 0, 0, 0.05)",
  },
  primaryButtonPressed: {
    opacity: 0.86,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 20,
  },
  primaryButtonTextDisabled: {
    color: "#C4C4CC",
  },
});
