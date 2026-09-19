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

## Android APK hajmi

`npm run build:apk` ? preview release APK, ARM 32-bit va ARM 64-bit telefonlar uchun.
`npm run build:apk:arm64` ? faqat ARM 64-bit telefonlar uchun kichikroq preview APK.
`npm run build:apk:universal` ? ARM va Intel (x86/x86_64) qurilmalar/emulatorlar uchun universal preview APK.
`npm run build:aab` ? Play Store uchun production AAB; production API muhitidan foydalanadi.

Preview variantlari bir xil ilova identifikatori va funksiyalardan foydalanadi;
farqi APK ichidagi native protsessor arxitekturalarida. ARM64 APK 32-bit qurilmaga o'rnatilmaydi.
Development va production uchun universal arxitektura sozlamalari saqlangan.

`ANDROID_BUILD_ARCHS` EAS profilidan `expo-build-properties` orqali prebuild paytida
Gradle'ga o'tadi. `/android` Git'da ignore qilingan, shuning uchun EAS uni qayta generatsiya qiladi.
Lokal native build uchun profilga mos `ANDROID_BUILD_ARCHS` bilan prebuild qilish yoki
Gradle'ga `-PreactNativeArchitectures=armeabi-v7a,arm64-v8a` parametrini berish kerak.
Native papka keyinchalik repoga qo'shilsa, bu sozlamani Gradle'da ham saqlash zarur.

Hajmni oldingi APK bilan bir xil build turi va versiyada solishtiring.
AAB faylining hajmi Play Store'dan telefonga yuklanadigan hajmga teng emas.
Xarita SDK'si, tillar va rasm sifati hajm uchun olib tashlanmagan.

## Birinchi release

Bajarilgan himoyalar, qolgan backend/to'lov ishlari va chiqarish tartibi: [RELEASE-READINESS.md](RELEASE-READINESS.md).

`npm test` ? regressiya testlari; `npm run audit:security` ? dependency audit;
`npm run check:release` ? production API va zarur huquqiy URL sozlamalarini tekshirish.
