# Mio Beauty Expo App

Native Expo application for the Mio Beauty storefront.

## Development

```bash
npm install
npm run start:go
```

Useful commands:

```bash
npm run android
npm run ios
npm run lint
```

## Configuration

Primary runtime variables:

- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_TENANT_DOMAIN`
- `EXPO_PUBLIC_STOREFRONT_DOMAIN`
- `EXPO_PUBLIC_YANDEX_MAPS_API_KEY`
- `EXPO_PUBLIC_APP_METRICA_API_KEY`

Auth tokens are stored in Expo SecureStore. Storefront, account, checkout,
support chat, address, order, cart, catalog, favorites, and profile flows are
implemented natively in Expo.
