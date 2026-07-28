import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";

import { getMockAddresses, searchAddresses } from "@/lib/address-geocoding-service";

import { AddressSearchResultItem } from "./address-search-result-item";
import { addressPalette } from "./address-theme";

export function AddressSearchModal({
  onRequestClose,
  onSelectAddress,
  onUseCurrentLocation,
  visible,
}) {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const abortRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(() => getMockAddresses());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visible) {
      setQuery("");
      setResults(getMockAddresses());
      setIsLoading(false);
      setError("");
      abortRef.current?.abort();
      abortRef.current = null;
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      return;
    }

    const focusTimeout = setTimeout(() => inputRef.current?.focus(), 150);
    return () => clearTimeout(focusTimeout);
  }, [visible]);

  useEffect(() => {
    if (!visible) return undefined;

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    abortRef.current?.abort();

    if (query.trim().length > 0 && query.trim().length < 2) {
      setResults([]);
      setIsLoading(false);
      setError("");
      return undefined;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      setIsLoading(true);
      setError("");

      try {
        const nextResults = await searchAddresses(query, { signal: controller.signal });
        setResults(nextResults);
      } catch (_searchError) {
        if (controller.signal.aborted) return;
        setError(t("addresses.searchUnavailable"));
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 450);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [query, t, visible]);

  const listHeader = useMemo(
    () => (
      <AddressSearchResultItem
        chevron
        isFirst
        onPress={async () => {
          Keyboard.dismiss();
          await onUseCurrentLocation();
        }}
        subtitle={t("addresses.useCurrentLocationSubtitle")}
        title={t("addresses.useCurrentLocation")}
      />
    ),
    [onUseCurrentLocation, t],
  );

  return (
    <Modal animationType="slide" onRequestClose={onRequestClose} presentationStyle="fullScreen" visible={visible}>
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <View style={styles.searchHeader}>
          <View style={styles.searchField}>
            <Ionicons color={addressPalette.secondaryText} name="search-outline" size={28} />
            <TextInput
              autoCapitalize="words"
              autoCorrect={false}
              autoFocus
              onChangeText={setQuery}
              placeholder={t("addresses.searchPlaceholder")}
              placeholderTextColor={addressPalette.secondaryText}
              ref={inputRef}
              returnKeyType="search"
              style={styles.searchInput}
              value={query}
            />
          </View>
          <Pressable hitSlop={10} onPress={onRequestClose} style={styles.cancelButton}>
            <Text style={styles.cancelText}>{t("common.cancel")}</Text>
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={addressPalette.brand} size="small" />
          </View>
        ) : error ? (
          <View style={styles.centerState}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <FlatList
            data={results}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.centerState}>
                <Text style={styles.emptyText}>
                  {query.trim().length < 2
                    ? t("addresses.minSearchChars")
                    : t("addresses.noSearchResults")}
                </Text>
              </View>
            }
            ListHeaderComponent={listHeader}
            renderItem={({ item, index }) => (
              <AddressSearchResultItem
                chevron={false}
                isFirst={index === 0 && results.length === 0}
                onPress={() => {
                  Keyboard.dismiss();
                  onSelectAddress(item);
                }}
                subtitle={item.subtitle}
                title={item.title}
              />
            )}
            keyExtractor={(item) => item.id}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  searchHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 14,
    backgroundColor: "#FFFFFF",
  },
  searchField: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: addressPalette.mutedSurface,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 18,
    color: addressPalette.text,
    paddingVertical: 0,
  },
  cancelButton: {
    marginLeft: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  cancelText: {
    fontSize: 18,
    color: addressPalette.brand,
  },
  centerState: {
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  errorText: {
    fontSize: 15,
    lineHeight: 20,
    color: addressPalette.danger,
  },
  emptyText: {
    fontSize: 15,
    lineHeight: 20,
    color: addressPalette.secondaryText,
  },
});
