import { Linking, PermissionsAndroid, Platform } from "react-native";

export const SUPPORT_CHAT_CHANNEL_ID = "support-chat";

let Notifications = null;

try {
  Notifications = require("expo-notifications");
} catch {
  Notifications = null;
}

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

function isNotificationsAvailable() {
  return Boolean(Notifications);
}

function getAndroidApiLevel() {
  return typeof Platform.Version === "number"
    ? Platform.Version
    : Number.parseInt(String(Platform.Version || "0"), 10) || 0;
}

function isAndroidRuntimeNotificationPermissionRequired() {
  return Platform.OS === "android" && getAndroidApiLevel() >= 33;
}

function createUnavailablePermissionPayload() {
  return {
    androidImportance: null,
    canAskAgain: false,
    granted: false,
    iosStatus: null,
    status: "unavailable",
  };
}

async function getAndroidRuntimePermissionStatusAsync() {
  if (!isAndroidRuntimeNotificationPermissionRequired()) {
    return {
      androidImportance: null,
      canAskAgain: true,
      granted: true,
      iosStatus: null,
      status: "granted",
    };
  }

  const isGranted = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
  );

  return {
    androidImportance: null,
    canAskAgain: !isGranted,
    granted: isGranted,
    iosStatus: null,
    status: isGranted ? "granted" : "undetermined",
  };
}

async function requestAndroidRuntimePermissionAsync() {
  if (!isAndroidRuntimeNotificationPermissionRequired()) {
    return getAndroidRuntimePermissionStatusAsync();
  }

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
  );

  if (result === PermissionsAndroid.RESULTS.GRANTED) {
    return {
      androidImportance: null,
      canAskAgain: true,
      granted: true,
      iosStatus: null,
      status: "granted",
    };
  }

  if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
    return {
      androidImportance: null,
      canAskAgain: false,
      granted: false,
      iosStatus: null,
      status: "blocked",
    };
  }

  return {
    androidImportance: null,
    canAskAgain: true,
    granted: false,
    iosStatus: null,
    status: "denied",
  };
}

function normalizePermissionStatus(settings) {
  if (settings?.granted) {
    return "granted";
  }

  if (settings?.canAskAgain === false) {
    return "blocked";
  }

  if (
    Notifications &&
    settings?.status === Notifications.PermissionStatus.DENIED
  ) {
    return "denied";
  }

  return "undetermined";
}

function toPermissionPayload(settings) {
  return {
    androidImportance: settings?.android?.importance ?? null,
    canAskAgain: Boolean(settings?.canAskAgain),
    granted: Boolean(settings?.granted),
    iosStatus: settings?.ios?.status ?? null,
    status: normalizePermissionStatus(settings),
  };
}

export async function configureNotificationChannelAsync() {
  if (Platform.OS !== "android" || !isNotificationsAvailable()) return;

  await Notifications.setNotificationChannelAsync(SUPPORT_CHAT_CHANNEL_ID, {
    name: "Support chat",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#D4AF37",
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    showBadge: true,
    enableLights: true,
    enableVibrate: true,
  });
}

export async function getNotificationPermissionStatusAsync() {
  if (Platform.OS === "android") {
    const androidRuntimeStatus = await getAndroidRuntimePermissionStatusAsync();

    if (!isNotificationsAvailable()) {
      return androidRuntimeStatus;
    }

    await configureNotificationChannelAsync();
    const settings = await Notifications.getPermissionsAsync();
    const payload = toPermissionPayload(settings);

    return {
      ...payload,
      canAskAgain: androidRuntimeStatus.canAskAgain,
      granted: androidRuntimeStatus.granted && payload.granted,
      status: androidRuntimeStatus.granted ? payload.status : androidRuntimeStatus.status,
    };
  }

  if (!isNotificationsAvailable()) {
    return createUnavailablePermissionPayload();
  }

  await configureNotificationChannelAsync();
  const settings = await Notifications.getPermissionsAsync();
  return toPermissionPayload(settings);
}

export async function requestNotificationPermissionAsync() {
  if (Platform.OS === "android") {
    const runtimeRequestStatus = await requestAndroidRuntimePermissionAsync();

    if (!runtimeRequestStatus.granted || !isNotificationsAvailable()) {
      return runtimeRequestStatus;
    }

    await configureNotificationChannelAsync();
    const requestedSettings = await Notifications.requestPermissionsAsync();
    const payload = toPermissionPayload(requestedSettings);

    return {
      ...payload,
      canAskAgain: runtimeRequestStatus.canAskAgain,
      granted: runtimeRequestStatus.granted && payload.granted,
      status: runtimeRequestStatus.granted ? payload.status : runtimeRequestStatus.status,
    };
  }

  if (!isNotificationsAvailable()) {
    return createUnavailablePermissionPayload();
  }

  await configureNotificationChannelAsync();
  const requestedSettings = await Notifications.requestPermissionsAsync();
  return toPermissionPayload(requestedSettings);
}

export async function ensureNotificationSetupAsync({
  requestIfUndetermined = false,
} = {}) {
  const currentStatus = await getNotificationPermissionStatusAsync();

  if (
    requestIfUndetermined &&
    currentStatus.status === "undetermined" &&
    currentStatus.canAskAgain
  ) {
    return requestNotificationPermissionAsync();
  }

  return currentStatus;
}

export async function openNotificationSettingsAsync() {
  await Linking.openSettings();
}
