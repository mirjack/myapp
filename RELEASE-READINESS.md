# Mio Beauty: birinchi ilovani chiqarish qo'llanmasi

Audit sanasi: 2026-09-07. Holat: **production uchun hali to'liq tasdiqlanmagan**.
Bu hujjat bajarilgan kod ishlarini, qolgan ishlarni va ularning foydasini ajratadi.
Backend kodi, to'lov kabineti, do'kon akkauntlari va real qurilma sinovlari ushbu auditga berilmagan.

## Hozir bajarilgan ishlar

| Ish | Sizga foydasi | Mijozga foydasi |
| --- | --- | --- |
| Auth saqlash, refresh va logout poygalari uchun himoya va testlar | Login bo'yicha murojaatlar kamayadi | Sessiya tasodifan yo'qolish xavfi kamayadi |
| Bosh sahifa ro'yxati virtualizatsiyasi va takror savat so'rovlarini kamaytirish | Serverga kamroq yuk | Scroll va ochilishdagi ish kamayadi; real FPS hali o'lchanmagan |
| ARM preview APK variantlari | Kichikroq tarqatish fayli tayyorlash mumkin | Kamroq yuklab olish; yakuniy APK hajmi hali o'lchanmagan |
| Checkout'da tez takror bosishni bloklash | Takror buyurtma xavfi kamayadi | Bir harakat bilan ortiqcha buyurtma ketmaydi |
| To'lov xatosidan keyin mavjud/noaniq buyurtmani tarixda tekshirish | Buyurtmalarni qo'lda tozalash kamayadi | Mavjud buyurtma ustidan yana buyurtma berishga undalmaydi |
| Bonus kelmasa 0; tanlangan mahsulot topilmasa butun savatga o'tmaslik | Noto'g'ri hisob va noto'g'ri savatni buyurtma qilish kamayadi | Soxta 5000 balans ko'rsatilmaydi |
| Bonus uchun server qabul qilmaydigan qo'lda miqdor kiritishni olib tashlash | UI va boolean `use_points` shartnomasi moslashadi | Server tasdiqlamagan chegirma va'da qilinmaydi |
| Paycom rasmiy GET formatiga mos kodlash va HTTPS/host tekshiruvi | To'lov URL xatosi va begona manzilga yo'naltirishdan himoya | To'lov ishonchli provayder sahifasida ochiladi |
| API javobini kutish uchun 20 soniyalik chegara, avtomatik mutation retry yo'q | Cheksiz loading holatlari kamayadi | So'rov boshlang'ich javobi kelmasa qayta boshqarish mumkin |
| Akkaunt almashganda support keshi, socket, header balansi tozalanishi | Foydalanuvchilar ma'lumotlari aralashish xavfi kamayadi | Avvalgi akkaunt yozishmalari/balansi qolmaydi |
| Root ekran xatosida lokalizatsiyalangan qayta urinish | Oddiy render xatosi uchun tiklanish yo'li | Texnik stack va maxfiy tafsilotlar chiqmaydi |
| Notification sozlamalari tugmasi; huquqiy URL konfiguratsiyasi | Sozlamalar ishlashi uchun tayyor ulanish | Tegishli telefon sozlamasiga kira oladi |
| Testlar, dependency audit va GitHub Actions fayli | Keyingi o'zgarishlar avtomatik tekshiriladi | Regressiyalarni erta topish imkoniyati |

## Muhim: hali nima bajarilmagan

### 1. Backend va buyurtma xavfsizligi ? chiqarishdan oldin

Backendga egalik/kirish huquqini oling. Mobil ilova allaqachon tashqi API'ga ulanadi;
"backend kodi yo'q" degani API yo'q degani emas. Uning egasi va mas'ul dasturchisini aniqlash kerak.
Quyidagilarni aynan serverda tekshirish va amalga oshirish zarur:

- Har bir profil, manzil, savat, buyurtma va support so'rovida foydalanuvchi hamda tenant egaligi.
- OTP uchun telefon/IP/qurilma bo'yicha tezlik limiti, urinish limiti, amal qilish muddati va bir martalik ishlatish.
- Narx, chegirma, yetkazish narxi, qoldiq va bonus balansini server qayta hisoblaydi. Client qiymatiga ishonilmaydi.
- Buyurtma yaratishda `Idempotency-Key` yoki ekvivalent server kafolati: bir tugma/bir so'rov takror kelsa bitta order.
  Hozirgi client lock ilova qayta o'rnatilishi, boshqa telefon yoki tarmoqdagi takrorlarni to'liq bartaraf etmaydi.
