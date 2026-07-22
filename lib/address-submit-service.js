import { createNativeAddress, updateNativeAddress } from "@/lib/native-account-api";

function trimValue(value) {
  return String(value || "").trim();
}

function toOptionalNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildPayloadVariants(payload) {
  const title = trimValue(payload.title) || "Uy";
  const formattedAddress = trimValue(payload.formattedAddress);
  const latitude = toOptionalNumber(payload.latitude);
  const longitude = toOptionalNumber(payload.longitude);
  const apartment = trimValue(payload.apartment);
  const entrance = trimValue(payload.entrance);
  const floor = trimValue(payload.floor);
  const courierComment = trimValue(payload.courierComment);

  return [
    {
      label: title,
      title,
      name: title,
      formatted_address: formattedAddress,
      lat: latitude,
      lng: longitude,
      apartment,
      entrance,
      floor,
      comment: courierComment,
    },
    {
      title,
      label: title,
      name: title,
      formatted_address: formattedAddress,
      full_address: formattedAddress,
      address: formattedAddress,
      latitude,
      lat: latitude,
      longitude,
      lng: longitude,
      apartment,
      flat: apartment,
      unit: apartment,
      office: apartment,
      entrance,
      entry: entrance,
      entrance_number: entrance,
      floor,
      floor_number: floor,
      level: floor,
      courier_comment: courierComment,
      courierComment,
      comment: courierComment,
      note: courierComment,
    },
    {
      title,
      label: title,
      address_name: title,
      address_type: title,
      full_address: formattedAddress,
      latitude,
      longitude,
      apartment,
      unit: apartment,
      entrance,
      entrance_number: entrance,
      floor,
      level: floor,
      note: courierComment,
    },
  ].map((candidate) =>
    Object.fromEntries(
      Object.entries(candidate).filter(([, value]) => value !== "" && value != null),
    ),
  );
}

export async function onSubmitAddress(payload, options = {}) {
  const variants = buildPayloadVariants(payload);
  const addressId = options.addressId ? String(options.addressId) : "";
  let lastError = null;

  for (const candidate of variants) {
    try {
      return addressId
        ? await updateNativeAddress(addressId, candidate)
        : await createNativeAddress(candidate);
    } catch (error) {
      lastError = error;
      if (error?.status && error.status !== 400 && error.status !== 422) {
        throw error;
      }
    }
  }

  throw lastError || new Error("Address could not be saved.");
}
