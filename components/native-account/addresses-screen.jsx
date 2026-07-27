import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Keyboard,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";

import { BrandColors } from "@/constants/theme";
import {
  DEFAULT_TASHKENT_REGION,
  reverseGeocode,
} from "@/lib/address-geocoding-service";
import { getCurrentLocation } from "@/lib/address-location-service";
import {
  deleteNativeAddress,
  listNativeAddresses,
  setNativeDefaultAddress,
} from "@/lib/native-account-api";
import { onSubmitAddress } from "@/lib/address-submit-service";
import { setTabBarForcedHidden } from "@/lib/tab-bar-visibility";

import { AddressBottomSheet } from "@/components/native-account/address/address-bottom-sheet";
import { AddressDetailsForm } from "@/components/native-account/address/address-details-form";
import { AddressMap } from "@/components/native-account/address/address-map";
import { AddressSearchModal } from "@/components/native-account/address/address-search-modal";
import { CenterMapPin } from "@/components/native-account/address/center-map-pin";
import { CurrentLocationButton } from "@/components/native-account/address/current-location-button";
import { addressPalette } from "@/components/native-account/address/address-theme";

const MAP_PREVIEW_HEIGHT = 168;

const EMPTY_FORM = {
  title: "",
  apartment: "",
  entrance: "",
  floor: "",
  courierComment: "",
  isDefault: false,
};

function readAddressValue(item, keys) {
  for (const key of keys) {
    const value = item?.[key];
    if (value != null && String(value).trim() !== "") {
      return value;
    }
  }

  const nestedSources = [
    item?.details,
    item?.address_details,
    item?.addressDetails,
    item?.metadata,
    item?.extra,
  ];

  for (const source of nestedSources) {
    if (!source || typeof source !== "object") continue;
    for (const key of keys) {
      const value = source[key];
      if (value != null && String(value).trim() !== "") {
        return value;
      }
    }
  }

  return "";
}

function normalizeAddressItem(item = {}, index = 0) {
  const title = readAddressValue(item, [
    "title",
    "name",
    "label",
    "address_name",
    "address_type",
    "type",
  ]);

  const address = readAddressValue(item, [
    "formatted_address",
    "formattedAddress",
    "full_address",
    "fullAddress",
    "address",
    "street",
    "line1",
  ]);
  const city = readAddressValue(item, ["city", "district", "town"]);
  const street = readAddressValue(item, ["street", "line1"]);
  const house = readAddressValue(item, ["house", "house_number", "building"]);

  const apartment = readAddressValue(item, [
    "apartment",
    "flat",
    "office",
    "unit",
    "apartment_number",
    "flat_number",
  ]);

  const entrance = readAddressValue(item, [
    "entrance",
    "entry",
    "entrance_number",
    "entry_number",
    "block",
  ]);

  const floor = readAddressValue(item, [
    "floor",
    "floor_number",
    "level",
    "storey",
  ]);

  const intercomCode = readAddressValue(item, [
    "intercom_code",
    "intercomCode",
    "door_code",
    "doorphone_code",
    "access_code",
  ]);

  const courierComment = readAddressValue(item, [
    "comment",
    "courier_comment",
    "courierComment",
    "note",
    "description",
    "landmark",
  ]);

  const latitude = Number(
    readAddressValue(item, ["latitude", "lat", "y", "location_lat"]),
  );
  const longitude = Number(
    readAddressValue(item, ["longitude", "lng", "lon", "x", "location_lng"]),
  );

  return {
    id: String(item.id ?? item.uuid ?? `address-${index}`),
    title: String(title).trim() || `Address ${index + 1}`,
    address:
      String(address).trim() ||
      [city, street, house].filter(Boolean).join(", ").trim(),
    apartment: String(apartment || "").trim(),
    entrance: String(entrance || "").trim(),
    floor: String(floor || "").trim(),
    intercomCode: String(intercomCode || "").trim(),
    courierComment: String(courierComment || "").trim(),
    isDefault: Boolean(item.is_default ?? item.isDefault),
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
  };
}

