import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";

import { DEFAULT_TASHKENT_REGION } from "@/lib/address-geocoding-service";
import { YANDEX_MAPS_API_KEY } from "@/lib/runtime-config";

export const AddressMap = memo(function AddressMap({
  mapRef,
  onPanDrag,
  onRegionChangeComplete,
  onStatusChange,
  userLocation,
}) {
  const webViewRef = useRef(null);
  const isMapReadyRef = useRef(false);
  const pendingRegionRef = useRef(null);
  const pendingUserLocationRef = useRef(null);
  const hasApiKey = Boolean(YANDEX_MAPS_API_KEY);
  const hasNativeMap = Platform.OS !== "web" && hasApiKey;

  const applyRegion = useCallback((region) => {
    if (!region) return;

    const payload = {
      latitude: Number(region.latitude) || DEFAULT_TASHKENT_REGION.latitude,
      longitude: Number(region.longitude) || DEFAULT_TASHKENT_REGION.longitude,
      zoom: Number(region.zoom) || 16,
    };

    const injection = `
      (function () {
        try {
          if (typeof window.__setMapCenter === "function") {
            window.__setMapCenter(${JSON.stringify(payload)});
          }
        } catch (e) {}
        true;
      })();
    `;

    webViewRef.current?.injectJavaScript(injection);
  }, []);

  const applyUserLocation = useCallback((location) => {
    if (!location) return;

    const payload = {
      latitude: Number(location.latitude) || DEFAULT_TASHKENT_REGION.latitude,
      longitude: Number(location.longitude) || DEFAULT_TASHKENT_REGION.longitude,
    };

    const injection = `
      (function () {
        try {
          if (typeof window.__setUserLocation === "function") {
            window.__setUserLocation(${JSON.stringify(payload)});
          }
        } catch (e) {}
        true;
      })();
    `;

    webViewRef.current?.injectJavaScript(injection);
  }, []);

  useEffect(() => {
    onStatusChange?.({
      hasNativeMap,
      hasApiKey,
    });
  }, [hasApiKey, hasNativeMap, onStatusChange]);

  useEffect(() => {
    if (!mapRef) return;

    mapRef.current = {
      animateToRegion(region) {
        pendingRegionRef.current = region;
        if (isMapReadyRef.current) {
          applyRegion(region);
        }
      },
    };

    return () => {
      mapRef.current = null;
    };
  }, [applyRegion, mapRef]);

  useEffect(() => {
    if (!userLocation) return;
    pendingUserLocationRef.current = userLocation;
    if (isMapReadyRef.current) {
      applyUserLocation(userLocation);
    }
  }, [applyUserLocation, userLocation]);

  const mapHtml = useMemo(() => {
    const initialRegion = JSON.stringify({
      latitude: DEFAULT_TASHKENT_REGION.latitude,
      longitude: DEFAULT_TASHKENT_REGION.longitude,
      zoom: 16,
    });

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
    />
    <style>
      html, body, #map {
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        overflow: hidden;
        background: #f4f4f6;
      }
    </style>
    <script src="https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(
      YANDEX_MAPS_API_KEY,
    )}&lang=ru_RU" type="text/javascript"></script>
  </head>
  <body>
    <div id="map"></div>
    <script>
      (function () {
        var initialRegion = ${initialRegion};
        var mapInstance = null;
        var lastReportedCenter = null;
        var currentLocationMarker = null;

        function buildUserMarkerSvg() {
          return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><defs><filter id="shadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="1" stdDeviation="1.1" flood-color="rgba(0,0,0,0.18)"/></filter></defs><g filter="url(#shadow)"><circle cx="12" cy="12" r="7.2" fill="#FE946E"/><circle cx="12" cy="12" r="3" fill="#131314"/></g></svg>';
        }

        function postMessage(type, payload) {
          try {
            if (!window.ReactNativeWebView) return;
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, payload: payload }));
          } catch (e) {}
        }

        function getRegionPayload() {
          if (!mapInstance) return null;
          var center = mapInstance.getCenter();
          var zoom = mapInstance.getZoom();
          var latitudeDelta = Math.max(0.0005, 180 / Math.pow(2, zoom));
          var longitudeDelta = Math.max(0.0005, 360 / Math.pow(2, zoom));

          return {
            latitude: center[0],
            longitude: center[1],
            latitudeDelta: latitudeDelta,
            longitudeDelta: longitudeDelta,
            zoom: zoom
          };
        }

        function reportRegion() {
          var payload = getRegionPayload();
          if (!payload) return;

          var nextCenterKey = payload.latitude.toFixed(6) + ":" + payload.longitude.toFixed(6) + ":" + payload.zoom;
          if (nextCenterKey === lastReportedCenter) return;
          lastReportedCenter = nextCenterKey;
          postMessage("regionChangeComplete", payload);
        }

        function syncDragBehavior() {
          try {
            var dragBehavior = mapInstance && mapInstance.behaviors.get("drag");
            if (!dragBehavior || !dragBehavior.options) return;
            dragBehavior.options.set("inertia", true);
            dragBehavior.options.set("inertiaDuration", 400);
          } catch (e) {}
        }

        window.__setMapCenter = function (region) {
          if (!mapInstance || !region) return;
          var latitude = Number(region.latitude);
          var longitude = Number(region.longitude);
          var zoom = Number(region.zoom) || mapInstance.getZoom() || 16;
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
          mapInstance.setCenter([latitude, longitude], zoom, { duration: 250 });
        };

        window.__setUserLocation = function (location) {
          if (!mapInstance || !location || !window.ymaps) return;
          var latitude = Number(location.latitude);
          var longitude = Number(location.longitude);
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

          if (!currentLocationMarker) {
            currentLocationMarker = new ymaps.Placemark(
              [latitude, longitude],
              {},
              {
                iconLayout: "default#image",
                iconImageHref: "data:image/svg+xml;utf8," + encodeURIComponent(buildUserMarkerSvg()),
                iconImageSize: [24, 24],
                iconImageOffset: [-12, -12]
              }
            );
            mapInstance.geoObjects.add(currentLocationMarker);
          } else {
            currentLocationMarker.geometry.setCoordinates([latitude, longitude]);
            currentLocationMarker.options.set(
              "iconImageHref",
              "data:image/svg+xml;utf8," + encodeURIComponent(buildUserMarkerSvg())
            );
          }
        };

        function init() {
          mapInstance = new ymaps.Map("map", {
            center: [initialRegion.latitude, initialRegion.longitude],
            zoom: initialRegion.zoom,
            controls: []
          }, {
            suppressMapOpenBlock: true
          });

          syncDragBehavior();

          mapInstance.events.add("actionbegin", function () {
            postMessage("panDrag", {});
          });

          mapInstance.events.add("actionend", function () {
            reportRegion();
          });

          mapInstance.events.add("click", function () {
            reportRegion();
          });

          postMessage("mapReady", {});
          reportRegion();
        }

        if (!window.ymaps) {
          postMessage("mapError", { message: "Yandex Maps failed to load." });
          return;
        }

        ymaps.ready(init);
      })();
    </script>
  </body>
