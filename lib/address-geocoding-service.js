import { YANDEX_MAPS_API_KEY } from "@/lib/runtime-config";

const MOCK_ADDRESSES = [
  {
    id: "chilanzar-12",
    title: "Chilanzar Street",
    subtitle: "Chilanzar District, Tashkent",
    formattedAddress: "Tashkent, Chilanzar district, Chilanzar ko'chasi, 12",
    latitude: 41.27561,
    longitude: 69.20301,
  },
  {
    id: "chapanata",
    title: "Chapanata Street",
    subtitle: "Chilanzar District, Tashkent",
    formattedAddress: "Tashkent, Chilanzar district, Chapanata ko'chasi",
    latitude: 41.27248,
    longitude: 69.19844,
  },
  {
    id: "navoi",
    title: "Navoi Street",
    subtitle: "Shaykhantakhur district, Tashkent",
    formattedAddress: "Tashkent, Shaykhantakhur district, Navoi ko'chasi",
    latitude: 41.32495,
    longitude: 69.24267,
  },
  {
    id: "amir-temur",
    title: "Amir Temur Avenue",
    subtitle: "Yunusabad district, Tashkent",
    formattedAddress: "Tashkent, Yunusabad district, Amir Temur shoh ko'chasi",
    latitude: 41.33852,
    longitude: 69.28592,
  },
  {
    id: "gulistan",
    title: "Gulistan Street",
    subtitle: "Chilanzar District, Tashkent",
    formattedAddress: "Tashkent, Chilanzar district, Gulistan ko'chasi",
    latitude: 41.26869,
    longitude: 69.21023,
  },
  {
    id: "sangzor",
    title: "Sangzor Street",
    subtitle: "Chilanzar District, Tashkent",
    formattedAddress: "Tashkent, Chilanzar district, Sangzor ko'chasi",
    latitude: 41.28117,
    longitude: 69.19044,
  },
  {
    id: "madeli",
    title: "Madeli Street",
    subtitle: "Chilanzar District, Tashkent",
    formattedAddress: "Tashkent, Chilanzar district, Madeli ko'chasi",
    latitude: 41.26651,
    longitude: 69.21619,
  },
];

const TASHKENT_LATITUDE = 41.2995;
const TASHKENT_LONGITUDE = 69.2401;
const TASHKENT_BBOX = "68.95,41.16~69.45,41.45";
const YANDEX_GEOCODER_ENDPOINT = "https://geocode-maps.yandex.ru/v1";
const YANDEX_GEOCODER_LANG = "ru_RU";

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);

    if (!signal) return;

    const onAbort = () => {
      clearTimeout(timeout);
      reject(new Error("Request aborted"));
    };

    if (signal.aborted) {
      onAbort();
      return;
    }

    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function scoreAddress(query, address) {
  const haystack = normalize(
    `${address.title} ${address.subtitle} ${address.formattedAddress}`,
  );

  if (haystack.startsWith(query)) return 0;
  if (haystack.includes(query)) return 1;
  return 2;
}

function toSearchResult(address) {
  return {
    id: address.id,
    title: address.title,
    subtitle: address.subtitle,
    formattedAddress: address.formattedAddress,
    latitude: address.latitude,
    longitude: address.longitude,
  };
}

function distanceBetween(latA, lonA, latB, lonB) {
  const latDelta = latA - latB;
  const lonDelta = lonA - lonB;
  return Math.sqrt(latDelta * latDelta + lonDelta * lonDelta);
}

function buildQuery(params) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");
}

function getCollection(responseJson) {
  return responseJson?.response?.GeoObjectCollection ?? null;
}

function getFeatureMembers(responseJson) {
  const collection = getCollection(responseJson);
  return Array.isArray(collection?.featureMember) ? collection.featureMember : [];
}

function parsePos(pos) {
  const [longitude, latitude] = String(pos || "")
    .trim()
    .split(/\s+/)
    .map((value) => Number.parseFloat(value));

  return {
    latitude,
    longitude,
  };
}

function toYandexSearchResult(member, fallbackId) {
  const geoObject = member?.GeoObject ?? {};
  const metadata = geoObject?.metaDataProperty?.GeocoderMetaData ?? {};
  const address = metadata?.Address ?? {};
  const { latitude, longitude } = parsePos(geoObject?.Point?.pos);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    id: geoObject?.uri || address?.formatted || geoObject?.name || fallbackId,
    title: geoObject?.name || metadata?.text || address?.formatted || "Selected address",
    subtitle: geoObject?.description || metadata?.kind || "",
    formattedAddress: address?.formatted || metadata?.text || geoObject?.name || "Selected address",
    latitude,
    longitude,
  };
}

