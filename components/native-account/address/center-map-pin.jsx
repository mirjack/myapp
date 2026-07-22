import { memo, useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

import { addressPalette } from "./address-theme";

function CenterMapPinComponent({ lifted }) {
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: lifted ? -9 : 0,
      useNativeDriver: true,
      speed: 18,
      bounciness: 7,
    }).start();
  }, [lifted, translateY]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.container, { transform: [{ translateY }] }]}
    >
      <View style={styles.markerShadow} />
      <View style={styles.markerBody}>
        <View style={styles.markerDot} />
      </View>
      <View style={styles.stem} />
    </Animated.View>
  );
}

export const CenterMapPin = memo(CenterMapPinComponent);

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: "50%",
    top: "50%",
    marginLeft: -15,
    marginTop: -44,
    alignItems: "center",
  },
  markerShadow: {
    position: "absolute",
    top: 20,
    width: 14,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0, 0, 0, 0.14)",
  },
  markerBody: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: addressPalette.brand,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  markerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#131314",
  },
  stem: {
    marginTop: -4,
    width: 4,
    height: 18,
    borderRadius: 999,
    backgroundColor: "#131314",
  },
});