- Bonus qancha sarflanishi va yetkazish narxi uchun authoritative quote endpoint/shartnoma.
  Hozir bonus tanlansa jami bonusdan oldin ko'rsatiladi; yakuniy chegirma serverda hisoblanadi.
- Refresh token bekor qilish, qurilmalar sessiyasi va akkauntni o'chirish endpointlari.
- Admin panel: minimal rollar, ikki bosqichli himoya, amallar jurnali. API maxfiy kalitlari faqat serverda.
- Ma'lumotlar bazasi avtomatik zaxirasi, saqlash muddati va amalda zaxiradan tiklash mashqi.

### 2. To'lov ? haqiqiy pul qabul qilishdan oldin

Payme merchant kabineti, sandbox kalitlari va mas'ul backend dasturchisi kerak.
Clientdagi callback yoki brauzer yopilishi "to'landi" degani emas; tasdiq server/provayderdan olinadi.
Hozir app buyurtmalar tarixiga o'tadi, muvaffaqiyatli to'lov deb mahalliy belgilamaydi.

GET adapter merchant, amount, account[field], lang, callback, callback_timeout va currency'ni taniydi.
Fiscal `detail`, description yoki boshqa maxsus POST maydonlari bo'lsa, ularni jim tashlamaydi:
backend tayyor HTTPS GET checkout URL (`method: GET`) yoki xavfsiz hosted POST sahifa oqimini berishi kerak.
Shu holat sandboxda tekshirilmaguncha karta to'lovi production uchun tasdiqlanmagan.

Sinovlar: muvaffaqiyat; bekor qilish; mablag' yetmasligi; to'lovdan keyin internet uzilishi;
callback ikki marta kelishi; bir orderga ikki payment; pul yechilgan, lekin ilova yopilgan holat;
refund va operator orqali muammoni topish. Buyurtma ID va provayder transaction ID serverda bog'lanadi.

### 3. Maxfiylik, shartlar, akkauntni o'chirish ? do'konga yuborishdan oldin

Haqiqiy tashkilot/egasi nomi, support email/telefon, yetkazish va qaytarish qoidalari,
ma'lumotlarni saqlash va o'chirish tartibini aniqlang. Bu ma'lumotlar berilmagani sababli
uydirma privacy policy yoki shartlar yaratilmagan.

Inventarizatsiya uchun: telefon/OTP orqali auth, ism, manzil/geolokatsiya, savat/buyurtmalar,
bonuslar, support yozishmalari, notification va Yandex Maps integratsiyasi mavjud.
AppMetrica kaliti konfiguratsiyada bor; monitoring ulangan va ma'lumot yuboryapti deb tasdiqlanmagan.
Backend va barcha SDK'lar real yig'adigan ma'lumotlarni alohida tekshiring.

Haqiqiy HTTPS sahifalarni nashr qilgach EAS production environment'da quyidagilarni sozlang:

```
EXPO_PUBLIC_PRIVACY_POLICY_URL=https://.../privacy
EXPO_PUBLIC_TERMS_URL=https://.../terms
ACCOUNT_DELETION_URL=https://.../delete-account
```

Birinchi ikkisi profil tugmalariga ulanadi. Uchinchi URL release tekshiruvi uchun;
ilova ichidagi tasdiqlash va backend orqali haqiqiy o'chirish oqimi **hali yozilmagan**.
Faqat logout yoki web sahifa yaratish akkauntni o'chirish bilan teng emas.
Store Data safety/App privacy deklaratsiyalarini real ma'lumot oqimiga qarab to'ldiring.

Apple: https://developer.apple.com/support/offering-account-deletion-in-your-app/
Google: https://support.google.com/googleplay/android-developer/answer/13327111

### 4. Xatolarni masofadan kuzatish va support

ErrorBoundary ? faqat render xatosidan tiklanish; native crash, barcha async xatolar va
ishlash tezligini masofadan o'lchash tizimi emas. Monitoring provayderi/akkaunti tanlanmagan,
DSN va ruxsatlar berilmagan; shu sababli mijoz ma'lumotlari tashqariga yuborilmagan.

