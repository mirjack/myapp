import { useEffect } from "react";
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const OPEN_SPRING = {
  damping: 40,
  stiffness: 400,
  mass: 0.9,
};
const OPEN_SPRING_SCALE = {
  damping: 34,
  stiffness: 360,
  mass: 0.85,
};
const CLOSE_MS = 150;

function LoginRequiredSheet({ payload, onAction }) {
  return (
    <View>
      <Image
        source={{ uri: payload?.imageUrl }}
        style={styles.loginImage}
        resizeMode="contain"
      />
      <Text style={styles.loginTitle}>{payload?.title || "Login required"}</Text>
      <Text style={styles.loginDescription}>{payload?.description || ""}</Text>
      <Pressable
        style={styles.loginButton}
        onPress={() => onAction?.("login", null)}
      >
        <Text style={styles.loginButtonText}>
          {payload?.loginText || "Login"}
        </Text>
      </Pressable>
    </View>
  );
}

function LanguageSelectSheet({ payload, onAction }) {
  const options = Array.isArray(payload?.options) ? payload.options : [];
  return (
    <View>
      <Text style={styles.sectionTitle}>{payload?.title || "Language"}</Text>
      <Text style={styles.sectionDescription}>{payload?.description || ""}</Text>
      <View style={styles.languageList}>
        {options.map((option) => {
          const isSelected = payload?.selectedLang === option.code;
          return (
            <Pressable
              key={option.code}
              style={[
                styles.languageRow,
                isSelected ? styles.languageRowSelected : null,
              ]}
              onPress={() =>
                onAction?.("select_language", { code: String(option.code) })
              }
            >
              <View
                style={[
                  styles.radio,
                  isSelected ? styles.radioChecked : null,
                ]}
              />
              <Text style={styles.languageText}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ContactInfoSheet({ payload }) {
  return (
    <View>
      <Text style={styles.sectionTitle}>{payload?.title || "Contact"}</Text>
      <Text style={styles.sectionDescription}>{payload?.description || ""}</Text>
      <View style={styles.contactCard}>
        <Text style={styles.contactLabel}>{payload?.phoneLabel || "Phone"}</Text>
        <Text style={styles.contactPhone}>{payload?.phoneNumber || ""}</Text>
      </View>
      <Text style={styles.contactWorkHours}>{payload?.workHours || ""}</Text>
    </View>
  );
}

function renderSheetContent(sheet, onAction) {
  if (!sheet) return null;
  if (sheet.sheetKey === "login_required") {
    return <LoginRequiredSheet payload={sheet.payload} onAction={onAction} />;
  }
  if (sheet.sheetKey === "language_select") {
    return <LanguageSelectSheet payload={sheet.payload} onAction={onAction} />;
  }
  if (sheet.sheetKey === "contact_info") {
    return <ContactInfoSheet payload={sheet.payload} />;
  }

  return (
    <View>
      <Text style={styles.fallbackTitle}>Sheet</Text>
      <Text style={styles.fallbackText}>Unsupported sheet: {sheet.sheetKey}</Text>
    </View>
  );
}

export function NativeBottomSheet({
  mounted,
  visible,
  sheet,
  onClose,
  onAction,
}) {
  const translateY = useSharedValue(420);
  const scaleX = useSharedValue(0.9);
  const scaleY = useSharedValue(0.78);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      backdropOpacity.value = withTiming(1, {
        duration: 200,
        easing: Easing.out(Easing.quad),
      });
      scaleX.value = withSpring(1, OPEN_SPRING_SCALE);
      scaleY.value = withSpring(1, OPEN_SPRING_SCALE);
      translateY.value = withSpring(0, OPEN_SPRING);
      return;
    }
    backdropOpacity.value = withTiming(0, { duration: CLOSE_MS });
    scaleX.value = withTiming(0.92, { duration: CLOSE_MS });
    scaleY.value = withTiming(0.84, { duration: CLOSE_MS });
    translateY.value = withTiming(420, {
      duration: CLOSE_MS,
      easing: Easing.in(Easing.cubic),
    });
  }, [backdropOpacity, scaleX, scaleY, translateY, visible]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1000 },
      { translateY: translateY.value },
      { scaleX: scaleX.value },
      { scaleY: scaleY.value },
    ],
  }));

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdropTap} onPress={onClose}>
          <Animated.View style={[styles.backdrop, backdropStyle]} />
        </Pressable>

        <Animated.View style={[styles.sheetWrap, sheetStyle]}>
          {sheet?.options?.hideClose ? null : (
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeText}>x</Text>
            </Pressable>
          )}
          {renderSheetContent(sheet, onAction)}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdropTap: {
    ...StyleSheet.absoluteFillObject,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.38)",
  },
  sheetWrap: {
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 36,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 16,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.18,
    shadowRadius: 30,
    elevation: 24,
  },
  closeBtn: {
    position: "absolute",
    top: 24,
    right: 24,
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.1)",
    zIndex: 2,
  },
  closeText: {
    color: "#fff",
    fontSize: 14,
    lineHeight: 14,
    fontWeight: "700",
  },
  loginImage: {
    width: 116,
    height: 116,
    alignSelf: "center",
  },
  loginTitle: {
    marginTop: 16,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "700",
    color: "#131314",
  },
  loginDescription: {
    marginTop: 8,
    fontSize: 16,
    lineHeight: 22,
    color: "#131314",
  },
  loginButton: {
    marginTop: 16,
    borderRadius: 999,
    backgroundColor: "#FE946E",
    paddingVertical: 12,
    alignItems: "center",
  },
  loginButtonText: {
    color: "#fff",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "700",
  },
  fallbackTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#131314",
  },
  fallbackText: {
    marginTop: 8,
    fontSize: 14,
    color: "#747479",
  },
  sectionTitle: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "700",
    color: "#131314",
  },
  sectionDescription: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 18,
    color: "#747479",
  },
  languageList: {
    marginTop: 12,
    gap: 8,
  },
  languageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#EEF0F5",
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#fff",
  },
  languageRowSelected: {
    backgroundColor: "#F8F8FA",
    borderColor: "#D86F49",
  },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    backgroundColor: "#fff",
  },
  radioChecked: {
    borderColor: "#D86F49",
    backgroundColor: "#D86F49",
  },
  languageText: {
    fontSize: 16,
    lineHeight: 20,
    color: "#131314",
    fontWeight: "500",
  },
  contactCard: {
    marginTop: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#EEF0F5",
    backgroundColor: "#F8FAFF",
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  contactLabel: {
    fontSize: 11,
    lineHeight: 14,
    textTransform: "uppercase",
    letterSpacing: 1.6,
    color: "#6B7280",
    fontWeight: "700",
  },
  contactPhone: {
    marginTop: 4,
    fontSize: 20,
    lineHeight: 24,
    color: "#111827",
    fontWeight: "700",
  },
  contactWorkHours: {
    marginTop: 14,
    fontSize: 14,
    lineHeight: 18,
    color: "#6B7280",
  },
});
