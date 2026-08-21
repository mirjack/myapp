# Mio Beauty ilovasi — texnik hujjat

## Loyiha haqida

Mio Beauty — Expo SDK 54, React Native 0.81 va React 19 asosidagi native
do‘kon ilovasi. Expo Router `app/` ichidagi faylga asoslangan navigatsiyadan
foydalanadi. Ilovada katalog, mahsulot, saralanganlar, savat, checkout,
profil, buyurtmalar, manzillar, bonuslar va support chat oqimlari mavjud.

Asosiy texnologiyalar: Expo Router, React Navigation, Reanimated, gesture
handler, Yandex Maps, i18next/react-i18next, Expo SecureStore va STOMP/SockJS.
Support chat realtime ulanishi ishlamasa, HTTP fallback ishlatiladi.

## Loyiha tuzilishi

```text
app/                 Expo Router ekranlari va layoutlar
components/          Feature UI va qayta ishlatiladigan komponentlar
constants/           Brend tokenlari
lib/                 API, auth, cache, i18n, notification va chat servislar
assets/              Logo, ikonka va statik fayllar
scripts/             Expo start/reset yordamchi skriptlari
patches/             patch-package native patchlari
android/             Native Android loyiha
```

Route guruhlari: `(tabs)` asosiy tablar, `account/` profil va buyurtma ekranlari,
`chat/` support chat, shuningdek `checkout`, `product`, `loyalty-info` va
`onboarding/phone` alohida oqimlardir.

## Ishga tushirish

```bash
npm install
npm run start:go
```

```bash
npm run android
npm run ios
npm run start:dev-client
npm run lint
npm run knip
npm run build:dev:android
npm run build:apk
```

EAS buyruqlari uchun EAS CLI kerak; u ilovaning runtime dependency’si emas.

## Muhit sozlamalari

`.env.example` faylidan `.env` yarating. Asosiy qiymatlar:

