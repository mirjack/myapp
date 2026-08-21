# Mio Beauty Expo ilovasi

Mio Beauty — go‘zallik mahsulotlari do‘koni uchun Expo va React Native asosida
yaratilgan mobil ilova. Ilovada katalog, mahsulot tafsilotlari, saralanganlar,
savat, buyurtma rasmiylashtirish, profil, buyurtmalar, manzillar, bonuslar va
qo‘llab-quvvatlash chati mavjud.

## Tezkor ishga tushirish

```bash
npm install
npm run start:go
```

Foydali buyruqlar:

```bash
npm run android
npm run ios
npm run lint
npm run knip
```

## Loyiha tuzilishi

- `app/` — Expo Router ekranlari va navigatsiya layoutlari;
- `components/` — native UI va feature komponentlari;
- `lib/` — API, autentifikatsiya, cache, notification, tarjima va chat servislar;
- `constants/` — brend ranglari va theme tokenlari;
- `assets/` — logo, ikonka va statik rasmlar.

## Sozlash

`.env.example` faylidan `.env` yarating va muhit qiymatlarini kiriting:
`EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_STOREFRONT_DOMAIN`,
`EXPO_PUBLIC_TENANT_DOMAIN`, `EXPO_PUBLIC_YANDEX_MAPS_API_KEY` va
`EXPO_PUBLIC_APP_METRICA_API_KEY`.

Build profillari `eas.json` faylida joylashgan: `development`, `preview` va
`production`. EAS build buyruqlari uchun EAS CLI o‘rnatilgan bo‘lishi kerak.

## Sifat tekshiruvlari

```bash
npm run lint
npm run knip
```

Knip sozlamalari `knip.json` faylida. Refactor tarixi va batafsil texnik
ma’lumotlar uchun [Docs.md](Docs.md) fayliga qarang.

Autentifikatsiya tokenlari Expo SecureStore’da saqlanadi. Support chat realtime
ulanishi ishlamasa, HTTP fallback ishlatiladi. Tarjimalar `uz`, `ru`, `en`
uchun `lib/locales/` ichida saqlanadi.