</html>`;
  }, []);

  const handleMessage = useCallback(
    (event) => {
      const raw = event?.nativeEvent?.data;
      if (!raw) return;

      let message;
      try {
        message = JSON.parse(raw);
      } catch {
        return;
      }

      if (message?.type === "mapReady") {
        isMapReadyRef.current = true;
        if (pendingRegionRef.current) {
          applyRegion(pendingRegionRef.current);
        }
        if (pendingUserLocationRef.current) {
          applyUserLocation(pendingUserLocationRef.current);
        }
        return;
      }

      if (message?.type === "panDrag") {
        onPanDrag?.();
        return;
      }

      if (message?.type === "regionChangeComplete" && message.payload) {
        onRegionChangeComplete?.(message.payload);
      }
    },
    [applyRegion, applyUserLocation, onPanDrag, onRegionChangeComplete],
  );

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
          <Text style={styles.fallbackTitle}>Yandex API key is missing.</Text>
          <Text style={styles.fallbackText}>Set EXPO_PUBLIC_YANDEX_MAPS_API_KEY and restart the app.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: mapHtml }}
        style={styles.map}
        containerStyle={styles.map}
        javaScriptEnabled
        domStorageEnabled
        onMessage={handleMessage}
        originWhitelist={["*"]}
        overScrollMode="never"
        scrollEnabled={false}
        allowFileAccess={false}
        allowUniversalAccessFromFileURLs={false}
        mixedContentMode="never"
        javaScriptCanOpenWindowsAutomatically={false}
        setSupportMultipleWindows={false}
        startInLoadingState
        renderLoading={() => (
          <View style={[styles.map, styles.loadingWrap]}>
            <ActivityIndicator color="#131314" size="small" />
          </View>
        )}
      />
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
  loadingWrap: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F4F6",
  },
});