async function fetchYandexGeocode(params, { signal } = {}) {
  if (!YANDEX_MAPS_API_KEY) {
    const error = new Error("Missing Yandex Maps API key");
    error.code = "YANDEX_API_KEY_MISSING";
    throw error;
  }

  const url = `${YANDEX_GEOCODER_ENDPOINT}?${buildQuery({
    apikey: YANDEX_MAPS_API_KEY,
    format: "json",
    lang: YANDEX_GEOCODER_LANG,
    ...params,
  })}`;

  const response = await fetch(url, { signal });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(payload?.message || "Yandex geocoding request failed");
    error.code = `YANDEX_HTTP_${response.status}`;
    throw error;
  }

  return payload;
}

export const DEFAULT_TASHKENT_REGION = {
  latitude: TASHKENT_LATITUDE,
  longitude: TASHKENT_LONGITUDE,
  latitudeDelta: 0.045,
  longitudeDelta: 0.045,
};

export function getMockAddresses() {
  return MOCK_ADDRESSES.map(toSearchResult);
}

export async function searchAddresses(query, { signal } = {}) {
  const normalizedQuery = normalize(query);
  await wait(250, signal);

  if (normalizedQuery.length < 2) {
    return getMockAddresses();
  }

  try {
    const payload = await fetchYandexGeocode(
      {
        geocode: query.trim(),
        bbox: TASHKENT_BBOX,
        rspn: 1,
        results: 10,
      },
      { signal },
    );

    const yandexResults = getFeatureMembers(payload)
      .map((member, index) => toYandexSearchResult(member, `yandex-${index}`))
      .filter(Boolean)
      .sort((left, right) => {
        return scoreAddress(normalizedQuery, left) - scoreAddress(normalizedQuery, right);
      });

    if (yandexResults.length > 0) {
      return yandexResults;
    }
  } catch (error) {
    if (signal?.aborted) throw error;
  }

  return MOCK_ADDRESSES
    .filter((address) =>
      normalize(`${address.title} ${address.subtitle} ${address.formattedAddress}`).includes(
        normalizedQuery,
      ),
    )
    .sort((left, right) => {
      return scoreAddress(normalizedQuery, left) - scoreAddress(normalizedQuery, right);
    })
    .map(toSearchResult);
}

export async function reverseGeocode(latitude, longitude, { signal } = {}) {
  await wait(180, signal);

  try {
    const geocode = `${longitude},${latitude}`;
    let payload = await fetchYandexGeocode(
      { geocode, kind: "street", results: 1 },
      { signal },
    );
    let bestMatch = toYandexSearchResult(
      getFeatureMembers(payload)[0],
      "reverse-geocode-street",
    );

    // A device location often lands on a road or courtyard rather than the
    // exact street point. In that case ask Yandex for the nearest house too.
    if (!bestMatch) {
      payload = await fetchYandexGeocode(
        { geocode, kind: "house", results: 1 },
        { signal },
      );
      bestMatch = toYandexSearchResult(
        getFeatureMembers(payload)[0],
        "reverse-geocode-house",
      );
    }

    if (bestMatch) {
      return {
        ...bestMatch,
        latitude,
        longitude,
      };
    }
  } catch (error) {
    if (signal?.aborted) throw error;
  }

  const nearest = MOCK_ADDRESSES.reduce((best, candidate) => {
    if (!best) return candidate;

    const currentDistance = distanceBetween(latitude, longitude, candidate.latitude, candidate.longitude);
    const bestDistance = distanceBetween(latitude, longitude, best.latitude, best.longitude);
    return currentDistance < bestDistance ? candidate : best;
  }, null);

  if (nearest && distanceBetween(latitude, longitude, nearest.latitude, nearest.longitude) < 0.025) {
    return {
      formattedAddress: nearest.formattedAddress,
      title: nearest.title,
      subtitle: nearest.subtitle,
      latitude,
      longitude,
    };
  }

  return {
    formattedAddress: `Tashkent, ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
    title: "Selected point",
    subtitle: "Tashkent",
    latitude,
    longitude,
  };
}
