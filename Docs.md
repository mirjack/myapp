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

## Katta fayllarni refactor qilish yo‘l xaritasi — 2026-08-26

### Audit xulosasi

Audit `node_modules`, `dist` va build artefaktlarisiz bajarildi. Eng katta production
fayllar quyidagilar:

| Fayl | Qator | Asosiy muammo |
|---|---:|---|
| `components/native-checkout/native-checkout-screen.jsx` | 1,507 | checkout state, API orchestration, address/payment UI va item sheet bitta faylda |
| `components/native-bottom-sheet-content.jsx` | 1,360 | 10 dan ortiq turli sheet, payload parsing va render registry bitta modulda |
| `components/native-home/native-home-screen.jsx` | 1,288 | home data loading, carousel timer, loyalty va bir nechta section renderlari aralashgan |
| `components/native-bottom-sheet.styles.js` | 1,271 | bir nechta feature stillari bitta global style modulida |
| `components/native-product/native-product-screen.jsx` | 1,246 | product fetch, quantity/cart/favorite actionlari va detail layout birga |
| `components/native-cart/native-cart-screen.jsx` | 1,206 | cart loading/action state, row UI va order summary bitta screen’da |
| `components/native-account/addresses-screen.jsx` | 1,153 | map, search, edit form, saved list va navigation state birga |
| `components/support-chat/support-chat-detail-screen.jsx` | 1,006 | realtime lifecycle, message normalization, keyboard va chat UI birga |
| `components/native-profile/native-profile-screen.jsx` | 996 | profile, loyalty, branding contacts, language va logout oqimlari birga |
| `components/native-catalog/native-catalog-screen.jsx` | 806 | catalog query/filter state, fetch lifecycle va grid UI aralashgan |

`package-lock.json` 14,375 qator bo‘lsa-da, u generated fayl va refactor targeti
emas. Hozirgi git o‘zgarishlari faqat catalog, favorites, home, product va
product-card fayllarida; refactor shu o‘zgarishlarni yo‘qotmaydigan kichik commitlar
bilan bajarilishi kerak.

### Aniqlangan texnik signallar

- `formatCurrency`, `readAddressValue` va loyalty qiymatlarini normalize/format
  qilish screen va sheet qatlamlarida takrorlangan. Yangi umumiy helperlar avval
  `lib/formatters/` va `lib/address/` kabi aniq modullarga chiqariladi.
- API modulida transport, tenant header, response mapping va feature endpointlar
  bir faylga yig‘ilgan (`lib/native-market-api.js`, `lib/native-account-api.js`).
  UI refactordan oldin response mapping va request transportini ajratish xavfni
  kamaytiradi.
- `native-bottom-sheet-content.jsx` feature boundary emas, registry sifatida
  ishlayapti. Uni checkout, support, account/loyalty, catalog va product
  sheetlariga bo‘lish, keyin registry’ni yupqa qoldirish kerak.
- Katta screenlarda `useState`/`useEffect`/`useCallback` bilan server lifecycle
  va event handlerlar ko‘paygan. Hook’larni alohida chiqarish faqat dependency
  contract aniq bo‘lgandan keyin qilinadi; aks holda stale closure va navigation
  regressiyasi paydo bo‘lishi mumkin.
- `native-bottom-sheet.styles.js`ni to‘liq birdan bo‘lish xavfli: avval component
  ko‘chiriladi, keyin faqat o‘sha component ishlatadigan style namespace chiqariladi.

### Bitta tavsiya etilgan bajarish tartibi

#### 0-bosqich — baseline va kontraktlar

1. `npm.cmd run lint -- --no-cache` va `npm.cmd run knip` natijasini saqlash.
2. Quyidagi oqimlar uchun qo‘lda smoke-check ro‘yxat tuzish: home → catalog →
   product → cart → checkout; profile → addresses; support chat; guest login.
3. Har bir screen uchun public props/navigation params, API response shape va
   loading/error/empty holatlarini yozib olish.

#### 1-bosqich — eng past riskli umumiy logic

Formatters, address normalization, product image/price helpers va loyalty
normalizerlarini screenlardan ajratish. Bu bosqichda JSX layout o‘zgarmaydi.
Har bir yangi helper bitta source of truth bo‘ladi va eski inline funksiya olib
tashlanadi. Avval checkout/cart/product/home/profile orasidagi takrorlanishlar
tekislanadi.

