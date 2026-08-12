import { memo, useCallback, useEffect, useRef } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import MapView, { Marker } from "react-native-maps";

import { DEFAULT_TASHKENT_REGION } from "@/lib/address-geocoding-service";

export const AddressMap = memo(function AddressMap({
  mapRef,
  onPanDrag,
  onRegionChangeComplete,
  onStatusChange,
  userLocation,
}) {
  const nativeMapRef = useRef(null);
  const hasNativeMap = Platform.OS !== "web";

  const applyRegion = useCallback((region) => {
    if (!region) return;

    const nextRegion = {
      latitude: Number(region.latitude) || DEFAULT_TASHKENT_REGION.latitude,
      longitude: Number(region.longitude) || DEFAULT_TASHKENT_REGION.longitude,
      latitudeDelta: Number(region.latitudeDelta) || 0.006,
      longitudeDelta: Number(region.longitudeDelta) || 0.006,
    };

    nativeMapRef.current?.animateToRegion(nextRegion, 250);
  }, []);

  useEffect(() => {
    onStatusChange?.({
      hasNativeMap,
      hasApiKey: true,
    });
  }, [hasNativeMap, onStatusChange]);

  useEffect(() => {
    if (!mapRef) return;

    mapRef.current = {
      animateToRegion(region) {
        applyRegion(region);
      },
    };

    return () => {
      mapRef.current = null;
    };
  }, [applyRegion, mapRef]);

  if (Platform.OS === "web") {
    return (
      <View style={[styles.map, styles.webFallback]}>
        <View style={styles.fallbackCard}>
          <Text style={styles.fallbackTitle}>Map preview is available on iOS and Android only.</Text>
          <Text style={styles.fallbackText}>Open the mobile app to pick an address on the map.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={nativeMapRef}
        initialRegion={{
          latitude: DEFAULT_TASHKENT_REGION.latitude,
          longitude: DEFAULT_TASHKENT_REGION.longitude,
          latitudeDelta: 0.006,
          longitudeDelta: 0.006,
        }}
        loadingEnabled
        moveOnMarkerPress={false}
        onPanDrag={onPanDrag}
        onRegionChangeComplete={onRegionChangeComplete}
        showsCompass={false}
        showsMyLocationButton={false}
        showsPointsOfInterest={false}
        style={styles.map}
        toolbarEnabled={false}
      >
        {userLocation ? (
          <Marker
            coordinate={{
              latitude: Number(userLocation.latitude),
              longitude: Number(userLocation.longitude),
            }}
            tracksViewChanges={false}
          >
            <View style={styles.userMarker}>
              <View style={styles.userMarkerDot} />
            </View>
          </Marker>
        ) : null}
      </MapView>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  webFallback: {
    justifyContent: "flex-end",
    backgroundColor: "#F4F4F6",
    paddingHorizontal: 16,
    paddingBottom: 140,
  },
  fallbackCard: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 320,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderWidth: 1,
    borderColor: "rgba(19,19,20,0.06)",
  },
  fallbackTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
    color: "#131314",
    textAlign: "center",
  },
  fallbackText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    color: "#747479",
    textAlign: "center",
  },
  userMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FE946E",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 2,
    elevation: 2,
  },
  userMarkerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#131314",
  },
});