Monitoring ulanganda: release/build raqami, maxfiy ma'lumotsiz xato kodi, native crash va
kerakli source map. Telefon, OTP, access/refresh token, manzil va yozishmalarni logga yubormang.
Support aloqa manzilini aniqlang; murojaatda app versiyasi va order ID bilan muammo topish osonlashadi.
SDK/API key'larni provayder kabinetida package/bundle ID va signing fingerprint bilan cheklang.
`EXPO_PUBLIC_*` qiymatlari app ichida ko'rinadi; ularga server paroli yoki payment secret qo'yilmaydi.

### 5. Dependency va qurilma sinovlari

`npm audit --omit=dev` natijasi: oldin 42 (2 critical, 17 high, 22 moderate, 1 low),
yangilanishdan keyin 30 (0 critical, 9 high, 21 moderate). Bular transitive va build-time
paketlarni ham qamraydi; sonning o'zi APK'da shuncha ekspluatatsiya mavjud degani emas.
Qolgan zanjirlarda Expo/Metro image-size va navigation/config dependency'lari bor.
`npm audit fix --force` bajarilmagan: u SDK/router uchun mos kelmaydigan katta versiyalarni taklif qiladi.
Keyingi ish: alohida branch'da qo'llab-quvvatlanadigan Expo SDK migratsiyasi va regression sinovlari.
CI security job hozir high ogohlantirishlar sabab muvaffaqiyatsiz bo'lishi kutiladi; bu yashirilmagan.

Kamida Android ARM64, eski/32-bit Android agar qo'llansa va iPhone'da signed release buildni sinang.
Login, appni majburan yopib qayta ochish, logout/account switch, offline, sust internet,
location/notification ruxsatini rad etish, uzun manzil, katta savat, uchala til va katta shriftni tekshiring.
JS export muvaffaqiyati APK/IPA o'rnatilishi yoki real 60 FPS tasdig'i emas.

## Ushbu auditda bajarilgan tekshiruvlar

- 20 ta avtomatik auth, performance, payment URL, timeout va support isolation testi o'tdi.
- Lint, Expo dependency compatibility va patch-package tekshiruvi o'tdi.
- Android va iOS uchun Metro/Hermes JS export o'tdi. Native APK/IPA build va real payment sinovi bajarilmadi.
- Release preflight kerakli 3 ta URL yo'qligini to'g'ri aniqladi; production hali tayyor emas.
- Dependency auditda 30 ta ogohlantirish qoldi; bu release uchun ochiq ish sifatida saqlangan.

## Kundalik ishni osonlashtiradigan buyruqlar

```
npm test
npm run lint
npx expo install --check
npm run audit:security
npm run check:release
npm run build:apk
```

`check:release` hozir sahifalar yo'qligi sabab xato bilan tugashi to'g'ri. Production EAS
pre-install hook shu tekshiruvni ishga tushiradi. Preview/development bu hujjatlar yo'qligi
uchun bloklanmaydi. URL formatining tekshirilishi hujjat mazmuni yoki backend tayyorligini isbotlamaydi.
`.github/workflows/quality.yml` repo GitHub'ga yuborilib Actions yoqilgach ishlaydi; hozir remote'da ishga tushirilmagan.

## Chiqarish tartibi

1. Backend egasi bilan yuqoridagi order/auth/payment kafolatlarini yozma shartnoma va testlar bilan tekshiring.
2. Haqiqiy support aloqa, privacy/terms va account deletion oqimini tayyorlang.
3. Qolgan dependency high ogohlantirishlarini tuzating yoki aniq exposure tahlili va mas'ul risk qarorini hujjatlashtiring.
4. Sandbox va real signed-device testlarini o'tkazing; zaxiradan tiklashni tekshiring.
5. Store ichki test guruhiga chiqaring, keyin bosqichma-bosqich tarqating. Server orqaga mos qolishi kerak.
6. Buyurtma/to'lov xatolari va crash ko'payganda rolloutni to'xtatish uchun mas'ul odam va tartib belgilang.

Standart asos: https://mas.owasp.org/MASVS/
Payme GET formati: https://developer.help.paycom.uz/initsializatsiya-platezhey/otpravka-cheka-po-metodu-get/

Bu audit xavfsizlikni mutlaq kafolatlamaydi; aynan bajarilgan kod ishlari va ochiq release to'siqlarini ko'rsatadi.
