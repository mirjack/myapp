import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";

import {
  fetchCurrentUserProfile,
  saveCurrentUserProfile,
} from "@/lib/native-account-api";

import { NativeAccountScreenShell } from "./account-screen-shell";
import { nativeAccountStyles as styles } from "./native-account.styles";

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  phoneNumber: "",
  address: "",
  city: "",
};

export function ProfileDetailsScreen() {
  const { t } = useTranslation();
  const [form, setForm] = useState(EMPTY_FORM);
  const [initialForm, setInitialForm] = useState(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    fetchCurrentUserProfile()
      .then((data) => {
        if (!isMounted) return;
        setForm(data);
        setInitialForm(data);
      })
      .catch((loadError) => {
        if (!isMounted) return;
        setError(
          loadError?.status === 401
            ? t("profileDetails.loadErrorAuth")
            : t("profileDetails.loadError"),
        );
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [t]);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initialForm),
    [form, initialForm],
  );

  const setField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const initials =
    `${form.firstName?.[0] || ""}${form.lastName?.[0] || ""}`
      .trim()
      .toUpperCase() || "U";

  const handleSave = async () => {
    if (!isDirty || isSaving) return;
    setIsSaving(true);
    setError("");

    try {
      const saved = await saveCurrentUserProfile(form);
      setForm(saved);
      setInitialForm(saved);
    } catch (saveError) {
      setError(
        saveError?.status === 401
          ? t("profileDetails.saveErrorAuth")
          : t("profileDetails.saveError"),
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <NativeAccountScreenShell title={t("profileDetails.title")}>
      {isLoading ? (
        <View style={styles.centeredState}>
          <ActivityIndicator color="#FE946E" size="small" />
          <Text style={styles.stateText}>{t("profileDetails.loading")}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.profileHero}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <Text style={styles.photoPickerText}>
              {t("profileDetails.pickPhoto")}
            </Text>
          </View>
          <View style={styles.profileForm}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {t("profileDetails.firstName")}
              </Text>
              <TextInput
                onChangeText={(value) => setField("firstName", value)}
                placeholder={t("profileDetails.firstNamePlaceholder")}
                placeholderTextColor="#9A9AA1"
                style={styles.input}
                value={form.firstName}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {t("profileDetails.lastName")}
              </Text>
              <TextInput
                onChangeText={(value) => setField("lastName", value)}
                placeholder={t("profileDetails.lastNamePlaceholder")}
                placeholderTextColor="#9A9AA1"
                style={styles.input}
                value={form.lastName}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {t("profileDetails.phone")}
              </Text>
              <TextInput
                editable={false}
                keyboardType="phone-pad"
                placeholder="+998 (__) ___-__-__"
                placeholderTextColor="#9A9AA1"
                style={[styles.input, styles.inputDisabled]}
                value={form.phoneNumber}
              />
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <Pressable
              disabled={!isDirty || isSaving}
              onPress={handleSave}
              style={[
                styles.primaryButton,
                styles.profileFooterAction,
                (!isDirty || isSaving) && styles.primaryButtonDisabled,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {isSaving ? t("profileDetails.saving") : t("profileDetails.save")}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      )}
    </NativeAccountScreenShell>
  );
}