export function AddressesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const mapRef = useRef(null);
  const reverseGeocodeAbortRef = useRef(null);
  const reverseGeocodeTimeoutRef = useRef(null);
  const [mode, setMode] = useState("list");
  const [addresses, setAddresses] = useState([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [listError, setListError] = useState("");
  const [selectedCoordinates, setSelectedCoordinates] = useState({
    latitude: DEFAULT_TASHKENT_REGION.latitude,
    longitude: DEFAULT_TASHKENT_REGION.longitude,
  });
  const [formattedAddress, setFormattedAddress] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(true);
  const [addressError, setAddressError] = useState("");
  const [locationError, setLocationError] = useState("");
  const [userLocation, setUserLocation] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isPinLifted, setIsPinLifted] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [mapStatus, setMapStatus] = useState({
    hasNativeMap: false,
    hasApiKey: true,
  });
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  const loadAddresses = useCallback(async ({ silent = false } = {}) => {
    if (silent) setIsRefreshing(true);
    else setIsLoadingList(true);
    setListError("");

    try {
      const data = await listNativeAddresses(silent);
      setAddresses(Array.isArray(data) ? data.map(normalizeAddressItem) : []);
    } catch (loadError) {
      setListError(
        loadError?.status === 401
          ? "Please sign in to view your addresses."
          : "Saved addresses could not be loaded.",
      );
    } finally {
      setIsLoadingList(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadAddresses();
  }, [loadAddresses]);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (event) => {
      const keyboardHeight = event?.endCoordinates?.height ?? 0;
      setKeyboardOffset(Math.max(0, keyboardHeight - insets.bottom));
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardOffset(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [insets.bottom]);

  const resetComposer = useCallback(() => {
    reverseGeocodeAbortRef.current?.abort();
    if (reverseGeocodeTimeoutRef.current)
      clearTimeout(reverseGeocodeTimeoutRef.current);
    setSelectedCoordinates({
      latitude: DEFAULT_TASHKENT_REGION.latitude,
      longitude: DEFAULT_TASHKENT_REGION.longitude,
    });
    setFormattedAddress("");
    setIsExpanded(false);
    setIsSearchVisible(false);
    setIsSubmitting(false);
    setIsLocating(false);
    setIsReverseGeocoding(true);
    setAddressError("");
    setLocationError("");
    setUserLocation(null);
    setForm(EMPTY_FORM);
    setEditingAddressId(null);
    setIsPinLifted(false);
  }, []);

  const handleBack = useCallback(() => {
    if (mode === "picker") {
      if (isExpanded) {
        setIsExpanded(false);
        return true;
      }
      resetComposer();
      setMode("list");
      return true;
    }

    if (router.canGoBack()) {
      router.back();
      return true;
    }

    router.replace("/(tabs)/profile");
    return true;
  }, [isExpanded, mode, resetComposer, router]);

  useFocusEffect(
    useCallback(() => {
      setTabBarForcedHidden(true);

      return () => {
        setTabBarForcedHidden(false);
      };
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", handleBack);
      return () => sub.remove();
    }, [handleBack]),
  );

  const runReverseGeocode = useCallback((latitude, longitude) => {
    reverseGeocodeAbortRef.current?.abort();
    if (reverseGeocodeTimeoutRef.current)
      clearTimeout(reverseGeocodeTimeoutRef.current);

    setIsReverseGeocoding(true);
    setAddressError("");

    reverseGeocodeTimeoutRef.current = setTimeout(async () => {
      const controller = new AbortController();
      reverseGeocodeAbortRef.current = controller;

      try {
        const nextAddress = await reverseGeocode(latitude, longitude, {
          signal: controller.signal,
        });
        setFormattedAddress(nextAddress.formattedAddress);
      } catch (_geocodeError) {
        if (controller.signal.aborted) return;
        setAddressError(
          "We could not determine the address. Please search manually.",
        );
      } finally {
        if (!controller.signal.aborted) setIsReverseGeocoding(false);
      }
    }, 420);
  }, []);

  useEffect(() => {
    if (mode !== "picker") {
      reverseGeocodeAbortRef.current?.abort();
      if (reverseGeocodeTimeoutRef.current)
        clearTimeout(reverseGeocodeTimeoutRef.current);
      return undefined;
    }

    runReverseGeocode(
      selectedCoordinates.latitude,
      selectedCoordinates.longitude,
    );

    return () => {
      reverseGeocodeAbortRef.current?.abort();
      if (reverseGeocodeTimeoutRef.current)
        clearTimeout(reverseGeocodeTimeoutRef.current);
    };
  }, [
    mode,
    runReverseGeocode,
    selectedCoordinates.latitude,
    selectedCoordinates.longitude,
  ]);

  const animateToCoordinate = useCallback((latitude, longitude) => {
    mapRef.current?.animateToRegion(
      {
        latitude,
        longitude,
        latitudeDelta: DEFAULT_TASHKENT_REGION.latitudeDelta,
        longitudeDelta: DEFAULT_TASHKENT_REGION.longitudeDelta,
      },
      250,
    );
  }, []);

  const applySelectedLocation = useCallback(
    ({ formattedAddress: nextAddress, latitude, longitude }) => {
      setSelectedCoordinates({ latitude, longitude });
      setFormattedAddress(nextAddress);
      setAddressError("");
      setLocationError("");
      setIsSearchVisible(false);
      animateToCoordinate(latitude, longitude);
    },
    [animateToCoordinate],
  );

  const handleUseCurrentLocation = useCallback(async () => {
    setIsLocating(true);
    setLocationError("");

    try {
      const currentLocation = await getCurrentLocation();
      setUserLocation(currentLocation);
      applySelectedLocation({
        formattedAddress,
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
      });
      runReverseGeocode(currentLocation.latitude, currentLocation.longitude);
    } catch (locationRequestError) {
      setLocationError(
        locationRequestError?.code === "LOCATION_PERMISSION_DENIED"
          ? "Location access was denied."
          : "Current location could not be retrieved.",
      );
    } finally {
      setIsLocating(false);
    }
  }, [applySelectedLocation, formattedAddress, runReverseGeocode]);

  const handleRegionChangeComplete = useCallback((region) => {
    setSelectedCoordinates({
      latitude: region.latitude,
      longitude: region.longitude,
    });
    setIsPinLifted(false);
  }, []);

  const handleChangeField = useCallback((key, value) => {
    if (key === "formattedAddress") {
      setFormattedAddress(value);
      return;
    }

    setForm((current) => ({ ...current, [key]: value }));
  }, []);

  const handleExpand = useCallback(() => {
    if (!formattedAddress.trim()) {
      setAddressError("Please select an address first.");
      return;
    }
    setIsExpanded(true);
  }, [formattedAddress]);

  const handleSheetBack = useCallback(() => {
    if (isExpanded) {
      setIsExpanded(false);
      return;
    }

    handleBack();
  }, [handleBack, isExpanded]);

  const handleEditAddressFromDetails = useCallback(() => {
    setIsExpanded(false);
    setIsSearchVisible(true);
  }, []);

  const handleEditSavedAddress = useCallback(
    (address) => {
      setEditingAddressId(address.id);
      setForm({
        title: address.title || "",
        apartment: address.apartment || "",
        entrance: address.entrance || "",
        floor: address.floor || "",
        courierComment: address.courierComment || "",
        isDefault: Boolean(address.isDefault),
      });
      setFormattedAddress(address.address || "");
      setAddressError("");
      setLocationError("");
      setIsReverseGeocoding(false);
      setIsSearchVisible(false);
      setIsExpanded(true);
      setMode("picker");

      const nextLatitude = address.latitude ?? DEFAULT_TASHKENT_REGION.latitude;
      const nextLongitude =
        address.longitude ?? DEFAULT_TASHKENT_REGION.longitude;
      setSelectedCoordinates({
        latitude: nextLatitude,
        longitude: nextLongitude,
      });
      animateToCoordinate(nextLatitude, nextLongitude);
    },
    [animateToCoordinate],
  );

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return;
    if (!formattedAddress.trim()) {
      setAddressError("Address is required.");
      return;
    }

    setIsSubmitting(true);
    setAddressError("");

    try {
      const savedAddress = await onSubmitAddress({
        title: form.title.trim() || "Home",
        formattedAddress: formattedAddress.trim(),
        latitude: selectedCoordinates.latitude,
        longitude: selectedCoordinates.longitude,
        apartment: form.apartment.trim(),
        entrance: form.entrance.trim(),
        floor: form.floor.trim(),
        courierComment: form.courierComment.trim(),
      }, {
        addressId: editingAddressId,
      });
      const savedAddressId = String(
        savedAddress?.id ?? editingAddressId ?? "",
      ).trim();
      if (form.isDefault && savedAddressId) {
        await setNativeDefaultAddress(savedAddressId);
      }
      resetComposer();
      setMode("list");
      await loadAddresses({ silent: true });
    } catch (submitError) {
      setAddressError(
        submitError?.status === 401
          ? "Please sign in again."
          : "Address could not be saved.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    form,
    editingAddressId,
    formattedAddress,
    isSubmitting,
    loadAddresses,
    resetComposer,
    selectedCoordinates.latitude,
    selectedCoordinates.longitude,
  ]);

  const handleDeleteEditingAddress = useCallback(() => {
    if (!editingAddressId || isSubmitting) return;

    Alert.alert("Delete address", "Are you sure you want to delete this address?", [
      {
        style: "cancel",
        text: "Cancel",
      },
      {
        style: "destructive",
        text: "Delete",
        onPress: async () => {
          try {
            setIsSubmitting(true);
            await deleteNativeAddress(editingAddressId);
            resetComposer();
            setMode("list");
            await loadAddresses({ silent: true });
          } catch (_deleteError) {
            setAddressError("Address could not be deleted.");
            setIsSubmitting(false);
          }
        },
      },
    ]);
  }, [editingAddressId, isSubmitting, loadAddresses, resetComposer]);

  const handleSetDefaultFromList = useCallback(
    async (addressId) => {
      try {
        await setNativeDefaultAddress(addressId);
        await loadAddresses({ silent: true });
      } catch (_error) {
        setListError("Default address could not be updated.");
      }
    },
    [loadAddresses],
  );

  const handleStartAdding = useCallback(() => {
    resetComposer();
    setMode("picker");
  }, [resetComposer]);

  const headerTitle =
    mode === "picker"
      ? isExpanded
        ? "Address details"
        : "Delivery address"
      : "Delivery addresses";

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={handleBack} style={styles.headerBack}>
          <Ionicons color={BrandColors.primary} name="chevron-back" size={28} />
          <Text style={styles.headerBackText}>Back</Text>
        </Pressable>
        <Text numberOfLines={1} style={styles.headerTitle}>
          {headerTitle}
        </Text>
        {mode === "list" ? (
          <Pressable
            hitSlop={12}
            onPress={handleStartAdding}
            style={styles.headerAction}
          >
            <Ionicons color={BrandColors.primary} name="add" size={28} />
          </Pressable>
        ) : editingAddressId && isExpanded ? (
          <Pressable
            hitSlop={12}
            onPress={handleDeleteEditingAddress}
            style={styles.headerDeleteAction}
          >
            <Text style={styles.headerDeleteText}>Delete</Text>
          </Pressable>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      {mode === "list" ? (
        <>
          {isLoadingList ? (
            <View style={styles.centeredState}>
              <ActivityIndicator color="#FE946E" size="small" />
              <Text style={styles.stateText}>Loading saved addresses...</Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl
                  onRefresh={() => loadAddresses({ silent: true })}
                  refreshing={isRefreshing}
                  tintColor="#FE946E"
                />
              }
              showsVerticalScrollIndicator={false}
            >
              {listError ? (
                <Text style={styles.listError}>{listError}</Text>
              ) : null}

              <View style={styles.addressList}>
                {addresses.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Ionicons
                      color="#FE946E"
                      name="location-outline"
                      size={28}
                    />
                    <Text style={styles.emptyTitle}>
                      No saved addresses yet
                    </Text>
                    <Text style={styles.emptyText}>
                      Add your first delivery address and it will show up here.
                    </Text>
                    <Pressable
                      onPress={handleStartAdding}
                      style={styles.emptyButton}
                    >
                      <Text style={styles.emptyButtonText}>Add address</Text>
                    </Pressable>
                  </View>
                ) : (
                  addresses.map((address) => (
                    <Pressable
                      key={address.id}
                      onPress={() => handleSetDefaultFromList(address.id)}
                      style={({ pressed }) => [
                        styles.addressCard,
                        address.isDefault && styles.addressCardDefault,
                        pressed && styles.addressCardPressed,
                      ]}
                    >
                      <View style={styles.addressCardRow}>
                        <View style={styles.addressCardTextWrap}>
                          <View style={styles.addressCardHeader}>
                            <Text numberOfLines={1} style={styles.addressTitle}>
                              {address.title}
                            </Text>
                            {address.isDefault ? (
                              <View style={styles.defaultBadge}>
                                <Text style={styles.defaultBadgeText}>
                                  Default
                                </Text>
                              </View>
                            ) : null}
                          </View>

                          <Text numberOfLines={2} style={styles.addressMainText}>
                            {address.address || "Address not specified"}
                          </Text>
                        </View>

                        <Pressable
                          hitSlop={10}
                          onPress={() => handleEditSavedAddress(address)}
                          style={styles.addressEditButton}
                        >
                          <Ionicons
                            color={BrandColors.primary}
                            name="create-outline"
                            size={20}
                          />
                        </Pressable>
                      </View>
                    </Pressable>
                  ))
                )}
              </View>
            </ScrollView>
          )}

          {addresses.length > 0 && !isLoadingList ? (
            <Pressable onPress={handleStartAdding} style={styles.fab}>
              <Ionicons color="#131314" name="add" size={28} />
            </Pressable>
          ) : null}
        </>
      ) : (
        <View style={styles.pickerScreen}>
          {isExpanded ? (
            <>
              <ScrollView
                contentContainerStyle={[
                  styles.detailsContent,
                  keyboardOffset > 0
                    ? { paddingBottom: 92 + keyboardOffset + 56 }
                    : null,
                ]}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.summarySection}>
                  <Pressable
                    onPress={handleEditAddressFromDetails}
                    style={styles.summaryCard}
                  >
                    <Text numberOfLines={2} style={styles.summaryAddress}>
                      {formattedAddress || "Select an address"}
                    </Text>
                    <Text numberOfLines={1} style={styles.summaryHint}>
                      Tap to change location
                    </Text>
                  </Pressable>
                </View>

                <AddressDetailsForm
                  address={formattedAddress}
                  error={addressError}
                  form={form}
                  isSubmitting={isSubmitting}
                  layout="details"
                  onAddressPress={handleEditAddressFromDetails}
                  onChangeField={handleChangeField}
                  onSubmit={handleSubmit}
                  showSubmitButton={false}
                />

                <Text style={styles.mapSectionTitle}>
                  Where is the entrance?
                </Text>
                <View style={styles.mapPreviewCard}>
                  <View pointerEvents="none" style={styles.staticMapWrap}>
                    <AddressMap
                      mapRef={mapRef}
                      onPanDrag={() => setIsPinLifted(true)}
                      onRegionChangeComplete={handleRegionChangeComplete}
                      onStatusChange={setMapStatus}
                      userLocation={userLocation}
                    />
                  </View>
                  {mapStatus.hasNativeMap ? (
                    <CenterMapPin lifted={isPinLifted} />
                  ) : null}
                  <Pressable
                    onPress={handleEditAddressFromDetails}
                    style={styles.mapPreviewOverlay}
                  />
                </View>
              </ScrollView>

              <View
                style={[
                  styles.detailsFooter,
                  styles.detailsFooterResting,
                  keyboardOffset > 0
                    ? { transform: [{ translateY: -(keyboardOffset + 22) }] }
                    : null,
                ]}
              >
                <Pressable
                  disabled={isSubmitting}
                  onPress={handleSubmit}
                  style={({ pressed }) => [
                    styles.detailsSubmitButton,
                    isSubmitting && styles.detailsSubmitButtonDisabled,
                    pressed && styles.detailsSubmitButtonPressed,
                  ]}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.detailsSubmitText}>Save address</Text>
                  )}
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <View style={styles.mapWrap}>
                <AddressMap
                  mapRef={mapRef}
                  onPanDrag={() => setIsPinLifted(true)}
                  onRegionChangeComplete={handleRegionChangeComplete}
                  onStatusChange={setMapStatus}
                  userLocation={userLocation}
                />
                {mapStatus.hasNativeMap ? (
                  <CenterMapPin lifted={isPinLifted} />
                ) : null}
                {mapStatus.hasNativeMap ? (
                  <View style={styles.locationButtonWrap}>
                    <CurrentLocationButton
                      isLoading={isLocating}
                      onPress={handleUseCurrentLocation}
                    />
                  </View>
                ) : null}
                {!mapStatus.hasApiKey ? (
                  <Text style={styles.locationError}>
                    Yandex API key is missing.
                  </Text>
                ) : null}
                {locationError ? (
                  <Text style={styles.locationError}>{locationError}</Text>
                ) : null}
              </View>

              <AddressBottomSheet
                address={formattedAddress}
                addressError={addressError}
                bottomOffset={0}
                form={form}
                isExpanded={isExpanded}
                isReverseGeocoding={isReverseGeocoding}
                isSubmitting={isSubmitting}
                onAddressPress={() => setIsSearchVisible(true)}
                onChangeField={handleChangeField}
                onLeadingPress={handleSheetBack}
                onPrimaryPress={handleExpand}
                onSubmit={handleSubmit}
              />
            </>
          )}

          <AddressSearchModal
            onRequestClose={() => setIsSearchVisible(false)}
            onSelectAddress={applySelectedLocation}
            onUseCurrentLocation={handleUseCurrentLocation}
            visible={isSearchVisible}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 8,
    backgroundColor: "#FFFFFF",
    zIndex: 3,
  },
  headerBack: {
    flexDirection: "row",
    alignItems: "center",
    width: 76,
  },
  headerBackText: {
    marginLeft: 2,
    fontSize: 15,
    color: BrandColors.primary,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
    color: addressPalette.text,
  },
  headerAction: {
    width: 76,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  headerSpacer: {
    width: 76,
  },
  headerDeleteAction: {
    width: 76,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  headerDeleteText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#D43854",
  },
  centeredState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  stateText: {
    marginTop: 14,
    fontSize: 14,
    lineHeight: 20,
    color: "#747479",
    textAlign: "center",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 120,
    backgroundColor: "#FFFFFF",
  },
  heroCard: {
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 18,
    backgroundColor: "#FFF4EE",
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#131314",
  },
  heroSubtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: "#6E6F75",
  },
  listError: {
    marginTop: 14,
    fontSize: 13,
    lineHeight: 18,
    color: "#B72136",
  },
  addressList: {
    marginTop: 16,
    gap: 12,
  },
  addressCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#ECECEE",
    padding: 16,
  },
  addressCardDefault: {
    borderColor: BrandColors.primary,
  },
  addressCardPressed: {
    opacity: 0.9,
  },
  addressCardRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  addressCardTextWrap: {
    flex: 1,
    minWidth: 0,
    marginRight: 12,
  },
  addressCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  addressTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#131314",
  },
  defaultBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#FFF1EB",
  },
  defaultBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FE946E",
  },
  addressMainText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: "#131314",
  },
  addressEditButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F2FF",
  },
  emptyCard: {
    alignItems: "center",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#ECECEE",
    paddingHorizontal: 20,
    paddingVertical: 28,
    backgroundColor: "#FFFFFF",
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 17,
    fontWeight: "700",
    color: "#131314",
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: "#747479",
    textAlign: "center",
  },
  emptyButton: {
    minHeight: 46,
    marginTop: 18,
    paddingHorizontal: 18,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FE946E",
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#131314",
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FE946E",
    shadowColor: "#131314",
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  mapWrap: {
    flex: 1,
    position: "relative",
  },
  pickerScreen: {
    flex: 1,
  },
  locationButtonWrap: {
    position: "absolute",
    right: 16,
    bottom: 250,
  },
  locationError: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 184,
    textAlign: "center",
    fontSize: 12,
    color: addressPalette.danger,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  detailsContent: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 92,
    backgroundColor: "#FFFFFF",
  },
  summarySection: {
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: addressPalette.divider,
  },
  summaryCard: {
    backgroundColor: addressPalette.mutedSurface,
    borderRadius: 16,
    minHeight: 72,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  summaryAddress: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "600",
    color: addressPalette.text,
  },
  summaryHint: {
    marginTop: 4,
    fontSize: 15,
    color: addressPalette.secondaryText,
  },
  mapSectionTitle: {
    marginTop: 18,
    marginBottom: 14,
    fontSize: 18,
    fontWeight: "700",
    color: addressPalette.text,
  },
  mapPreviewCard: {
    height: MAP_PREVIEW_HEIGHT,
    borderRadius: 26,
    overflow: "hidden",
    position: "relative",
    backgroundColor: addressPalette.mutedSurface,
  },
  staticMapWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  mapPreviewOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  detailsFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    paddingHorizontal: 18,
    paddingTop: 8,
    backgroundColor: "#FFFFFF",
  },
  detailsFooterResting: {
    bottom: -2,
    paddingBottom: 18,
  },
  detailsSubmitButton: {
    minHeight: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: addressPalette.brand,
  },
  detailsSubmitButtonDisabled: {
    opacity: 0.6,
  },
  detailsSubmitButtonPressed: {
    transform: [{ scale: 0.99 }],
  },
  detailsSubmitText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
