import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  NativeModules,
  Platform,
  StyleSheet,
  Text,
  UIManager,
  View,
} from "react-native";
import YaMap, { Animation, Marker } from "react-native-yamap";

import { DEFAULT_TASHKENT_REGION } from "@/lib/address-geocoding-service";
import { YANDEX_MAPS_API_KEY } from "@/lib/runtime-config";

let yandexMapInitKey = "";
let yandexMapInitPromise = null;

function hasYandexNativeView() {
  return Boolean(
    NativeModules?.yamap &&
      (UIManager.getViewManagerConfig?.("YamapView") ||
        UIManager.YamapView),
  );
}

function initYandexMap(apiKey) {
  if (!apiKey) return Promise.reject(new Error("Missing Yandex Maps API key"));
  if (yandexMapInitKey === apiKey) return Promise.resolve();
  if (yandexMapInitPromise) return yandexMapInitPromise;

  yandexMapInitPromise = YaMap.init(apiKey)
    .then(() => {
      yandexMapInitKey = apiKey;
    })
    .finally(() => {
      yandexMapInitPromise = null;
    });

  return yandexMapInitPromise;
}

function regionToPoint(region) {
  return {
    lat: Number(region?.latitude) || DEFAULT_TASHKENT_REGION.latitude,
    lon: Number(region?.longitude) || DEFAULT_TASHKENT_REGION.longitude,
  };
}

function deltaToZoom(region) {
  const latitudeDelta =
    Number(region?.latitudeDelta) || DEFAULT_TASHKENT_REGION.latitudeDelta;
  const zoom = Math.round(Math.log2(360 / latitudeDelta)) - 1;
  return Math.max(5, Math.min(18, zoom));
}

function cameraToRegion(camera) {
  const point = camera?.point || {};
  return {
    latitude: Number(point.lat) || DEFAULT_TASHKENT_REGION.latitude,
    longitude: Number(point.lon) || DEFAULT_TASHKENT_REGION.longitude,
    latitudeDelta: DEFAULT_TASHKENT_REGION.latitudeDelta,
    longitudeDelta: DEFAULT_TASHKENT_REGION.longitudeDelta,
    zoom: Number(camera?.zoom) || deltaToZoom(DEFAULT_TASHKENT_REGION),
  };
}