#### 2-bosqich — leaf UI komponentlari

Quyidagi ketma-ketlikda faqat presentational qismlar ko‘chiriladi:

1. cart: `CartRow`, summary va skeleton;
2. product: gallery, price block, quantity control va action bar;
3. catalog/home: section header, product grid, banner/stories/loyalty block;
4. profile: profile card, loyalty card, contact menu;
5. addresses: saved address row, map controls, details form shell.

Har bir komponent parent’dan explicit props oladi; API yoki router’ni ichidan
chaqirmaydi. Bu screenlarni kichraytiradi va UI regressionni lokal tekshirishga
imkon beradi.

#### 3-bosqich — feature hook va controller qatlamlari

UI ko‘chirilgandan keyin side effectlar ajratiladi:

- `useCatalogData` — query/category/filter/fetch lifecycle;
- `useProductDetails` — product fetch, quantity, favorite va buy-now;
- `useCart` — cart load, quantity mutation va summary;
- `useCheckout` — address, bonus, payment va order submit;
- `useAddresses` — map/search/edit/save/delete/default address;
- `useSupportChat` — websocket/HTTP fallback, message lifecycle va send;
- `useProfile` — profile, loyalty, branding, language va logout.

Hook faqat state/effect va domain action qaytarsin; render markup komponentlarda
qolsin. Hook extraction davomida `useFocusEffect` cleanup, request cancellation,
mounted guard va error semantics saqlanishi shart.

#### 4-bosqich — API va mapping qatlamini tartiblash

`lib/native-market-api.js` va `lib/native-account-api.js` ichidan avval umumiy
HTTP/tenant/auth transporti, keyin feature mapperlar chiqariladi. Endpoint
nomlari va tashqi response mapping o‘zgarmaydi. Tavsiya etilgan tuzilma:

```text
lib/api/http-client.js
lib/api/tenant-headers.js
lib/api/market-api.js
lib/api/account-api.js
lib/api/support-api.js
lib/domain/product-mappers.js
lib/domain/order-mappers.js
lib/domain/address-mappers.js
```

Eski importlar bir bosqichda almashtirilmaydi: kerak bo‘lsa eski modul vaqtincha
facade bo‘lib, yangi modullardan export qiladi. Shu bilan migration davomida
route va componentlar sinmaydi.

#### 5-bosqich — bottom sheet registry

`native-bottom-sheet-content.jsx` quyidagi modullarga bo‘linadi:

```text
components/bottom-sheets/checkout/
components/bottom-sheets/support/
components/bottom-sheets/account/
components/bottom-sheets/catalog/
components/bottom-sheets/product/
components/bottom-sheets/sheet-registry.jsx
```

`sheet-registry.jsx` faqat `type → component` mapping qilsin. Payload contractlar
har sheet uchun alohida hujjatlashtirilsin; noma’lum type uchun hozirgi fallback
xatti-harakati saqlansin. Style’lar ham shu featurelar bilan birga ko‘chiriladi.

#### 6-bosqich — addresses va support kabi stateful oqimlar

Addresses va support chat eng ko‘p tashqi lifecycle’ga ega bo‘lgani uchun oxirgi
stateful refactor qilinadi. Avval domain state machine yoki reducer bilan
holatlar nomlanadi, so‘ng UI ajratiladi. Realtime socket, HTTP fallback, keyboard
listener va BackHandler cleanup’lari har bir transition’da tekshiriladi.

### Definition of done

- Har bir screen taxminan 300–500 qatordan oshmaydi; bundan kattasi feature
  boundary bilan izohlanadi.
- UI component API, hook API va API response mapping alohida bo‘ladi.
- `formatCurrency`, address va product normalization uchun takroriy inline logic
  qolmaydi.
- Har bir bosqichdan keyin `npm.cmd run lint -- --no-cache` va `npm.cmd run knip`
  o‘tadi.
- Qo‘lda smoke-check’da navigation, refresh, empty/error/loading, guest/auth,
  payment redirect, address save/delete/default va chat send/close/rate oqimlari
  oldingi xatti-harakatni saqlaydi.
- Har bir refactor commit bitta feature boundary’ni o‘zgartiradi; API contract
  yoki visual redesign shu refactor bilan aralashtirilmaydi.

### Tavsiya etilgan commitlar