- `EXPO_PUBLIC_API_BASE_URL` — backend API manzili;
- `EXPO_PUBLIC_WEB_URL` — storefront web manzili;
- `EXPO_PUBLIC_STOREFRONT_DOMAIN` va `EXPO_PUBLIC_TENANT_DOMAIN` — tenant;
- `EXPO_PUBLIC_YANDEX_MAPS_API_KEY` — xarita integratsiyasi;
- `EXPO_PUBLIC_APP_METRICA_API_KEY` — analytics sozlamasi;
- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` — kerak bo‘lsa platforma xaritasi.

`app.config.js` build variantiga mos bundle ID, scheme, tenant, Yandex Maps
native ishga tushirilishi va Android launch mode’ni sozlaydi. Build profillari
`eas.json` faylida berilgan. Maxfiy qiymatlarni repository’ga commit qilmang.

## Runtime arxitekturasi

- Auth tokenlari Expo SecureStore’da saqlanadi.
- `lib/native-*` va cache modullari API hamda local state qatlamlarini ajratadi.
- Cart quantity external store sifatida cart va product ekranlarini sinxronlaydi.
- Notification ishga tushirish jarayoni `lib/app-bootstrap.js` ga ajratilgan.
- Tarjima resurslari `lib/locales/` ichida (`uz`, `ru`, `en`).

## Root layout refaktori — 2026-08-21

`app/_layout.jsx` faqat root navigation, theme va ekran konfiguratsiyasiga
mas’ul bo‘lishi uchun soddalashtirildi.

- vaqtincha comment qilingan AppMetrica bootstrap kodi olib tashlandi;
- notification ishga tushirish logikasi `lib/app-bootstrap.js` ga ko‘chirildi;
- root layout endi `initializeAppAsync()` orqali faqat bitta bootstrap oqimini
  chaqiradi;
- notification xatosi ilovaning asosiy navigatsiyasini to‘xtatmaydi.

Bu o‘zgarish foydalanuvchi oqimlarini o‘zgartirmaydi, lekin root layout’ning
mas’uliyatini kamaytiradi va keyingi routing refaktorini osonlashtiradi.

## Account/profile layout refaktori — 2026-08-21

`app/account/_layout.jsx` va `app/(tabs)/profile/_layout.jsx` fayllarida har bir
screen uchun alohida takrorlangan `headerShown: false` sozlamasi umumiy
`Stack.screenOptions` ga ko‘chirildi. Ekran nomlari, animatsiya, gesture va route
manzillari o‘zgartirilmadi. Natijada bu faqat konfiguratsiya takrorlanishini
kamaytiradigan, foydalanuvchi ko‘radigan xatti-harakatga ta’sir qilmaydigan
refaktordir.

## Buyurtma formatlash refaktori — 2026-08-21

`orders-history-screen.jsx` va `order-detail-screen.jsx` ichida takrorlangan
buyurtma sanasi, pul miqdori va item soni formatlash funksiyalari
`components/native-account/order-formatters.js` ga chiqarildi. Formatlash
qoidalari o‘zgartirilmadi; ikki ekran endi bir xil yordamchi funksiyalardan
foydalanadi.

## Buyurtma statuslari refaktori — 2026-08-21

Buyurtmalar ro‘yxati va buyurtma tafsilotlari ekranida takrorlangan status
ma’lumotlari `components/native-account/order-status.js` ga chiqarildi. Status
nomlari, ranglari, badge stillari va tarjima kalitlari o‘zgarmadi; ikkala ekran
endi bir xil status yordamchisidan foydalanadi.

## Auth token parsing refaktori — 2026-08-21

Auth tokenlarini JSON’dan parse qilish kodi bir nechta ekran va servisda
takrorlangan edi. Endi yagona `parseAuthTokens()` yordamchisi
`lib/auth-storage.js` da saqlanadi va home, catalog, cart, checkout, favorites,
profile, product, product card, onboarding hamda API/chat servislarida
ishlatiladi. Parse qilish qoidasi o‘zgarmadi: bo‘sh yoki noto‘g‘ri JSON uchun
`null` qaytariladi. Shu sababli UI va auth xatti-harakati saqlanadi, lekin token
formatini keyinroq o‘zgartirish bitta joydan boshqariladi.

## Account/profile layout refaktori — 2026-08-21

`app/account/_layout.jsx` va `app/(tabs)/profile/_layout.jsx` fayllarida har bir
screen uchun alohida takrorlangan `headerShown: false` sozlamasi umumiy
`Stack.screenOptions` ga ko‘chirildi. Ekran nomlari, animatsiya, gesture va route
manzillari o‘zgartirilmadi. Natijada bu faqat konfiguratsiya takrorlanishini
kamaytiradigan, foydalanuvchi ko‘radigan xatti-harakatga ta’sir qilmaydigan
refaktordir.

## Knip refaktori — 2026-08-21

Knip tavsiya qilgan tartibda ishlatilmayotgan fayllar, dependency’lar va
export’lar tekshirildi. Dynamic import, route discovery va native config sababli
hech narsa ko‘r-ko‘rona o‘chirilmagan; har bir signal repository bo‘ylab qidiruv
bilan tasdiqlangan.

### O‘chirilgan dead fayllar

Import qilinmayotgan fayllar olib tashlandi: `components/haptic-tab.jsx`,
`hooks/use-color-scheme.js`, `hooks/use-color-scheme.web.js`,
`hooks/use-theme-color.js`, `lib/native-account-routes.js` va
`lib/support-chat-routes.js`.

### Dependency tozalash

Ishlatilmayotgan direct dependency’lar `package.json` dan olib tashlandi:
`@appmetrica/react-native-analytics`, `@react-native/virtualized-lists`,
`@react-navigation/bottom-tabs`, `@react-navigation/elements`, `expo-haptics`,
`expo-symbols` va `semver`.

Lockfile npm orqali yangilandi. Ayrim nomlar boshqa Expo yoki React Native
paketlarining transitive dependency’si sifatida qolishi mumkin.

`eas` tashqi CLI bo‘lgani uchun `knip.json` da binary sifatida istisno qilindi.
`expo-updates` kodda import qilinmaydi; Expo config tahlilidagi false-positive
sifatida `ignoreDependencies` ga kiritildi.

### Export va lint tozalash

Tashqaridan import qilinmaydigan helperlar module-private qilindi. `theme.js`
dagi ishlatilmaydigan `Colors` va `Fonts` API’lari olib tashlandi,
`BrandColors` saqlab qolindi. `app/loyalty-info.jsx` dagi ishlatilmayotgan
`StatCard` va `stats` memo hisob-kitobi ham o‘chirildi.

## Tekshiruv

```bash
npm run knip
npm run lint -- --no-cache
```

Refaktordan keyin Knip toza natija beradi; ESLint xato va ogohlantirishlarsiz
yakunlanadi.

## Ehtiyot bo‘lish kerak bo‘lgan joylar

Keyingi cleanup vaqtida `app.config.js`, `app.json`, EAS profillari, native
Android/iOS konfiguratsiyasi, dynamic import va Expo Router entry-point’lari
qo‘lda tekshirilishi kerak.
