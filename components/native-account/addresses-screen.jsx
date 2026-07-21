import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  createNativeAddress,
  deleteNativeAddress,
  listNativeAddresses,
  setNativeDefaultAddress,
  updateNativeAddress,
} from "@/lib/native-account-api";

import { NativeAccountScreenShell } from "./account-screen-shell";
import { nativeAccountStyles as styles } from "./native-account.styles";

const EMPTY_ADDRESS = {
  id: null,
  label: "",
  city: "",
  street: "",
  house: "",
  apartment: "",
  formatted_address: "",
  is_default: false,
};

function formatAddressLine(address) {
  return (
    address?.formatted_address ||
    [address?.city, address?.street, address?.house, address?.apartment]
      .filter(Boolean)
      .join(", ")
  );
}

export function AddressesScreen() {
  const [addresses, setAddresses] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [editorVisible, setEditorVisible] = useState(false);
  const [form, setForm] = useState(EMPTY_ADDRESS);

  const loadAddresses = async ({ silent = false } = {}) => {
    if (silent) setIsRefreshing(true);
    else setIsLoading(true);
    setError("");

    try {
      const nextAddresses = await listNativeAddresses(silent);
      setAddresses(nextAddresses);
      const defaultAddress = nextAddresses.find((item) => item?.is_default);
      setSelectedId((current) => current ?? defaultAddress?.id ?? nextAddresses[0]?.id ?? null);
    } catch (loadError) {
      setError(loadError?.status === 401 ? "Please sign in to view addresses." : "Failed to load addresses.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void loadAddresses();
  }, []);

  const selectedAddress = useMemo(
    () => addresses.find((item) => String(item.id) === String(selectedId)) || null,
    [addresses, selectedId],
  );

  const openCreate = () => {
    setForm(EMPTY_ADDRESS);
    setEditorVisible(true);
  };

  const openEdit = (address) => {
    setForm({
      id: address?.id ?? null,
      label: address?.label ?? "",
      city: address?.city ?? "",
      street: address?.street ?? "",
      house: address?.house ?? "",
      apartment: address?.apartment ?? "",
      formatted_address: address?.formatted_address ?? "",
      is_default: Boolean(address?.is_default),
    });
    setEditorVisible(true);
  };

  const setField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSave = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError("");

    const payload = {
      label: String(form.label || "").trim() || "Home",
      city: String(form.city || "").trim(),
      street: String(form.street || "").trim(),
      house: String(form.house || "").trim(),
      apartment: String(form.apartment || "").trim(),
      formatted_address:
        String(form.formatted_address || "").trim() ||
        [form.city, form.street, form.house, form.apartment].filter(Boolean).join(", "),
      is_default: Boolean(form.is_default),
    };

    try {
      if (form.id) {
        await updateNativeAddress(form.id, payload);
      } else {
        await createNativeAddress(payload);
      }
      setEditorVisible(false);
      setForm(EMPTY_ADDRESS);
      await loadAddresses({ silent: true });
    } catch (saveError) {
      setError(saveError?.status === 401 ? "Please sign in again." : "Failed to save address.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (addressId) => {
    Alert.alert("Delete address", "Are you sure you want to delete this address?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setIsSubmitting(true);
          setError("");
          try {
            await deleteNativeAddress(addressId);
            await loadAddresses({ silent: true });
          } catch (deleteError) {
            setError(deleteError?.status === 401 ? "Please sign in again." : "Failed to delete address.");
          } finally {
            setIsSubmitting(false);
          }
        },
      },
    ]);
  };

  const handleSetDefault = async (addressId) => {
    setIsSubmitting(true);
    setError("");
    try {
      await setNativeDefaultAddress(addressId);
      await loadAddresses({ silent: true });
    } catch (defaultError) {
      setError(defaultError?.status === 401 ? "Please sign in again." : "Failed to update default address.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <NativeAccountScreenShell title="Delivery addresses">
      {isLoading ? (
        <View style={styles.centeredState}>
          <ActivityIndicator color="#FE946E" size="small" />
          <Text style={styles.stateText}>Loading addresses...</Text>
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={[styles.content, { paddingTop: 12 }]}
            refreshControl={<RefreshControl onRefresh={() => loadAddresses({ silent: true })} refreshing={isRefreshing} tintColor="#FE946E" />}
          >
            <Pressable onPress={openCreate} style={[styles.secondaryButton, { marginBottom: 12 }]}>
              <Text style={styles.secondaryButtonText}>Add address</Text>
            </Pressable>

            {selectedAddress ? (
              <View style={[styles.card, { marginBottom: 12 }]}>
                <Text style={styles.addressTitle}>{selectedAddress.label || "Selected address"}</Text>
                <Text style={[styles.mutedText, { marginTop: 8 }]}>{formatAddressLine(selectedAddress)}</Text>
              </View>
            ) : null}

            {error ? <Text style={[styles.errorText, { marginTop: 0, marginBottom: 12 }]}>{error}</Text> : null}

            <View style={styles.listGap}>
              {addresses.length === 0 ? (
                <View style={styles.card}>
                  <Text style={styles.stateText}>You do not have saved addresses yet.</Text>
                </View>
              ) : (
                addresses.map((address) => {
                  const selected = String(address.id) === String(selectedId);
                  return (
                    <Pressable
                      key={String(address.id)}
                      onPress={() => setSelectedId(address.id)}
                      style={[styles.addressCard, selected && styles.addressCardSelected]}
                    >
                      <View style={styles.rowBetween}>
                        <Text style={styles.addressTitle}>{address.label || "Address"}</Text>
                        {address.is_default ? (
                          <View style={styles.badge}>
                            <Text style={styles.badgeText}>Default</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.mutedText}>{formatAddressLine(address)}</Text>
                      <View style={[styles.row, { gap: 8, flexWrap: "wrap" }]}>
                        <Pressable onPress={() => openEdit(address)} style={styles.secondaryButton}>
                          <Text style={styles.secondaryButtonText}>Edit</Text>
                        </Pressable>
                        {!address.is_default ? (
                          <Pressable onPress={() => handleSetDefault(address.id)} style={styles.secondaryButton}>
                            <Text style={styles.secondaryButtonText}>Set default</Text>
                          </Pressable>
                        ) : null}
                        <Pressable onPress={() => handleDelete(address.id)} style={styles.secondaryButton}>
                          <Text style={styles.secondaryButtonText}>Delete</Text>
                        </Pressable>
                      </View>
                    </Pressable>
                  );
                })
              )}
            </View>
            <View style={styles.footerSpacer} />
          </ScrollView>

          <Modal animationType="slide" onRequestClose={() => setEditorVisible(false)} transparent visible={editorVisible}>
            <View style={styles.modalBackdrop}>
              <View style={styles.modalSheet}>
                <View style={styles.modalHandle} />
                <Text style={styles.modalTitle}>{form.id ? "Edit address" : "New address"}</Text>
                <ScrollView keyboardShouldPersistTaps="handled">
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Label</Text>
                    <TextInput onChangeText={(value) => setField("label", value)} style={styles.input} value={form.label} />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>City</Text>
                    <TextInput onChangeText={(value) => setField("city", value)} style={styles.input} value={form.city} />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Street</Text>
                    <TextInput onChangeText={(value) => setField("street", value)} style={styles.input} value={form.street} />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>House</Text>
                    <TextInput onChangeText={(value) => setField("house", value)} style={styles.input} value={form.house} />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Apartment</Text>
                    <TextInput onChangeText={(value) => setField("apartment", value)} style={styles.input} value={form.apartment} />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Full address</Text>
                    <TextInput
                      multiline
                      onChangeText={(value) => setField("formatted_address", value)}
                      style={[styles.input, styles.textArea]}
                      value={form.formatted_address}
                    />
                  </View>
                  <View style={styles.switchRow}>
                    <Text style={styles.inputLabel}>Use as default</Text>
                    <Switch
                      onValueChange={(value) => setField("is_default", value)}
                      thumbColor="#FFFFFF"
                      trackColor={{ false: "#D6D6DC", true: "#FE946E" }}
                      value={Boolean(form.is_default)}
                    />
                  </View>
                  <Pressable disabled={isSubmitting} onPress={handleSave} style={[styles.primaryButton, isSubmitting && styles.primaryButtonDisabled]}>
                    <Text style={styles.primaryButtonText}>{isSubmitting ? "Saving..." : "Save address"}</Text>
                  </Pressable>
                  <Pressable onPress={() => setEditorVisible(false)} style={[styles.secondaryButton, { marginTop: 10 }]}>
                    <Text style={styles.secondaryButtonText}>Cancel</Text>
                  </Pressable>
                </ScrollView>
              </View>
            </View>
          </Modal>
        </>
      )}
    </NativeAccountScreenShell>
  );
}
