import * as SecureStore from "expo-secure-store";

const BRANDING_CONTACTS_KEY = "nativeBrandingContacts:v1";
const SECURE_STORE_WRITE_OPTIONS = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

let contactsMemoryCache = null;

function normalizeContacts(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}

export function readCachedNativeBrandingContactsSync() {
  return contactsMemoryCache;
}

export async function readCachedNativeBrandingContacts() {
  if (contactsMemoryCache) return contactsMemoryCache;

  try {
    const raw = await SecureStore.getItemAsync(BRANDING_CONTACTS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    contactsMemoryCache = normalizeContacts(parsed);
    return contactsMemoryCache;
  } catch {
    return contactsMemoryCache;
  }
}

export async function writeCachedNativeBrandingContacts(contacts) {
  const normalizedContacts = normalizeContacts(contacts);
  contactsMemoryCache = normalizedContacts;

  try {
    await SecureStore.setItemAsync(
      BRANDING_CONTACTS_KEY,
      JSON.stringify(normalizedContacts),
      SECURE_STORE_WRITE_OPTIONS,
    );
  } catch {
    // Keep the in-memory value when secure storage is temporarily unavailable.
  }
}