export const AddressMap = memo(function AddressMap({
  mapRef,
  onPanDrag,
  onRegionChangeComplete,
  onStatusChange,
  userLocation,
}) {
  const nativeMapRef = useRef(null);
  const hasNativeMap = Platform.OS !== "web";
  const hasApiKey = Boolean(YANDEX_MAPS_API_KEY);
  const hasNativeView = hasNativeMap && hasYandexNativeView();
  const [isMapReady, setIsMapReady] = useState(
    !hasNativeMap ||
      !hasNativeView ||
      !hasApiKey ||
      yandexMapInitKey === YANDEX_MAPS_API_KEY,
  );
  const initialRegion = useMemo(
    () => ({
      ...regionToPoint(DEFAULT_TASHKENT_REGION),
      zoom: deltaToZoom(DEFAULT_TASHKENT_REGION),
    }),
    [],
  );

  const applyRegion = useCallback((region) => {
    if (!region) return;

    nativeMapRef.current?.setCenter(
      regionToPoint(region),
      deltaToZoom(region),
      0,
      0,
      250,
      Animation.SMOOTH,
    );
  }, []);

  const handleCameraPositionChange = useCallback(
    (event) => {
      const camera = event?.nativeEvent;
      if (camera?.reason === "GESTURES") onPanDrag?.();
    },
    [onPanDrag],
  );

  const handleCameraPositionChangeEnd = useCallback(
    (event) => {
      onRegionChangeComplete?.(cameraToRegion(event?.nativeEvent));
    },
    [onRegionChangeComplete],
  );

  const handleMapPress = useCallback(
    (event) => {
      const point = event?.nativeEvent;
      if (!point) return;

      onPanDrag?.();
      onRegionChangeComplete?.({
        latitude: Number(point.lat) || DEFAULT_TASHKENT_REGION.latitude,
        longitude: Number(point.lon) || DEFAULT_TASHKENT_REGION.longitude,
        latitudeDelta: DEFAULT_TASHKENT_REGION.latitudeDelta,
        longitudeDelta: DEFAULT_TASHKENT_REGION.longitudeDelta,
      });
      nativeMapRef.current?.setCenter(point, deltaToZoom(DEFAULT_TASHKENT_REGION));
    },
    [onPanDrag, onRegionChangeComplete],
  );

  useEffect(() => {
    if (
      !hasNativeMap ||
      !hasNativeView ||
      !hasApiKey ||
      yandexMapInitKey === YANDEX_MAPS_API_KEY
    ) {
      setIsMapReady(
        !hasNativeMap ||
          !hasNativeView ||
          !hasApiKey ||
          yandexMapInitKey === YANDEX_MAPS_API_KEY,
      );
      return;
    }

    let isMounted = true;
    setIsMapReady(false);

    initYandexMap(YANDEX_MAPS_API_KEY)
      .then(() => {
        if (isMounted) setIsMapReady(true);
      })
      .catch(() => {
        yandexMapInitKey = "";
        if (isMounted) {
          setIsMapReady(false);
          onStatusChange?.({
            hasNativeMap,
            hasApiKey: false,
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [hasApiKey, hasNativeMap, hasNativeView, onStatusChange]);

  useEffect(() => {
    onStatusChange?.({
      hasNativeMap: hasNativeMap && hasNativeView && isMapReady,
      hasApiKey,
    });
  }, [hasApiKey, hasNativeMap, hasNativeView, isMapReady, onStatusChange]);

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

  if (!hasApiKey) {
    return (
      <View style={[styles.map, styles.webFallback]}>
        <View style={styles.fallbackCard}>
          <Text style={styles.fallbackTitle}>Yandex Maps API key is missing.</Text>
          <Text style={styles.fallbackText}>Add EXPO_PUBLIC_YANDEX_MAPS_API_KEY and rebuild the app.</Text>
        </View>
      </View>
    );
  }

  if (!hasNativeView) {
    return (
      <View style={[styles.map, styles.webFallback]}>
        <View style={styles.fallbackCard}>
          <Text style={styles.fallbackTitle}>Yandex native map is not available in this build.</Text>
          <Text style={styles.fallbackText}>Rebuild the development app after installing react-native-yamap.</Text>
        </View>
      </View>
    );
  }

  if (!isMapReady) {
    return (
      <View style={[styles.map, styles.loadingMap]}>
        <Text style={styles.loadingText}>Loading Yandex map...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <YaMap
        fastTapEnabled
        followUser={false}
        initialRegion={initialRegion}
        logoPadding={{ horizontal: 16, vertical: 104 }}
        logoPosition={{ horizontal: "left", vertical: "bottom" }}
        mapType="vector"
        maxFps={60}
        onCameraPositionChange={handleCameraPositionChange}
        onCameraPositionChangeEnd={handleCameraPositionChangeEnd}
        onMapPress={handleMapPress}
        ref={nativeMapRef}
        showUserPosition={false}
        style={styles.map}
      >
        {userLocation ? (
          <Marker
            point={{
              lat: Number(userLocation.latitude),
              lon: Number(userLocation.longitude),
            }}
          >
            <View style={styles.userMarker}>
              <View style={styles.userMarkerDot} />
            </View>
          </Marker>
        ) : null}
      </YaMap>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
    flex: 1,
  },
  webFallback: {
    justifyContent: "flex-end",
    backgroundColor: "#F4F4F6",
    paddingHorizontal: 16,
    paddingBottom: 140,
  },
  loadingMap: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F4F6",
  },
  loadingText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#747479",
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
