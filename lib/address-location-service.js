import { Platform } from "react-native";
import * as Location from "expo-location";

function createLocationError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function toCoordinates(location) {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  };
}

async function ensureForegroundPermission() {
  const currentPermission = await Location.getForegroundPermissionsAsync();
  if (currentPermission.status === "granted") {
    return currentPermission;
  }

  const requestedPermission = await Location.requestForegroundPermissionsAsync();
  if (requestedPermission.status !== "granted") {
    throw createLocationError(
      "Location permission denied",
      "LOCATION_PERMISSION_DENIED",
    );
  }

  return requestedPermission;
}

async function ensureLocationServicesEnabled() {
  const hasServicesEnabled = await Location.hasServicesEnabledAsync();
  if (hasServicesEnabled) return;

  if (Platform.OS === "android") {
    try {
      await Location.enableNetworkProviderAsync();
      return;
    } catch {
      throw createLocationError(
        "Location services are disabled",
        "LOCATION_SERVICES_DISABLED",
      );
    }
  }

  throw createLocationError(
    "Location services are disabled",
    "LOCATION_SERVICES_DISABLED",
  );
}

async function getFreshLocation() {
  return Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
    mayShowUserSettingsDialog: true,
  });
}

async function getFallbackLocation() {
  return Location.getLastKnownPositionAsync({
    maxAge: 60 * 1000,
    requiredAccuracy: 150,
  });
}

export async function getCurrentLocation() {
  await ensureForegroundPermission();
  await ensureLocationServicesEnabled();

  try {
    const currentPosition = await getFreshLocation();
    return toCoordinates(currentPosition);
  } catch (currentLocationError) {
    const fallbackLocation = await getFallbackLocation();
    if (fallbackLocation?.coords) {
      return toCoordinates(fallbackLocation);
    }

    if (currentLocationError?.code) {
      throw currentLocationError;
    }

    throw createLocationError(
      "Current location could not be retrieved.",
      "LOCATION_UNAVAILABLE",
    );
  }
}