```text
refactor: extract shared market and address formatters
refactor: split cart and product presentational components
refactor: extract catalog and home data hooks
refactor: extract checkout controller and sections
refactor: split bottom sheet content by feature
refactor: separate account/profile and address state
refactor: isolate support chat lifecycle
refactor: organize api transport and domain mappers
```

### Auditdan keyingi tekshiruv

Audit vaqtida `npm.cmd run lint -- --no-cache` va `npm.cmd run knip` muvaffaqiyatli
yakunlandi. Bu refactor yo‘l xaritasi implementatsiya rejasi; hali katta fayllar
ko‘chirilgani yo‘q. Keyingi amaliy qadam — 0-bosqich baseline’ini commit qilib,
1-bosqichdagi umumiy formatter va normalizerlarni alohida kichik commitda
chiqarish.

### Xavfli lifecycle patchi — 2026-08-26

Roadmap’dagi stateful oqimlar bo‘yicha birinchi patch bajarildi:

- addresses screen’da parallel address requestlar uchun sequence guard qo‘shildi;
  eski response yangi ro‘yxatni bosib ketmaydi;
- addresses screen’da location/reverse-geocode va kechiktirilgan camera callbacklar
  unmount’dan keyin state yoki map ref’ga murojaat qilmaydi;
- support chat detail’da bootstrap, send, close va rating async callbacklari
  unmount bo‘lgan screen state’ini yangilamaydi;
- sheet close timer’lari screen lifecycle tugaganda tozalanadi.

Bu patch API, navigation va UI contractlarini o‘zgartirmaydi. Tekshiruv:
`npm.cmd run lint -- --no-cache` va `npm.cmd run knip` muvaffaqiyatli o‘tdi.

### Checkout screen refaktori — 2026-08-26

`components/native-checkout/native-checkout-screen.jsx` 1,507 qatordan 544
qatorga qisqartirildi. Screen endi asosan data loading, checkout calculation,
order submit va composition uchun javob beradi.

Ajratilgan modullar:

- `checkout-styles.js` — barcha checkout `StyleSheet` keylari va qiymatlari;
- `checkout-icons.jsx` — original SVG icon path’lari, o‘lcham va rang contractlari
  saqlangan;
- `checkout-sections.jsx` — header, delivery, items, payment, bonus va summary
  kabi yirik UI bloklari;
- `checkout-items-sheet.jsx` — order item modalining UI’si;
- `checkout-data.js` va `checkout-content.json` — formatter, product helperlar
  va payment method static data.

Componentlar faqat props orqali ishlaydi; API request va navigation orchestration
screen’da qoldi. Shuning uchun UI layout, style keylari va mavjud action callbacklar
saqlanadi. Tekshiruv: `npm.cmd run lint -- --no-cache`, `npm.cmd run knip` va
`git diff --check` muvaffaqiyatli o‘tdi.

## Ehtiyot bo‘lish kerak bo‘lgan joylar

Keyingi cleanup vaqtida `app.config.js`, `app.json`, EAS profillari, native
Android/iOS konfiguratsiyasi, dynamic import va Expo Router entry-point’lari
qo‘lda tekshirilishi kerak.

### Profile branding cache — 2026-08-26

Profile’dagi Telegram, Instagram va YouTube kontaktlari `fetchNativeBranding()`
orqali birinchi login’dan keyin olinadi va `nativeBrandingContacts:v1` SecureStore
cache’iga yoziladi. Cache mavjud bo‘lsa profile mount vaqtida branding API’ga
qayta request yuborilmaydi. Logout vaqtida memory va SecureStore cache tozalanadi.

### UI matnlarini lokalizatsiya qilish — 2026-08-26

Ko‘rinadigan UI matnlari checkout, product, bottom-sheet, address map, loyalty
va profile oqimlarida `useTranslation()` orqali `lib/locales/uz.json`,
`lib/locales/ru.json` va `lib/locales/en.json` fayllaridan olinadi. Fallback,
error, placeholder, loading va empty-state matnlari ham locale tizimiga ulandi.

`ui.checkout`, `ui.product`, `ui.bottomSheet`, `ui.map`, `ui.loyalty` va
`ui.profile` namespace’lari qo‘shildi. Uchala locale JSON fayli parse qilinib,
mojibake (`Ð...`, `Ñ...`) bo‘yicha auditdan o‘tkazildi.
